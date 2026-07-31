/**
 * Story Validator
 *
 * Parses and validates STORY files (story-file workflow).
 * Backward-compatible: doesn't replace /god-feature; complements it
 * with finer-grained slices.
 *
 * A story file is a WORK UNIT. Its `kind` decides what it delivers:
 *   slice     - a build slice. Delivers code. The historical default.
 *   decision  - delivers a resolved decision, nothing else.
 *   research  - delivers a fact a decision waits on. Agent-alone.
 *   prototype - delivers a cheap artifact to react to. Human in the loop.
 *   grilling  - delivers a decision reached in conversation. Human in the loop.
 *   task      - manual work that must happen before a decision can be made.
 *
 * Units with a kind other than `slice` are decision units: they are on the
 * same board, carry the same ids, deps, and statuses, but they are checked
 * against a question-shaped contract instead of a user-story-shaped one.
 * A unit with no `kind` is a slice, so every file written before kinds
 * existed still validates unchanged.
 *
 * STORY schema:
 *   ---
 *   id: STORY-{slug}-NNN
 *   title: "Short noun phrase"
 *   kind: slice | decision | research | prototype | grilling | task
 *   status: pending | in-progress | blocked | done | closed
 *   hitl: true | false
 *   owner: name
 *   claimed-at: ISO timestamp
 *   closed-reason: one line, required when status is closed
 *   deps: [STORY-other-001]
 *   chart: CHART-{slug}
 *   created: ISO date
 *   ---
 *
 *   ## User Story            (slice only)
 *   As a [persona], I want [capability] so that [outcome].
 *
 *   ## Acceptance Criteria   (slice only)
 *   - [DECISION] User can do X. Acceptance: clicks Y, sees Z.
 *
 *   ## Question              (decision units only)
 *   ## What Would Answer It  (decision units only)
 *
 *   ## Slice Plan
 *   1. Step 1
 *
 *   ## Notes
 *
 * Public API:
 *   parseStory(filePath) -> { id, title, kind, status, owner, deps, ... }
 *   validateStory(story) -> findings
 *   findStoryFiles(projectRoot) -> [paths]
 *   listStories(projectRoot) -> [{ id, status, ... }]
 *   listByStatus(projectRoot, status) -> [...]
 *   listByKind(projectRoot, kind) -> [...]
 *   frontier(projectRoot) -> [...]        open, unblocked, unclaimed
 *   findDanglingDeps(projectRoot) -> [{ id, dep }]
 *   isClaimStale(story, ttlMinutes, now) -> bool
 *   claim(filePath, owner) / release(filePath) / close(filePath, reason)
 *   isValidId(id) -> bool
 */

const fs = require('fs');
const path = require('path');

const VALID_STATUSES = ['pending', 'in-progress', 'blocked', 'done', 'closed'];
const TERMINAL_STATUSES = ['done', 'closed'];
const VALID_KINDS = ['slice', 'decision', 'research', 'prototype', 'grilling', 'task'];
const DECISION_KINDS = ['decision', 'research', 'prototype', 'grilling', 'task'];
const DEFAULT_KIND = 'slice';

/**
 * Which kinds resolve only through a live exchange with a human. A unit whose
 * kind is human-in-the-loop by default may still set `hitl: false` explicitly
 * (a prototype the agent can build and judge alone), and a slice may set
 * `hitl: true`. The default is what the kind implies.
 */
const HITL_DEFAULT_BY_KIND = {
  slice: false,
  decision: true,
  research: false,
  prototype: true,
  grilling: true,
  task: true
};

/**
 * A claim older than this with no movement is treated as abandoned, mirroring
 * the state-lock TTL in references/shared/LOCKING.md. Reclaiming is a user
 * decision, not an automatic one: the selector reports staleness and the
 * caller decides.
 */
const CLAIM_TTL_MINUTES = 60;

const ID_PATTERN = /^STORY-[\w-]+-\d+$/;
const USER_STORY_PATTERN = /as\s+a[n]?\s+.+,\s+i\s+want\s+.+\s+so\s+that\s+/i;

function isValidId(id) {
  return ID_PATTERN.test(id);
}

function storiesDir(projectRoot) {
  return path.join(projectRoot, '.godpowers', 'stories');
}

/**
 * Normalize a raw `kind` value. Absent or unrecognized values resolve to
 * `slice` for read paths so a typo degrades to the historical behavior
 * rather than crashing; validateStory reports the typo separately.
 */
function normalizeKind(raw) {
  if (!raw) return DEFAULT_KIND;
  const value = String(raw).trim().toLowerCase();
  return VALID_KINDS.includes(value) ? value : DEFAULT_KIND;
}

function isDecisionKind(kind) {
  return DECISION_KINDS.includes(normalizeKind(kind));
}

/**
 * Whether this unit must be resolved with a human present. Explicit `hitl:`
 * wins; otherwise the kind decides.
 */
function isHitl(story) {
  const raw = story && story.frontmatter ? story.frontmatter.hitl : undefined;
  if (raw === true || raw === 'true') return true;
  if (raw === false || raw === 'false') return false;
  return HITL_DEFAULT_BY_KIND[normalizeKind(story && story.kind)] === true;
}

/**
 * Find all STORY-* story files under .godpowers/stories/. New stories are
 * written as .mdx; legacy .md stories remain readable.
 */
function findStoryFiles(projectRoot) {
  const dir = storiesDir(projectRoot);
  const found = [];
  if (!fs.existsSync(dir)) return found;

  function walk(d) {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); }
    catch (e) { return; }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile() && /^STORY-/.test(e.name)
        && (e.name.endsWith('.mdx') || e.name.endsWith('.md'))) {
        found.push(full);
      }
    }
  }
  walk(dir);
  return found;
}

/**
 * Parse a STORY file. Returns object with frontmatter, parsed sections, errors.
 */
function parseStory(filePath) {
  const errors = [];
  if (!fs.existsSync(filePath)) {
    return { errors: ['file-not-found'] };
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  if (!raw.startsWith('---')) {
    return { errors: ['missing-frontmatter'], raw };
  }
  const fmEnd = raw.indexOf('\n---', 3);
  if (fmEnd === -1) {
    return { errors: ['unclosed-frontmatter'], raw };
  }
  const fmText = raw.slice(3, fmEnd).trim();
  const body = raw.slice(fmEnd + 4).trim();

  const fm = {};
  for (const line of fmText.split('\n')) {
    const m = line.match(/^([\w-]+):\s*(.*)$/);
    if (m) {
      let value = m[2].trim();
      // Parse arrays: [a, b] or ["a", "b"]
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value.slice(1, -1).split(',').map(s => {
          let t = s.trim();
          // Strip surrounding quotes if present
          if ((t.startsWith('"') && t.endsWith('"')) ||
              (t.startsWith("'") && t.endsWith("'"))) {
            t = t.slice(1, -1);
          }
          return t;
        }).filter(Boolean);
      } else if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      fm[m[1]] = value;
    }
  }

  // Parse sections
  const sections = {};
  let currentHeading = null;
  let currentLines = [];
  for (const line of body.split('\n')) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m) {
      if (currentHeading) {
        sections[currentHeading] = currentLines.join('\n').trim();
      }
      currentHeading = m[1].trim();
      currentLines = [];
    } else if (currentHeading) {
      currentLines.push(line);
    }
  }
  if (currentHeading) {
    sections[currentHeading] = currentLines.join('\n').trim();
  }

  const story = {
    path: filePath,
    id: fm.id,
    title: fm.title,
    kind: normalizeKind(fm.kind),
    rawKind: fm.kind,
    status: fm.status,
    owner: fm.owner,
    claimedAt: fm['claimed-at'],
    closedReason: fm['closed-reason'],
    chart: fm.chart,
    deps: Array.isArray(fm.deps) ? fm.deps : (fm.deps ? [fm.deps] : []),
    created: fm.created,
    frontmatter: fm,
    body,
    sections,
    errors
  };
  story.hitl = isHitl(story);
  return story;
}

/**
 * Validate a parsed story. Returns findings.
 *
 * The section contract is chosen by kind. A slice is checked against the
 * user-story shape it has always been checked against; a decision unit is
 * checked against a question shape, because "As a X, I want Y so that Z"
 * cannot express "decide whether the queue is a Postgres table" without
 * lying about the format.
 */
function validateStory(story) {
  const findings = [];

  if (story.errors && story.errors.length > 0) {
    for (const e of story.errors) {
      findings.push({ severity: 'error', kind: e, message: e });
    }
    return findings;
  }

  if (!story.id) {
    findings.push({ severity: 'error', kind: 'missing-id', message: 'STORY missing `id` in frontmatter' });
  } else if (!isValidId(story.id)) {
    findings.push({
      severity: 'error',
      kind: 'invalid-id-format',
      message: `STORY id "${story.id}" does not match STORY-{slug}-NNN pattern`
    });
  }
  if (!story.title) {
    findings.push({ severity: 'error', kind: 'missing-title', message: 'STORY missing `title`' });
  }
  if (!story.status) {
    findings.push({ severity: 'error', kind: 'missing-status', message: 'STORY missing `status`' });
  } else if (!VALID_STATUSES.includes(story.status)) {
    findings.push({
      severity: 'error',
      kind: 'invalid-status',
      message: `Status "${story.status}" not one of ${VALID_STATUSES.join(', ')}`
    });
  }
  if (story.rawKind && !VALID_KINDS.includes(String(story.rawKind).trim().toLowerCase())) {
    findings.push({
      severity: 'error',
      kind: 'invalid-kind',
      message: `Kind "${story.rawKind}" not one of ${VALID_KINDS.join(', ')}`
    });
  }

  // A claim with no holder is not a claim. Two sessions running
  // `/god-story-build --next` cannot tell their own claim from another's
  // unless the claim records who made it.
  if (story.status === 'in-progress' && !story.owner) {
    findings.push({
      severity: 'error',
      kind: 'unclaimed-in-progress',
      message: 'STORY is in-progress with no `owner`. A claim needs a holder.'
    });
  } else if (!story.owner) {
    findings.push({ severity: 'warning', kind: 'missing-owner', message: 'STORY missing `owner` field' });
  }

  // `closed` is the terminal state for work ruled beyond the destination.
  // Without a reason it is indistinguishable from abandonment.
  if (story.status === 'closed' && !story.closedReason) {
    findings.push({
      severity: 'error',
      kind: 'closed-without-reason',
      message: 'STORY is closed with no `closed-reason`. Say why it was ruled out.'
    });
  }
  if (story.status !== 'closed' && story.closedReason) {
    findings.push({
      severity: 'warning',
      kind: 'orphan-closed-reason',
      message: 'STORY carries `closed-reason` but its status is not closed'
    });
  }

  if (isDecisionKind(story.kind)) {
    validateDecisionUnit(story, findings);
  } else {
    validateSlice(story, findings);
  }

  return findings;
}

function validateSlice(story, findings) {
  // User Story section format
  if (!story.sections || !story.sections['User Story']) {
    findings.push({
      severity: 'warning',
      kind: 'missing-user-story',
      message: 'STORY missing `## User Story` section'
    });
  } else {
    const us = story.sections['User Story'];
    if (!USER_STORY_PATTERN.test(us)) {
      findings.push({
        severity: 'warning',
        kind: 'user-story-format',
        message: 'User Story does not match "As a X, I want Y so that Z" format'
      });
    }
  }

  // Acceptance Criteria
  if (!story.sections || !story.sections['Acceptance Criteria']) {
    findings.push({
      severity: 'warning',
      kind: 'missing-acceptance',
      message: 'STORY missing `## Acceptance Criteria` section'
    });
  }
}

function validateDecisionUnit(story, findings) {
  if (!story.sections || !story.sections['Question']) {
    findings.push({
      severity: 'warning',
      kind: 'missing-question',
      message: `A ${story.kind} unit needs a \`## Question\` section`
    });
  }
  if (!story.sections || !story.sections['What Would Answer It']) {
    findings.push({
      severity: 'warning',
      kind: 'missing-answer-shape',
      message: `A ${story.kind} unit needs a \`## What Would Answer It\` section`
    });
  }
  // A decision unit that carries acceptance criteria is a build slice wearing
  // a decision label. That is the failure /god-chart exists to prevent.
  if (story.sections && story.sections['Acceptance Criteria']) {
    findings.push({
      severity: 'warning',
      kind: 'decision-unit-with-acceptance',
      message: `A ${story.kind} unit has \`## Acceptance Criteria\`. Decision units resolve a question; they do not ship behavior.`
    });
  }
  if (story.status === 'done' && !(story.sections && story.sections['Answer'])) {
    findings.push({
      severity: 'warning',
      kind: 'resolved-without-answer',
      message: `A resolved ${story.kind} unit needs an \`## Answer\` section recording what was decided`
    });
  }
}

/**
 * List all stories with summary fields.
 */
function listStories(projectRoot) {
  const files = findStoryFiles(projectRoot);
  return files.map(f => {
    const story = parseStory(f);
    return {
      id: story.id,
      title: story.title,
      kind: story.kind,
      status: story.status,
      owner: story.owner,
      claimedAt: story.claimedAt,
      closedReason: story.closedReason,
      chart: story.chart,
      hitl: story.hitl,
      deps: story.deps || [],
      path: f
    };
  });
}

function listByStatus(projectRoot, status) {
  return listStories(projectRoot).filter(s => s.status === status);
}

function listByKind(projectRoot, kind) {
  const wanted = normalizeKind(kind);
  return listStories(projectRoot).filter(s => s.kind === wanted);
}

/**
 * The frontier: the edge of the known. Units that are open, unblocked, and
 * unclaimed, so a session can take one without colliding with another.
 *
 * Open      - status is pending (not in-progress, done, or closed)
 * Unblocked - every dep is done or closed; a dep ruled out of scope no
 *             longer blocks the work that was waiting on it
 * Unclaimed - no owner
 *
 * A dep naming a unit that does not exist does NOT count as satisfied. A
 * dangling dep is a map error, and treating it as clear would silently open
 * work whose prerequisite was never charted. Use findDanglingDeps to surface
 * them.
 */
function frontier(projectRoot) {
  const stories = listStories(projectRoot);
  const byId = {};
  for (const s of stories) byId[s.id] = s;

  return stories.filter((s) => {
    if (s.status !== 'pending') return false;
    if (s.owner) return false;
    return (s.deps || []).every((dep) => {
      const target = byId[dep];
      if (!target) return false;
      return TERMINAL_STATUSES.includes(target.status);
    });
  });
}

/**
 * Deps naming a unit that does not exist. Silent before this existed: a typo
 * in `deps:` left the unit permanently off the frontier with no explanation.
 */
function findDanglingDeps(projectRoot) {
  const stories = listStories(projectRoot);
  const known = new Set(stories.map((s) => s.id));
  const dangling = [];
  for (const s of stories) {
    for (const dep of s.deps || []) {
      if (!known.has(dep)) dangling.push({ id: s.id, dep, path: s.path });
    }
  }
  return dangling;
}

/**
 * Whether a claim has gone stale. Mirrors the state-lock TTL contract: a
 * claim is a promise to be working, and an abandoned promise must be
 * reclaimable or the unit is stranded. A claim with no timestamp is treated
 * as stale, because an untimed claim cannot be shown to be live.
 */
function isClaimStale(story, ttlMinutes = CLAIM_TTL_MINUTES, now = Date.now()) {
  if (!story || story.status !== 'in-progress') return false;
  if (!story.claimedAt) return true;
  const claimed = Date.parse(story.claimedAt);
  if (Number.isNaN(claimed)) return true;
  return (now - claimed) > ttlMinutes * 60 * 1000;
}

/**
 * Rewrite or insert a single frontmatter key. Only touches the frontmatter
 * block so body prose that happens to start with `owner:` is left alone.
 */
function setFrontmatterField(raw, key, value) {
  const fmEnd = raw.indexOf('\n---', 3);
  if (!raw.startsWith('---') || fmEnd === -1) {
    throw new Error('story file has no parseable frontmatter');
  }
  const head = raw.slice(0, fmEnd);
  const tail = raw.slice(fmEnd);
  const line = `${key}: ${value}`;
  const existing = new RegExp(`^${key}:.*$`, 'm');
  if (existing.test(head)) {
    return head.replace(existing, line) + tail;
  }
  return `${head}\n${line}${tail}`;
}

function removeFrontmatterField(raw, key) {
  const fmEnd = raw.indexOf('\n---', 3);
  if (!raw.startsWith('---') || fmEnd === -1) return raw;
  const head = raw.slice(0, fmEnd);
  const tail = raw.slice(fmEnd);
  return head.replace(new RegExp(`^${key}:.*\\n?`, 'm'), '') + tail;
}

/**
 * Update story status (writes back to file).
 *
 * opts.owner        - record the holder of the claim
 * opts.claimedAt    - ISO timestamp for the claim
 * opts.closedReason - required when moving to `closed`
 */
function setStatus(filePath, newStatus, opts = {}) {
  if (!VALID_STATUSES.includes(newStatus)) {
    throw new Error(`invalid status: ${newStatus}`);
  }
  if (newStatus === 'closed' && !opts.closedReason) {
    throw new Error('closing a unit requires a closed-reason');
  }
  let raw = fs.readFileSync(filePath, 'utf8');
  raw = setFrontmatterField(raw, 'status', newStatus);
  if (opts.owner) raw = setFrontmatterField(raw, 'owner', opts.owner);
  if (opts.claimedAt) raw = setFrontmatterField(raw, 'claimed-at', opts.claimedAt);
  if (opts.closedReason) {
    raw = setFrontmatterField(raw, 'closed-reason', `"${String(opts.closedReason).replace(/"/g, "'")}"`);
  }
  fs.writeFileSync(filePath, raw);
  return { path: filePath, newStatus };
}

/**
 * Claim a unit before doing any work on it, so a concurrent session skips it.
 * Refuses to steal a live claim held by someone else; a stale claim can be
 * taken with { force: true }.
 */
function claim(filePath, owner, opts = {}) {
  if (!owner) throw new Error('claim requires an owner');
  const story = parseStory(filePath);
  if (story.errors && story.errors.length > 0) {
    throw new Error(`cannot claim unparseable unit: ${story.errors.join(', ')}`);
  }
  if (story.status === 'in-progress' && story.owner && story.owner !== owner) {
    if (!opts.force && !isClaimStale(story, opts.ttlMinutes)) {
      throw new Error(`already claimed by ${story.owner}`);
    }
  }
  const claimedAt = opts.claimedAt || new Date().toISOString();
  return setStatus(filePath, 'in-progress', { owner, claimedAt });
}

/**
 * Drop a claim without resolving the unit. Returns it to the frontier.
 */
function release(filePath) {
  let raw = fs.readFileSync(filePath, 'utf8');
  raw = setFrontmatterField(raw, 'status', 'pending');
  raw = removeFrontmatterField(raw, 'owner');
  raw = removeFrontmatterField(raw, 'claimed-at');
  fs.writeFileSync(filePath, raw);
  return { path: filePath, newStatus: 'pending' };
}

/**
 * Rule a unit beyond the destination. Terminal: a closed unit never returns
 * to the frontier and never enters the decisions log, because a scope
 * boundary is not a step on the route.
 */
function close(filePath, reason) {
  if (!reason) throw new Error('closing a unit requires a reason');
  return setStatus(filePath, 'closed', { closedReason: reason });
}

/**
 * Detect dep cycles.
 */
function detectDepCycles(projectRoot) {
  const stories = listStories(projectRoot);
  const byId = {};
  for (const s of stories) byId[s.id] = s;
  const visited = new Set();
  const stack = new Set();
  const cycles = [];
  function dfs(id, path) {
    if (stack.has(id)) {
      cycles.push([...path, id]);
      return;
    }
    if (visited.has(id)) return;
    visited.add(id);
    stack.add(id);
    const s = byId[id];
    if (s && s.deps) {
      for (const dep of s.deps) {
        if (byId[dep]) dfs(dep, [...path, id]);
      }
    }
    stack.delete(id);
  }
  for (const s of stories) dfs(s.id, []);
  return cycles;
}

module.exports = {
  parseStory,
  validateStory,
  findStoryFiles,
  listStories,
  listByStatus,
  listByKind,
  frontier,
  findDanglingDeps,
  isClaimStale,
  detectDepCycles,
  setStatus,
  claim,
  release,
  close,
  isValidId,
  isDecisionKind,
  isHitl,
  normalizeKind,
  storiesDir,
  VALID_STATUSES,
  TERMINAL_STATUSES,
  VALID_KINDS,
  DECISION_KINDS,
  DEFAULT_KIND,
  HITL_DEFAULT_BY_KIND,
  CLAIM_TTL_MINUTES,
  ID_PATTERN,
  USER_STORY_PATTERN
};
