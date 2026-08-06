/**
 * Improvement proposals: the human-gated path for prompt and skill changes.
 *
 * The learning loop may DRAFT a change to a prompt surface (skills/,
 * specialists/, references/) but may never apply one. A proposal is written
 * to .godpowers/proposals/<id>.json and escalated into the review queue
 * (lib/review-required.js) at PROPOSAL_SEVERITY; only a human walking
 * /god-review-changes applies or rejects it. This module never edits the
 * target file.
 *
 * Cadence: prompt surfaces are declared 'frozen' in lib/artifact-map.js
 * PROMPT_SURFACES, and propose() refuses targets outside them, so the
 * mechanical loop cannot smuggle a proposal against an artifact some other
 * cadence already governs.
 *
 * Severity is staged like gate.js ATTESTATION_GAP_SEVERITY: proposals ship
 * at 'warning' (visible, never blocking), with a tested promotion path to
 * 'error' (blocks Tier 3 via router.detectBlockingReviews) once real cycles
 * prove the pipeline. scripts/test-improvement-proposals.js pins both states
 * so the promotion is a deliberate transition, not silent drift.
 *
 * Telemetry uses the proposal.* event family only. Never change.* (that
 * feeds the product accepted-change rate in lib/change-metrics.js) and never
 * gate.*.
 *
 * Proposal record shape (one JSON file per proposal):
 *   { id, targetFile, rationale, patchText, targetHash, proposed,
 *     status: 'open' | 'accepted' | 'rejected', decided?, reason? }
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const artifactMap = require('./artifact-map');
const reviewRequired = require('./review-required');
const events = require('./events');
const loopConfig = require('./loop-config');
const atomic = require('./atomic-write');

const PROPOSAL_SEVERITY = 'warning';

function proposalsDir(projectRoot) {
  return path.join(projectRoot, '.godpowers', 'proposals');
}

function decidedDir(projectRoot) {
  return path.join(proposalsDir(projectRoot), 'decided');
}

function sha256(text) {
  return 'sha256:' + crypto.createHash('sha256').update(text).digest('hex');
}

function slugify(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

function emitProposalEvent(projectRoot, name, attrs) {
  const handle = events.startRun(projectRoot, { source: 'improvement-proposal' });
  handle.emit({
    span_id: events.generateSpanId(),
    parent: handle.rootSpanId,
    name,
    attrs
  });
}

// A readable record must carry the full shape; a stray or hand-mangled JSON
// file is skipped (returned null) rather than crashing list()/render() or
// silently occupying the open-limit slot.
function readProposalFile(file) {
  try {
    const record = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!record || typeof record !== 'object') return null;
    for (const key of ['id', 'targetFile', 'rationale', 'patchText']) {
      if (typeof record[key] !== 'string' || !record[key]) return null;
    }
    return record;
  } catch (_) {
    return null;
  }
}

/**
 * List proposals. opts.status filters ('open' reads the top-level dir,
 * 'decided' the decided/ subdir; default both).
 */
function list(projectRoot, opts = {}) {
  const out = [];
  const scan = (dir, bucket) => {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir).sort()) {
      if (!name.endsWith('.json')) continue;
      const record = readProposalFile(path.join(dir, name));
      if (record) out.push({ ...record, bucket, file: path.join(dir, name) });
    }
  };
  if (!opts.status || opts.status === 'open') scan(proposalsDir(projectRoot), 'open');
  if (!opts.status || opts.status === 'decided') scan(decidedDir(projectRoot), 'decided');
  return out;
}

/**
 * A proposal is stale when its target file changed since it was drafted (the
 * recorded content hash no longer matches). Stale proposals must be rejected
 * or re-drafted, never applied.
 */
function isStale(projectRoot, record) {
  const target = path.join(projectRoot, record.targetFile);
  if (!fs.existsSync(target)) return true;
  return sha256(fs.readFileSync(target, 'utf8')) !== record.targetHash;
}

/**
 * Draft a proposal: write the record and escalate it into the review queue.
 * Refuses when the target is not a declared prompt surface, when the target
 * does not exist, when an identical open proposal exists (dedupe), or when
 * the open-proposal cap (loop-params proposal-open-limit) is reached.
 */
function propose(projectRoot, input = {}) {
  const { targetFile, rationale, patchText } = input;
  if (!targetFile || typeof targetFile !== 'string') {
    throw new Error('propose requires targetFile (repo-relative path)');
  }
  if (!rationale || typeof rationale !== 'string' || !rationale.trim()) {
    throw new Error('propose requires a rationale');
  }
  if (!patchText || typeof patchText !== 'string' || !patchText.trim()) {
    throw new Error('propose requires patchText');
  }
  const cadence = artifactMap.promptCadence(targetFile);
  if (cadence === null) {
    throw new Error(
      `refused: ${targetFile} is not a declared prompt surface `
      + '(lib/artifact-map.js PROMPT_SURFACES); improvement proposals only target prompt surfaces'
    );
  }
  // Containment, belt and braces with promptCadence's normalization: the
  // resolved target must stay inside the project root, and the record stores
  // the normalized relative path so no consumer ever re-joins raw input.
  const rootAbs = path.resolve(projectRoot);
  const targetAbs = path.resolve(rootAbs, targetFile);
  const relTarget = path.relative(rootAbs, targetAbs).split(path.sep).join('/');
  if (relTarget.startsWith('..') || path.isAbsolute(relTarget)
    || artifactMap.promptCadence(relTarget) === null) {
    throw new Error(`refused: ${targetFile} escapes the declared prompt surfaces`);
  }
  if (!fs.existsSync(targetAbs)) {
    throw new Error(`refused: target file does not exist: ${targetFile}`);
  }

  const open = list(projectRoot, { status: 'open' });
  const patchHash = sha256(patchText);
  const duplicate = open.find((p) => p.targetFile === relTarget && sha256(p.patchText) === patchHash);
  if (duplicate) {
    throw new Error(`refused: identical open proposal already exists: ${duplicate.id}`);
  }
  const limit = loopConfig.value(projectRoot, 'proposal-open-limit');
  if (open.length >= limit) {
    throw new Error(
      `refused: ${open.length} open proposal(s) already queued (proposal-open-limit=${limit}); `
      + 'resolve them in /god-review-changes first'
    );
  }

  const ts = new Date().toISOString();
  const id = `${ts.replace(/[:.]/g, '-')}-${slugify(path.basename(relTarget))}`;
  const record = {
    id,
    targetFile: relTarget,
    rationale: rationale.trim(),
    patchText,
    targetHash: sha256(fs.readFileSync(targetAbs, 'utf8')),
    proposed: ts,
    status: 'open'
  };
  fs.mkdirSync(proposalsDir(projectRoot), { recursive: true });
  const file = path.join(proposalsDir(projectRoot), `${id}.json`);
  atomic.writeJsonAtomic(file, record);

  const relFile = path.relative(projectRoot, file);
  reviewRequired.appendBatch(projectRoot, {
    source: 'improvement-proposal',
    summary: `proposed prompt change to ${relTarget}`,
    items: [{
      id,
      file: relTarget,
      severity: PROPOSAL_SEVERITY,
      // Single line is mandatory: the review-required item parser only
      // round-trips one-line items. The full patch lives in the JSON record.
      message: rationale.trim().split('\n')[0],
      suggestion: `review proposal ${relFile} in /god-review-changes`
    }]
  });
  emitProposalEvent(projectRoot, 'proposal.proposed', { id, target: relTarget });
  return { ...record, file };
}

/**
 * Record a human decision. Moves the record to decided/, stamps the verdict,
 * emits proposal.accepted or proposal.rejected, and removes the proposal's
 * item from the review queue (other batches stay byte-identical). This
 * records the decision; applying the accepted patch to the target file is
 * the human's in-session edit in /god-review-changes, never this module.
 */
function decide(projectRoot, id, input = {}) {
  const status = input.status;
  if (status !== 'accepted' && status !== 'rejected') {
    throw new Error("decide requires status 'accepted' or 'rejected'");
  }
  const file = path.join(proposalsDir(projectRoot), `${id}.json`);
  const record = readProposalFile(file);
  if (!record) {
    throw new Error(`proposal not found or unreadable: ${id}`);
  }
  if (status === 'accepted' && isStale(projectRoot, record)) {
    throw new Error(
      `refused: proposal ${id} is stale (target changed since drafting); reject or re-draft it`
    );
  }
  const decidedRecord = {
    ...record,
    status,
    decided: new Date().toISOString(),
    reason: input.reason || null
  };
  fs.mkdirSync(decidedDir(projectRoot), { recursive: true });
  atomic.writeJsonAtomic(path.join(decidedDir(projectRoot), `${id}.json`), decidedRecord);
  fs.unlinkSync(file);
  reviewRequired.removeItem(projectRoot, 'improvement-proposal', id);
  emitProposalEvent(projectRoot, `proposal.${status}`, { id, target: record.targetFile });
  return decidedRecord;
}

function render(proposals) {
  const lines = ['Improvement proposals', ''];
  if (!proposals.length) {
    lines.push('  (none)');
    return lines.join('\n');
  }
  for (const p of proposals) {
    lines.push(`  [${p.status}] ${p.id}`);
    lines.push(`    target: ${p.targetFile}`);
    lines.push(`    rationale: ${p.rationale.split('\n')[0]}`);
  }
  return lines.join('\n');
}

module.exports = {
  PROPOSAL_SEVERITY,
  proposalsDir,
  decidedDir,
  propose,
  decide,
  list,
  isStale,
  render
};
