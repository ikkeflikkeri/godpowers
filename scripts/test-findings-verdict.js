#!/usr/bin/env node

const path = require('path');

const findingsVerdict = require('../lib/findings-verdict');
const router = require('../lib/router');
const prepublication = require('../lib/prepublication-gate');
const { test, assert, mkProject, writeRel, report } = require('./test-harness');

const ACCEPTED_RISK_FINDINGS = [
  '# Security Findings',
  '',
  '| Severity | Count |',
  '|---|---:|',
  '| Critical | 1 |',
  '',
  '### [CRITICAL-001] Session fixation on login',
  '',
  '- [DECISION] Status: Accepted-Risk.',
  '- [DECISION] Accepted by the human on 2026-08-01 with a compensating control.'
].join('\n');

const SELF_PASSED_FINDINGS = [
  '# Security Findings',
  '',
  '[DECISION] Launch gate: PASSED.',
  '',
  '| Severity | Count |',
  '|---|---:|',
  '| Critical | 1 |',
  '',
  '### [CRITICAL-001] Auth bypass',
  '',
  '- [DECISION] Status: Open.'
].join('\n');

test('policy names are pinned', () => {
  assert(JSON.stringify(findingsVerdict.POLICIES) === JSON.stringify(['launch', 'publication']),
    `unexpected policies: ${JSON.stringify(findingsVerdict.POLICIES)}`);
  let threw = false;
  try {
    findingsVerdict.counts(findingsVerdict.parse(''), 'ship-it');
  } catch (_e) {
    threw = true;
  }
  assert(threw, 'unknown policy must throw');
});

test('the same accepted-risk document passes launch and blocks publication', () => {
  const parsed = findingsVerdict.parse(ACCEPTED_RISK_FINDINGS);
  const launch = findingsVerdict.evaluate(parsed, 'launch');
  const publication = findingsVerdict.evaluate(parsed, 'publication');
  assert(launch.pass === true, `launch policy should pass accepted risk: ${JSON.stringify(launch.reasons)}`);
  assert(publication.pass === false, 'publication policy must block accepted risk');
  assert(publication.criticals.unresolved === 1, 'accepted Critical must count as blocking for publication');
  assert(launch.criticals.unresolved === 0, 'accepted Critical must not count as blocking for launch');
});

test('an auditor-authored PASSED line never satisfies a gate', () => {
  const parsed = findingsVerdict.parse(SELF_PASSED_FINDINGS);
  for (const policy of findingsVerdict.POLICIES) {
    const result = findingsVerdict.evaluate(parsed, policy);
    assert(result.pass === false, `${policy} must fail on PASSED line above an open Critical`);
    assert(result.summaryConflict === true, `${policy} should report the summary conflict`);
  }
});

test('an explicit BLOCKED line blocks even with zero parsed Criticals', () => {
  const parsed = findingsVerdict.parse('# Findings\n\n[DECISION] Launch gate: BLOCKED.\n');
  const result = findingsVerdict.evaluate(parsed, 'launch');
  assert(result.pass === false, 'self-blocking must be honored');
});

test('missing findings artifact fails closed for both policies', () => {
  const parsed = findingsVerdict.parse(null);
  for (const policy of findingsVerdict.POLICIES) {
    assert(findingsVerdict.evaluate(parsed, policy).pass === false, `${policy} must fail on missing findings`);
  }
});

test('a clean findings document passes both policies', () => {
  const clean = [
    '# Security Findings',
    '',
    '| Severity | Count |',
    '|---|---:|',
    '| Critical | 0 |'
  ].join('\n');
  const parsed = findingsVerdict.parse(clean);
  for (const policy of findingsVerdict.POLICIES) {
    const result = findingsVerdict.evaluate(parsed, policy);
    assert(result.pass === true, `${policy} should pass a clean document: ${JSON.stringify(result.reasons)}`);
  }
});

test('a summary count above the classified sections blocks as unclassified', () => {
  const undercounted = [
    '| Severity | Count |',
    '|---|---:|',
    '| Critical | 2 |',
    '',
    '### [CRITICAL-001] Fixed one',
    '',
    'Status: Fixed.'
  ].join('\n');
  const parsed = findingsVerdict.parse(undercounted);
  assert(parsed.unclassified === 1, `expected 1 unclassified, got ${parsed.unclassified}`);
  assert(findingsVerdict.evaluate(parsed, 'launch').pass === false,
    'unclassified Criticals must block even under the launch policy');
});

test('router launch prerequisite and publication gate share the parser on the same project', () => {
  const project = mkProject('godpowers-findings-policy-');
  writeRel(project, '.godpowers/harden/FINDINGS.mdx', ACCEPTED_RISK_FINDINGS);
  assert(router.hasNoCriticalFindings(project) === true,
    'router launch prerequisite should honor human-accepted risk');
  const criticals = prepublication.parseCriticalFindings(ACCEPTED_RISK_FINDINGS);
  assert(criticals.unresolved === 1,
    'publication gate must still count the accepted Critical as blocking');
});

test('router no longer trusts the auditor-authored PASSED line', () => {
  const project = mkProject('godpowers-findings-self-pass-');
  writeRel(project, '.godpowers/harden/FINDINGS.mdx', SELF_PASSED_FINDINGS);
  assert(router.hasNoCriticalFindings(project) === false,
    'a PASSED summary line above an open Critical must not satisfy the launch prerequisite');
});

report('Findings verdict tests');
