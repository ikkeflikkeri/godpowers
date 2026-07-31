#!/usr/bin/env node
/**
 * Behavioral tests for lib/story-validator.js + linkage STORY pattern.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const validator = require('../lib/story-validator');
const linkage = require('../lib/linkage');
const scanner = require('../lib/code-scanner');
const { test, report } = require('./test-harness');


function mkProject() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'godpowers-story-test-'));
  fs.mkdirSync(path.join(tmp, '.godpowers', 'stories', 'auth'), { recursive: true });
  return tmp;
}

function mkStory(projectRoot, slug, num, fields = {}) {
  const id = fields.id || `STORY-${slug}-${String(num).padStart(3, '0')}`;
  const status = fields.status || 'pending';
  const title = fields.title || `Test story ${num}`;
  const owner = 'owner' in fields ? fields.owner : 'tester';
  const userStory = fields.userStory ||
    'As a tester, I want to write tests so that things work.';
  const acceptance = fields.acceptance ||
    '- [DECISION] Test passes. Acceptance: user clicks button, sees result.';

  const file = path.join(projectRoot, '.godpowers', 'stories', slug, `${id}.md`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const extra = [];
  if (owner) extra.push(`owner: ${owner}`);
  if (fields.kind) extra.push(`kind: ${fields.kind}`);
  if (fields.hitl !== undefined) extra.push(`hitl: ${fields.hitl}`);
  if (fields.claimedAt) extra.push(`claimed-at: ${fields.claimedAt}`);
  if (fields.closedReason) extra.push(`closed-reason: "${fields.closedReason}"`);
  fs.writeFileSync(file, `---
id: ${id}
title: "${title}"
status: ${status}
${extra.join('\n')}
deps: ${JSON.stringify(fields.deps || [])}
created: 2026-05-10
---

## User Story

${userStory}

## Acceptance Criteria

${acceptance}

## Slice Plan

1. Step 1
2. Step 2

## Notes

${fields.notes || ''}
`);
  return file;
}

/**
 * A decision unit: question-shaped, not user-story-shaped.
 */
function mkUnit(projectRoot, slug, num, fields = {}) {
  const id = fields.id || `STORY-${slug}-${String(num).padStart(3, '0')}`;
  const file = path.join(projectRoot, '.godpowers', 'stories', slug, `${id}.mdx`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const extra = [];
  if (fields.owner) extra.push(`owner: ${fields.owner}`);
  if (fields.hitl !== undefined) extra.push(`hitl: ${fields.hitl}`);
  if (fields.claimedAt) extra.push(`claimed-at: ${fields.claimedAt}`);
  if (fields.closedReason) extra.push(`closed-reason: "${fields.closedReason}"`);
  const sections = [];
  if (fields.question !== null) {
    sections.push(`## Question\n\n${fields.question || 'Should the queue be a Postgres table?'}`);
  }
  if (fields.answerShape !== null) {
    sections.push(`## What Would Answer It\n\n${fields.answerShape || 'A throughput measurement at expected peak.'}`);
  }
  if (fields.acceptance) {
    sections.push(`## Acceptance Criteria\n\n${fields.acceptance}`);
  }
  if (fields.answer) {
    sections.push(`## Answer\n\n${fields.answer}`);
  }
  fs.writeFileSync(file, `---
id: ${id}
title: "${fields.title || `Decision unit ${num}`}"
kind: ${fields.kind || 'decision'}
status: ${fields.status || 'pending'}
${extra.join('\n')}
deps: ${JSON.stringify(fields.deps || [])}
chart: CHART-${slug}
created: 2026-05-10
---

${sections.join('\n\n')}
`);
  return file;
}

console.log('\n  Story validator behavioral tests\n');

// ============================================================================
// isValidId
// ============================================================================

test('isValidId accepts STORY-{slug}-{NNN}', () => {
  if (!validator.isValidId('STORY-auth-001')) throw new Error('rejected valid');
  if (!validator.isValidId('STORY-billing-mrr-042')) throw new Error('rejected valid');
});

test('isValidId rejects garbage', () => {
  if (validator.isValidId('story-auth-001')) throw new Error('lowercase accepted');
  if (validator.isValidId('STORY-auth')) throw new Error('missing number accepted');
  if (validator.isValidId('STORY-001')) throw new Error('missing slug accepted');
  if (validator.isValidId('AUTH-001')) throw new Error('wrong prefix accepted');
});

// ============================================================================
// parseStory
// ============================================================================

test('parseStory extracts frontmatter and sections', () => {
  const tmp = mkProject();
  const file = mkStory(tmp, 'auth', 1);
  const story = validator.parseStory(file);
  if (story.id !== 'STORY-auth-001') throw new Error('id wrong');
  if (story.status !== 'pending') throw new Error('status wrong');
  if (!story.sections['User Story']) throw new Error('User Story missing');
  if (!story.sections['Acceptance Criteria']) throw new Error('AC missing');
});

test('parseStory handles deps as array', () => {
  const tmp = mkProject();
  const file = mkStory(tmp, 'auth', 2, { deps: ['STORY-auth-001'] });
  const story = validator.parseStory(file);
  if (!Array.isArray(story.deps)) throw new Error('not array');
  if (!story.deps.includes('STORY-auth-001')) throw new Error('dep missing');
});

test('parseStory returns error for missing frontmatter', () => {
  const tmp = mkProject();
  const file = path.join(tmp, '.godpowers/stories/auth/STORY-auth-999.mdx');
  fs.writeFileSync(file, '# No frontmatter\n');
  const story = validator.parseStory(file);
  if (!story.errors.includes('missing-frontmatter')) throw new Error('not detected');
});

// ============================================================================
// validateStory
// ============================================================================

test('validateStory accepts well-formed story', () => {
  const tmp = mkProject();
  const file = mkStory(tmp, 'auth', 1);
  const story = validator.parseStory(file);
  const findings = validator.validateStory(story);
  const errors = findings.filter(f => f.severity === 'error');
  if (errors.length > 0) throw new Error(`expected 0 errors, got ${errors.length}`);
});

test('validateStory flags missing user-story format', () => {
  const tmp = mkProject();
  const file = mkStory(tmp, 'auth', 1, {
    userStory: 'I want to do a thing.'  // no "As a" prefix
  });
  const story = validator.parseStory(file);
  const findings = validator.validateStory(story);
  if (!findings.find(f => f.kind === 'user-story-format')) {
    throw new Error('format not flagged');
  }
});

test('validateStory flags invalid status', () => {
  const tmp = mkProject();
  const file = mkStory(tmp, 'auth', 1, { status: 'wibbling' });
  const story = validator.parseStory(file);
  const findings = validator.validateStory(story);
  if (!findings.find(f => f.kind === 'invalid-status')) {
    throw new Error('not flagged');
  }
});

test('validateStory flags invalid id format', () => {
  const tmp = mkProject();
  const file = mkStory(tmp, 'auth', 1, { id: 'BadId' });
  const story = validator.parseStory(file);
  const findings = validator.validateStory(story);
  if (!findings.find(f => f.kind === 'invalid-id-format')) {
    throw new Error('not flagged');
  }
});

// ============================================================================
// listStories / listByStatus
// ============================================================================

test('listStories returns all stories', () => {
  const tmp = mkProject();
  mkStory(tmp, 'auth', 1);
  mkStory(tmp, 'auth', 2);
  mkStory(tmp, 'billing', 1);
  const stories = validator.listStories(tmp);
  if (stories.length !== 3) throw new Error(`expected 3, got ${stories.length}`);
});

test('listByStatus filters correctly', () => {
  const tmp = mkProject();
  mkStory(tmp, 'auth', 1, { status: 'pending' });
  mkStory(tmp, 'auth', 2, { status: 'in-progress' });
  mkStory(tmp, 'auth', 3, { status: 'done' });
  if (validator.listByStatus(tmp, 'pending').length !== 1) throw new Error('pending');
  if (validator.listByStatus(tmp, 'in-progress').length !== 1) throw new Error('in-progress');
  if (validator.listByStatus(tmp, 'done').length !== 1) throw new Error('done');
  if (validator.listByStatus(tmp, 'blocked').length !== 0) throw new Error('blocked');
});

// ============================================================================
// detectDepCycles
// ============================================================================

test('detectDepCycles returns empty when no cycles', () => {
  const tmp = mkProject();
  mkStory(tmp, 'auth', 1);
  mkStory(tmp, 'auth', 2, { deps: ['STORY-auth-001'] });
  mkStory(tmp, 'auth', 3, { deps: ['STORY-auth-002'] });
  const cycles = validator.detectDepCycles(tmp);
  if (cycles.length !== 0) throw new Error('false positive');
});

test('detectDepCycles finds simple cycle', () => {
  const tmp = mkProject();
  mkStory(tmp, 'auth', 1, { deps: ['STORY-auth-002'] });
  mkStory(tmp, 'auth', 2, { deps: ['STORY-auth-001'] });
  const cycles = validator.detectDepCycles(tmp);
  if (cycles.length === 0) throw new Error('cycle not detected');
});

// ============================================================================
// setStatus
// ============================================================================

test('setStatus updates the file', () => {
  const tmp = mkProject();
  const file = mkStory(tmp, 'auth', 1, { status: 'pending' });
  validator.setStatus(file, 'in-progress');
  const reread = validator.parseStory(file);
  if (reread.status !== 'in-progress') throw new Error('not updated');
});

test('setStatus rejects invalid status', () => {
  const tmp = mkProject();
  const file = mkStory(tmp, 'auth', 1);
  let threw = false;
  try { validator.setStatus(file, 'wibbling'); } catch (e) { threw = true; }
  if (!threw) throw new Error('should have thrown');
});

// ============================================================================
// linkage integration: STORY ID type
// ============================================================================

test('linkage.classifyId recognizes STORY-* IDs', () => {
  if (linkage.classifyId('STORY-auth-001') !== 'story') {
    throw new Error('STORY not classified as story');
  }
});

test('code-scanner picks up // Implements: STORY-auth-001 annotation', () => {
  const tmp = mkProject();
  fs.mkdirSync(path.join(tmp, 'src'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'src/login.ts'),
    '// Implements: STORY-auth-001\nexport function login() {}');
  const links = scanner.scanFile(path.join(tmp, 'src/login.ts'));
  if (!links.find(l => l.artifactId === 'STORY-auth-001')) {
    throw new Error('STORY annotation not picked up');
  }
});

test('linkage addLink/queryByArtifact works for STORY IDs', () => {
  const tmp = mkProject();
  linkage.addLink(tmp, 'STORY-auth-001', 'src/login.ts');
  const files = linkage.queryByArtifact(tmp, 'STORY-auth-001');
  if (!files.includes('src/login.ts')) throw new Error('linkage failed');
});

// ============================================================================
// Work-unit kinds
// ============================================================================

test('a unit with no kind is a slice (backward compatible)', () => {
  const tmp = mkProject();
  const file = mkStory(tmp, 'auth', 1);
  const story = validator.parseStory(file);
  if (story.kind !== 'slice') throw new Error(`expected slice, got ${story.kind}`);
  if (validator.isDecisionKind(story.kind)) throw new Error('slice classed as decision');
});

test('decision kinds are recognized', () => {
  for (const kind of ['decision', 'research', 'prototype', 'grilling', 'task']) {
    if (!validator.isDecisionKind(kind)) throw new Error(`${kind} not a decision kind`);
  }
  if (validator.isDecisionKind('slice')) throw new Error('slice misclassified');
});

test('a decision unit is checked against the question contract, not the user story one', () => {
  const tmp = mkProject();
  const file = mkUnit(tmp, 'queue', 1);
  const story = validator.parseStory(file);
  const findings = validator.validateStory(story);
  if (findings.find(f => f.kind === 'missing-user-story')) {
    throw new Error('decision unit judged against the slice contract');
  }
  if (findings.find(f => f.kind === 'missing-acceptance')) {
    throw new Error('decision unit required acceptance criteria');
  }
  const errors = findings.filter(f => f.severity === 'error');
  if (errors.length > 0) throw new Error(`expected 0 errors, got ${errors.map(e => e.kind).join(',')}`);
});

test('a decision unit missing Question or What Would Answer It is flagged', () => {
  const tmp = mkProject();
  const noQuestion = mkUnit(tmp, 'queue', 1, { question: null });
  const noShape = mkUnit(tmp, 'queue', 2, { answerShape: null });
  if (!validator.validateStory(validator.parseStory(noQuestion))
    .find(f => f.kind === 'missing-question')) {
    throw new Error('missing Question not flagged');
  }
  if (!validator.validateStory(validator.parseStory(noShape))
    .find(f => f.kind === 'missing-answer-shape')) {
    throw new Error('missing What Would Answer It not flagged');
  }
});

test('a decision unit carrying acceptance criteria is flagged as a disguised slice', () => {
  const tmp = mkProject();
  const file = mkUnit(tmp, 'queue', 1, { acceptance: '- [DECISION] User sees the queue.' });
  const findings = validator.validateStory(validator.parseStory(file));
  if (!findings.find(f => f.kind === 'decision-unit-with-acceptance')) {
    throw new Error('W-03 shape not flagged');
  }
});

test('a resolved decision unit with no Answer is flagged', () => {
  const tmp = mkProject();
  const noAnswer = mkUnit(tmp, 'queue', 1, { status: 'done', owner: 'tester' });
  const withAnswer = mkUnit(tmp, 'queue', 2, {
    status: 'done', owner: 'tester', answer: 'Postgres table; flip at 5k writes/s.'
  });
  if (!validator.validateStory(validator.parseStory(noAnswer))
    .find(f => f.kind === 'resolved-without-answer')) {
    throw new Error('resolved-without-answer not flagged');
  }
  if (validator.validateStory(validator.parseStory(withAnswer))
    .find(f => f.kind === 'resolved-without-answer')) {
    throw new Error('false positive on a unit that has an Answer');
  }
});

test('an unrecognized kind is an error but still reads as a slice', () => {
  const tmp = mkProject();
  const file = mkStory(tmp, 'auth', 1, { kind: 'wibbling' });
  const story = validator.parseStory(file);
  if (story.kind !== 'slice') throw new Error('unknown kind did not degrade to slice');
  if (!validator.validateStory(story).find(f => f.kind === 'invalid-kind')) {
    throw new Error('invalid kind not flagged');
  }
});

test('listByKind filters to one kind', () => {
  const tmp = mkProject();
  mkStory(tmp, 'auth', 1);
  mkUnit(tmp, 'queue', 1, { kind: 'research' });
  mkUnit(tmp, 'queue', 2, { kind: 'grilling' });
  if (validator.listByKind(tmp, 'research').length !== 1) throw new Error('research');
  if (validator.listByKind(tmp, 'slice').length !== 1) throw new Error('slice');
  if (validator.listByKind(tmp, 'decision').length !== 0) throw new Error('decision');
});

// ============================================================================
// Human in the loop
// ============================================================================

test('hitl defaults follow the kind', () => {
  const tmp = mkProject();
  const research = validator.parseStory(mkUnit(tmp, 'q', 1, { kind: 'research' }));
  const grilling = validator.parseStory(mkUnit(tmp, 'q', 2, { kind: 'grilling' }));
  const slice = validator.parseStory(mkStory(tmp, 'auth', 1));
  if (research.hitl) throw new Error('research should be agent-alone');
  if (!grilling.hitl) throw new Error('grilling should be human-in-the-loop');
  if (slice.hitl) throw new Error('slice should be agent-alone');
});

test('explicit hitl overrides the kind default', () => {
  const tmp = mkProject();
  const forced = validator.parseStory(mkUnit(tmp, 'q', 1, { kind: 'research', hitl: true }));
  const relaxed = validator.parseStory(mkUnit(tmp, 'q', 2, { kind: 'grilling', hitl: false }));
  if (!forced.hitl) throw new Error('explicit hitl:true ignored');
  if (relaxed.hitl) throw new Error('explicit hitl:false ignored');
});

// ============================================================================
// Closed: terminal out-of-scope state
// ============================================================================

test('closed is a valid status and requires a reason', () => {
  const tmp = mkProject();
  const withReason = mkUnit(tmp, 'q', 1, {
    status: 'closed', closedReason: 'beyond the destination'
  });
  const withoutReason = mkUnit(tmp, 'q', 2, { status: 'closed' });
  if (validator.validateStory(validator.parseStory(withReason))
    .find(f => f.kind === 'invalid-status')) {
    throw new Error('closed rejected as a status');
  }
  const findings = validator.validateStory(validator.parseStory(withoutReason));
  const finding = findings.find(f => f.kind === 'closed-without-reason');
  if (!finding) throw new Error('closed without reason not flagged');
  if (finding.severity !== 'error') throw new Error('should be an error');
});

test('close() writes the reason; setStatus refuses to close without one', () => {
  const tmp = mkProject();
  const file = mkUnit(tmp, 'q', 1);
  validator.close(file, 'sits past the destination');
  const reread = validator.parseStory(file);
  if (reread.status !== 'closed') throw new Error('not closed');
  if (!reread.closedReason.includes('past the destination')) throw new Error('reason not written');

  let threw = false;
  try { validator.setStatus(mkUnit(tmp, 'q', 2), 'closed'); } catch (e) { threw = true; }
  if (!threw) throw new Error('setStatus closed without a reason should throw');
});

// ============================================================================
// Claim before work
// ============================================================================

test('in-progress with no owner is an error, not a warning', () => {
  const tmp = mkProject();
  const file = mkStory(tmp, 'auth', 1, { status: 'in-progress', owner: '' });
  const finding = validator.validateStory(validator.parseStory(file))
    .find(f => f.kind === 'unclaimed-in-progress');
  if (!finding) throw new Error('unclaimed in-progress not flagged');
  if (finding.severity !== 'error') throw new Error('should be an error');
});

test('claim records the holder and the timestamp', () => {
  const tmp = mkProject();
  const file = mkStory(tmp, 'auth', 1, { owner: '' });
  validator.claim(file, 'alice');
  const reread = validator.parseStory(file);
  if (reread.status !== 'in-progress') throw new Error('status not set');
  if (reread.owner !== 'alice') throw new Error('owner not recorded');
  if (!reread.claimedAt) throw new Error('claimed-at not stamped');
});

test('claim refuses to steal a live claim but takes a stale one', () => {
  const tmp = mkProject();
  const live = mkStory(tmp, 'auth', 1, {
    status: 'in-progress', owner: 'alice', claimedAt: new Date().toISOString()
  });
  let threw = false;
  try { validator.claim(live, 'bob'); } catch (e) { threw = true; }
  if (!threw) throw new Error('live claim was stolen');

  const stale = mkStory(tmp, 'auth', 2, {
    status: 'in-progress', owner: 'alice',
    claimedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
  });
  validator.claim(stale, 'bob');
  if (validator.parseStory(stale).owner !== 'bob') throw new Error('stale claim not reclaimed');
});

test('isClaimStale treats an untimed claim as stale and a fresh one as live', () => {
  const tmp = mkProject();
  const untimed = validator.parseStory(
    mkStory(tmp, 'auth', 1, { status: 'in-progress', owner: 'alice' }));
  const fresh = validator.parseStory(mkStory(tmp, 'auth', 2, {
    status: 'in-progress', owner: 'alice', claimedAt: new Date().toISOString()
  }));
  const pending = validator.parseStory(mkStory(tmp, 'auth', 3));
  if (!validator.isClaimStale(untimed)) throw new Error('untimed claim treated as live');
  if (validator.isClaimStale(fresh)) throw new Error('fresh claim treated as stale');
  if (validator.isClaimStale(pending)) throw new Error('pending unit reported as a stale claim');
});

test('release returns a claimed unit to the frontier', () => {
  const tmp = mkProject();
  const file = mkStory(tmp, 'auth', 1, { owner: '' });
  validator.claim(file, 'alice');
  validator.release(file);
  const reread = validator.parseStory(file);
  if (reread.status !== 'pending') throw new Error('not returned to pending');
  if (reread.owner) throw new Error('owner not cleared');
  if (reread.claimedAt) throw new Error('claimed-at not cleared');
});

// ============================================================================
// Frontier and dangling deps
// ============================================================================

test('frontier is pending AND unblocked AND unclaimed', () => {
  const tmp = mkProject();
  mkStory(tmp, 'auth', 1, { status: 'done', owner: 'alice' });      // resolved dep
  mkStory(tmp, 'auth', 2, { deps: ['STORY-auth-001'], owner: '' }); // takeable
  mkStory(tmp, 'auth', 3, { deps: ['STORY-auth-004'], owner: '' }); // blocked
  mkStory(tmp, 'auth', 4, { owner: '' });                           // takeable
  mkStory(tmp, 'auth', 5, { owner: 'bob' });                        // claimed

  const ids = validator.frontier(tmp).map(s => s.id).sort();
  const expected = ['STORY-auth-002', 'STORY-auth-004'];
  if (JSON.stringify(ids) !== JSON.stringify(expected)) {
    throw new Error(`expected ${expected.join(',')}, got ${ids.join(',')}`);
  }
});

test('a dep closed as out of scope no longer blocks', () => {
  const tmp = mkProject();
  mkUnit(tmp, 'q', 1, { status: 'closed', closedReason: 'past the destination' });
  mkStory(tmp, 'q', 2, { deps: ['STORY-q-001'], owner: '' });
  const ids = validator.frontier(tmp).map(s => s.id);
  if (!ids.includes('STORY-q-002')) throw new Error('closed dep still blocking');
});

test('a dangling dep keeps a unit off the frontier and is reported', () => {
  const tmp = mkProject();
  mkStory(tmp, 'auth', 1, { deps: ['STORY-auth-999'], owner: '' });
  if (validator.frontier(tmp).length !== 0) {
    throw new Error('unit with a dangling dep was treated as unblocked');
  }
  const dangling = validator.findDanglingDeps(tmp);
  if (dangling.length !== 1) throw new Error(`expected 1 dangling dep, got ${dangling.length}`);
  if (dangling[0].dep !== 'STORY-auth-999') throw new Error('wrong dep reported');
});

test('findDanglingDeps is empty when every dep resolves', () => {
  const tmp = mkProject();
  mkStory(tmp, 'auth', 1);
  mkStory(tmp, 'auth', 2, { deps: ['STORY-auth-001'] });
  if (validator.findDanglingDeps(tmp).length !== 0) throw new Error('false positive');
});

// ============================================================================
// Authoring mode: the agent contract and the validator must agree
// ============================================================================

test('read mode keeps the slice section contract as warnings', () => {
  const tmp = mkProject();
  const file = path.join(tmp, '.godpowers/stories/auth/STORY-auth-050.mdx');
  fs.writeFileSync(file, `---
id: STORY-auth-050
title: "Legacy story"
status: pending
owner: tester
deps: []
created: 2026-05-10
---

## Notes

Written before the section contract existed.
`);
  const findings = validator.validateStory(validator.parseStory(file));
  if (findings.filter(f => f.severity === 'error').length > 0) {
    throw new Error('reading a legacy story produced errors');
  }
  if (!findings.find(f => f.kind === 'missing-user-story' && f.severity === 'warning')) {
    throw new Error('missing-user-story should still be reported as a warning');
  }
});

test('authoring mode promotes the slice section contract to errors', () => {
  const tmp = mkProject();
  const file = path.join(tmp, '.godpowers/stories/auth/STORY-auth-051.mdx');
  fs.writeFileSync(file, `---
id: STORY-auth-051
title: "New story"
status: pending
owner: tester
deps: []
created: 2026-05-10
---

## Notes

No User Story, no Acceptance Criteria.
`);
  const story = validator.parseStory(file);
  const findings = validator.validateForAuthoring(story);
  for (const kind of ['missing-user-story', 'missing-acceptance']) {
    const finding = findings.find(f => f.kind === kind);
    if (!finding) throw new Error(`${kind} not reported`);
    if (finding.severity !== 'error') throw new Error(`${kind} should be an error when authoring`);
  }
  // validateForAuthoring is the documented alias for the explicit option.
  const viaOption = validator.validateStory(story, { mode: 'authoring' });
  if (JSON.stringify(viaOption) !== JSON.stringify(findings)) {
    throw new Error('validateForAuthoring and { mode: authoring } disagree');
  }
});

test('authoring mode promotes the decision-unit section contract too', () => {
  const tmp = mkProject();
  const file = mkUnit(tmp, 'q', 1, { question: null, answerShape: null });
  const findings = validator.validateForAuthoring(validator.parseStory(file));
  for (const kind of ['missing-question', 'missing-answer-shape']) {
    const finding = findings.find(f => f.kind === kind);
    if (!finding) throw new Error(`${kind} not reported`);
    if (finding.severity !== 'error') throw new Error(`${kind} should be an error when authoring`);
  }
});

test('authoring mode does not fail a well-formed unit of either shape', () => {
  const tmp = mkProject();
  const slice = validator.parseStory(mkStory(tmp, 'auth', 1));
  const unit = validator.parseStory(mkUnit(tmp, 'q', 1));
  for (const [label, story] of [['slice', slice], ['decision unit', unit]]) {
    const errors = validator.validateForAuthoring(story).filter(f => f.severity === 'error');
    if (errors.length > 0) {
      throw new Error(`well-formed ${label} rejected: ${errors.map(e => e.kind).join(',')}`);
    }
  }
});

test('resolution findings stay warnings in both modes', () => {
  const tmp = mkProject();
  const story = validator.parseStory(
    mkUnit(tmp, 'q', 1, { status: 'done', owner: 'tester' }));
  for (const findings of [validator.validateStory(story), validator.validateForAuthoring(story)]) {
    const finding = findings.find(f => f.kind === 'resolved-without-answer');
    if (!finding) throw new Error('resolved-without-answer not reported');
    if (finding.severity !== 'warning') {
      throw new Error('a unit is written open and answered later; this is not an authoring defect');
    }
  }
});

test('structural findings are errors regardless of mode', () => {
  const tmp = mkProject();
  const story = validator.parseStory(mkStory(tmp, 'auth', 1, { status: 'wibbling' }));
  for (const findings of [validator.validateStory(story), validator.validateForAuthoring(story)]) {
    const finding = findings.find(f => f.kind === 'invalid-status');
    if (!finding || finding.severity !== 'error') throw new Error('invalid-status should always be an error');
  }
});

report();
