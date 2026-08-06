#!/usr/bin/env node
/**
 * Improvement-proposal pipeline tests.
 *
 * The learning loop may draft prompt-surface changes but only escalate them;
 * a human applies them in /god-review-changes. These tests pin the contract:
 * prompt-surface scoping, review-queue round-trip, the staged severity (a
 * dual-state pin cloned from scripts/test-gate-tripwires.js so promoting
 * 'warning' to 'error' is a deliberate tested transition), surgical queue
 * removal, staleness refusal, dedupe, and the open-proposal cap.
 */

const fs = require('fs');
const path = require('path');

const proposals = require('../lib/improvement-proposals');
const reviewRequired = require('../lib/review-required');
const artifactMap = require('../lib/artifact-map');
const router = require('../lib/router');
const events = require('../lib/events');
const { test, assert, mkProject, report } = require('./test-harness');

console.log('\n  Improvement-proposal pipeline tests\n');

function mkPromptProject() {
  const project = mkProject('godpowers-proposals-');
  fs.mkdirSync(path.join(project, 'skills'), { recursive: true });
  fs.writeFileSync(path.join(project, 'skills', 'god-example.md'), '# Example skill\n\nOriginal body.\n');
  return project;
}

function draft(project, overrides = {}) {
  return proposals.propose(project, {
    targetFile: 'skills/god-example.md',
    rationale: 'Lesson: the example skill misses a verification step',
    patchText: '--- a/skills/god-example.md\n+++ b/skills/god-example.md\n+Add a verify step.\n',
    ...overrides
  });
}

test('prompt surfaces declare frozen cadence without touching the tier gate map', () => {
  assert(artifactMap.promptCadence('skills/god-build.md') === 'frozen', 'skills/ should be frozen');
  assert(artifactMap.promptCadence('specialists/god-planner.md') === 'frozen', 'specialists/ should be frozen');
  assert(artifactMap.promptCadence('references/shared/VOICE.md') === 'frozen', 'references/ should be frozen');
  assert(artifactMap.promptCadence('lib/state.js') === null, 'lib/ is not a prompt surface');
  assert(artifactMap.cadenceForArtifact('skills/god-build.md') === null,
    'prompt surfaces must NOT leak into TIER_ARTIFACTS cadence lookups');
  for (const tier of artifactMap.tiers()) {
    for (const artifact of artifactMap.artifactsForTier(tier)) {
      assert(!artifact.path.startsWith('skills/') && !artifact.path.startsWith('specialists/'),
        `gate consumer would see prompt file ${artifact.path}`);
    }
  }
});

test('propose refuses targets outside the declared prompt surfaces', () => {
  const project = mkPromptProject();
  fs.mkdirSync(path.join(project, 'lib'), { recursive: true });
  fs.writeFileSync(path.join(project, 'lib', 'state.js'), 'module.exports = {};\n');
  let threw = false;
  try {
    draft(project, { targetFile: 'lib/state.js' });
  } catch (e) {
    threw = true;
    assert(e.message.includes('prompt surface'), `unexpected refusal: ${e.message}`);
  }
  assert(threw, 'propose must refuse a non-prompt-surface target');
});

test('propose refuses traversal paths that dress runtime code as a prompt surface', () => {
  const project = mkPromptProject();
  fs.mkdirSync(path.join(project, 'lib'), { recursive: true });
  fs.writeFileSync(path.join(project, 'lib', 'secret.js'), 'module.exports = {};\n');
  for (const evil of ['skills/../lib/secret.js', 'skills\\..\\lib\\secret.js', '../outside.md']) {
    let threw = false;
    try {
      draft(project, { targetFile: evil });
    } catch (e) {
      threw = true;
    }
    assert(threw, `propose must refuse traversal target: ${evil}`);
  }
  assert(artifactMap.promptCadence('skills/../lib/secret.js') === null,
    'promptCadence must not grant frozen cadence to a traversal path');
});

test('a malformed proposal record is skipped, not counted against the open limit', () => {
  const project = mkPromptProject();
  fs.mkdirSync(proposals.proposalsDir(project), { recursive: true });
  fs.writeFileSync(path.join(proposals.proposalsDir(project), 'stray.json'), '{}');
  assert(proposals.list(project, { status: 'open' }).length === 0,
    'a shapeless record must not appear in list()');
  assert(proposals.render(proposals.list(project)).includes('(none)'),
    'render must not crash on a corrupt store');
  const record = draft(project);
  assert(record.status === 'open', 'a stray file must not consume the open-limit slot');
});

test('propose writes the record, queues a review item, and emits proposal.proposed', () => {
  const project = mkPromptProject();
  const record = draft(project);
  assert(record.status === 'open', `status=${record.status}`);
  assert(fs.existsSync(record.file), 'proposal JSON must exist');
  assert(record.targetHash.startsWith('sha256:'), 'record must carry the target hash');

  const entries = reviewRequired.readEntries(project);
  assert(entries.length === 1, `expected one batch, got ${entries.length}`);
  assert(entries[0].source === 'improvement-proposal', `source=${entries[0].source}`);
  assert(entries[0].items.length === 1, 'the proposal item must round-trip through readEntries');
  assert(entries[0].items[0].severity === proposals.PROPOSAL_SEVERITY,
    `item severity=${entries[0].items[0].severity}`);
  assert(reviewRequired.itemCount(project) === 1, 'itemCount must see the proposal');

  const all = events.listRuns(project).flatMap((run) => events.readRun(project, run));
  assert(all.some((e) => e.name === 'proposal.proposed'), 'proposal.proposed must reach the ledger');
  assert(!all.some((e) => e.name && e.name.startsWith('change.')),
    'proposal activity must never emit change.* events');
});

test('staged severity: dual-state pin for the warning-to-error promotion', () => {
  const project = mkPromptProject();
  draft(project);
  // detectSafeSyncBlocker is the exported router surface that consults the
  // review queue first; a review-required blocker carries
  // blocker === 'review-required'.
  const reviewBlocker = (candidate) =>
    candidate && candidate.blocker === 'review-required' ? candidate : null;
  const blocker = reviewBlocker(router.detectSafeSyncBlocker(project));
  // Both states are pinned so the promotion is a deliberate, tested
  // transition rather than silent behavior drift (the
  // ATTESTATION_GAP_SEVERITY pattern).
  if (proposals.PROPOSAL_SEVERITY === 'error') {
    assert(blocker, 'an error-severity proposal must block Tier 3 work');
  } else {
    assert(proposals.PROPOSAL_SEVERITY === 'warning',
      `unexpected proposal severity: ${proposals.PROPOSAL_SEVERITY}`);
    assert(blocker === null, 'a warning-severity proposal must not block Tier 3 work');
  }
  // Live proof the gate itself works (not just the null branch): a synthetic
  // error-severity batch in the same queue must produce the review blocker.
  reviewRequired.appendBatch(project, {
    source: 'test-synthetic',
    summary: 'synthetic error item',
    items: [{ id: 'synthetic-1', file: 'DESIGN.md', severity: 'error', message: 'synthetic' }]
  });
  const errorBlocker = reviewBlocker(router.detectSafeSyncBlocker(project));
  assert(errorBlocker, 'the review-queue gate went blind: an error-severity item did not block');
  assert(errorBlocker.command === '/god-review-changes', `command=${errorBlocker.command}`);
});

test('dedupe: an identical open proposal is refused', () => {
  const project = mkPromptProject();
  draft(project);
  let threw = false;
  try {
    draft(project);
  } catch (e) {
    threw = true;
    assert(e.message.includes('identical open proposal'), `unexpected: ${e.message}`);
  }
  assert(threw, 'duplicate proposal must be refused');
});

test('open-proposal cap: proposal-open-limit refuses a second concurrent proposal', () => {
  const project = mkPromptProject();
  fs.writeFileSync(path.join(project, 'skills', 'god-other.md'), '# Other skill\n');
  draft(project);
  let threw = false;
  try {
    draft(project, { targetFile: 'skills/god-other.md', patchText: '+different\n' });
  } catch (e) {
    threw = true;
    assert(e.message.includes('proposal-open-limit'), `unexpected: ${e.message}`);
  }
  assert(threw, 'the default one-at-a-time cap must refuse a second open proposal');
});

test('decide accepted moves the record, emits the event, and surgically clears the queue', () => {
  const project = mkPromptProject();
  // A foreign batch that must survive the proposal decision byte-identical.
  reviewRequired.appendBatch(project, {
    source: 'reverse-sync',
    summary: 'unrelated drift',
    items: [{ id: 'drift-1', file: 'DESIGN.md', severity: 'warning', message: 'token changed' }]
  });
  const record = draft(project);
  const before = fs.readFileSync(reviewRequired.path(project), 'utf8');
  assert(before.includes('drift-1') && before.includes(record.id), 'both items should be queued');
  // Capture the foreign batch's exact section text so byte-identity is
  // VERIFIED, not just asserted in prose. A parse-and-rewrite removeItem
  // would normalize this text and fail here.
  const foreignStart = before.indexOf('## Batch:');
  const foreignEnd = before.indexOf('## Batch:', foreignStart + 1);
  const foreignSection = before.slice(foreignStart, foreignEnd);
  assert(foreignSection.includes('drift-1'), 'test setup: first section should be the foreign batch');

  const decided = proposals.decide(project, record.id, { status: 'accepted', reason: 'looks right' });
  assert(decided.status === 'accepted', `status=${decided.status}`);
  assert(!fs.existsSync(record.file), 'open record must be gone');
  assert(fs.existsSync(path.join(proposals.decidedDir(project), `${record.id}.json`)),
    'decided record must exist');

  const entries = reviewRequired.readEntries(project);
  assert(entries.length === 1, `foreign batch must survive, got ${entries.length} batches`);
  assert(entries[0].items.some((i) => i.id === 'drift-1'), 'foreign pending item must not be dropped');
  const after = fs.readFileSync(reviewRequired.path(project), 'utf8');
  assert(!after.includes(record.id), 'the proposal item must be removed');
  // trimEnd: the blank separator line at the section boundary belongs to the
  // removed trailing batch; every interior byte of the foreign section must
  // survive unchanged (a parse-and-rewrite would normalize it and fail here).
  assert(after.includes(foreignSection.trimEnd()),
    'the foreign batch section must survive byte-identical');

  const all = events.listRuns(project).flatMap((run) => events.readRun(project, run));
  assert(all.some((e) => e.name === 'proposal.accepted'), 'proposal.accepted must reach the ledger');
  // Classification-side pin for the metric boundary: proposal.* events must
  // be invisible to the accepted-change classifier, not merely differently
  // named.
  const changeMetrics = require('../lib/change-metrics');
  const changeSummary = changeMetrics.classify(all);
  assert(changeSummary.decided === 0 && changeSummary.proposed === 0,
    `proposal events leaked into change metrics: ${JSON.stringify(changeSummary)}`);
});

test('removeItem keeps a batch that still has other items', () => {
  const project = mkProject('godpowers-remove-keep-');
  reviewRequired.appendBatch(project, {
    source: 'multi-item',
    summary: 'two items, one leaves',
    items: [
      { id: 'keep-1', file: 'a.md', severity: 'warning', message: 'stays', suggestion: 'keep me' },
      { id: 'drop-1', file: 'b.md', severity: 'warning', message: 'goes', suggestion: 'drop me' }
    ]
  });
  const result = reviewRequired.removeItem(project, 'multi-item', 'drop-1');
  assert(result.removed === true && result.batchRemoved === false && result.fileRemoved === false,
    `unexpected result: ${JSON.stringify(result)}`);
  const entries = reviewRequired.readEntries(project);
  assert(entries.length === 1, 'the batch must survive');
  assert(entries[0].items.length === 1 && entries[0].items[0].id === 'keep-1',
    `wrong survivors: ${JSON.stringify(entries[0].items)}`);
  const text = fs.readFileSync(reviewRequired.path(project), 'utf8');
  assert(!text.includes('drop me'), 'the removed item suggestion line must go with it');
  assert(text.includes('keep me'), 'the surviving item suggestion must stay');
});

test('removeItem matches source literally, never as a regex', () => {
  const project = mkProject('godpowers-remove-literal-');
  reviewRequired.appendBatch(project, {
    source: 'sync (auto)',
    summary: 'source with regex metacharacters',
    items: [{ id: 'meta-1', file: 'c.md', severity: 'warning', message: 'metachar source' }]
  });
  const result = reviewRequired.removeItem(project, 'sync (auto)', 'meta-1');
  assert(result.removed === true, 'a parenthesized source must match literally');
});

test('decide refuses to accept a stale proposal', () => {
  const project = mkPromptProject();
  const record = draft(project);
  fs.appendFileSync(path.join(project, 'skills', 'god-example.md'), '\nDrifted since drafting.\n');
  assert(proposals.isStale(project, record) === true, 'the proposal should read as stale');
  let threw = false;
  try {
    proposals.decide(project, record.id, { status: 'accepted' });
  } catch (e) {
    threw = true;
    assert(e.message.includes('stale'), `unexpected: ${e.message}`);
  }
  assert(threw, 'a stale accept must be refused');
  // Rejecting a stale proposal stays allowed.
  const rejected = proposals.decide(project, record.id, { status: 'rejected', reason: 'stale' });
  assert(rejected.status === 'rejected', 'stale proposals can still be rejected');
});

test('removeItem on the last batch deletes the ledger like clear()', () => {
  const project = mkPromptProject();
  const record = draft(project);
  proposals.decide(project, record.id, { status: 'rejected', reason: 'not needed' });
  assert(!fs.existsSync(reviewRequired.path(project)),
    'an empty queue file must be deleted, matching the clear() contract');
});

report('Improvement-proposal pipeline tests');
