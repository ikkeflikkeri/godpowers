#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const integrity = require('../lib/repair-integrity');
const repair = require('../lib/executor-repair');
const { test, assert, mkProject, writeRel, report } = require('./test-harness');

function seedProject() {
  const project = mkProject('godpowers-repair-integrity-');
  writeRel(project, 'package.json', JSON.stringify({
    name: 'fixture',
    scripts: { 'coverage': 'c8 --check-coverage --lines 90 --branches 75 node run-tests.js' }
  }, null, 2));
  writeRel(project, 'src/app.js', 'module.exports = () => 42;\n');
  writeRel(project, 'tests/app.test.js', "test('answers', () => {});\ntest('rounds', () => {});\n");
  writeRel(project, 'test_units.py', 'def test_units():\n    assert True\n');
  writeRel(project, 'parser_test.go', 'func TestParser(t *testing.T) {}\n');
  return project;
}

test('snapshot finds test files across language conventions', () => {
  const project = seedProject();
  const snap = integrity.snapshot(project);
  assert(snap.testFiles.length === 3, `expected 3 test files, got ${JSON.stringify(snap.testFiles)}`);
  assert(snap.testFiles.some((rel) => rel.endsWith('app.test.js')), 'js test file missed');
  assert(snap.testFiles.some((rel) => rel.endsWith('test_units.py')), 'pytest file missed');
  assert(snap.testFiles.some((rel) => rel.endsWith('parser_test.go')), 'go test file missed');
  assert(snap.skipMarkers === 0, `expected 0 skip markers, got ${snap.skipMarkers}`);
  assert(snap.coverageThresholds['package.json:coverage:--lines'] === 90,
    `lines threshold missed: ${JSON.stringify(snap.coverageThresholds)}`);
});

test('an unchanged tree is ok', () => {
  const project = seedProject();
  const before = integrity.snapshot(project);
  const result = integrity.compare(before, integrity.snapshot(project));
  assert(result.verdict === 'ok', `unchanged tree should be ok: ${JSON.stringify(result.reasons)}`);
});

test('deleting a test file makes the green suspect', () => {
  const project = seedProject();
  const before = integrity.snapshot(project);
  fs.rmSync(path.join(project, 'tests', 'app.test.js'));
  const result = integrity.compare(before, integrity.snapshot(project));
  assert(result.verdict === 'suspect', 'deletion should be suspect');
  assert(result.reasons.some((reason) => reason.includes('app.test.js')),
    `reason should name the missing file: ${JSON.stringify(result.reasons)}`);
});

test('renaming a test file stays quiet', () => {
  const project = seedProject();
  const before = integrity.snapshot(project);
  fs.renameSync(path.join(project, 'tests', 'app.test.js'), path.join(project, 'tests', 'core.test.js'));
  const result = integrity.compare(before, integrity.snapshot(project));
  assert(result.verdict === 'ok', `rename must not be suspect: ${JSON.stringify(result.reasons)}`);
});

test('adding a skip marker makes the green suspect', () => {
  const project = seedProject();
  const before = integrity.snapshot(project);
  writeRel(project, 'tests/app.test.js', "test('answers', () => {});\ntest.skip('rounds', () => {});\n");
  const result = integrity.compare(before, integrity.snapshot(project));
  assert(result.verdict === 'suspect', 'added skip should be suspect');
  assert(result.reasons.some((reason) => reason.includes('skip markers')),
    `reason should name the counter: ${JSON.stringify(result.reasons)}`);
});

test('lowering or removing a coverage threshold makes the green suspect', () => {
  const project = seedProject();
  const before = integrity.snapshot(project);
  writeRel(project, 'package.json', JSON.stringify({
    name: 'fixture',
    scripts: { 'coverage': 'c8 --check-coverage --lines 70 --branches 75 node run-tests.js' }
  }, null, 2));
  const lowered = integrity.compare(before, integrity.snapshot(project));
  assert(lowered.verdict === 'suspect', 'lowered threshold should be suspect');
  assert(lowered.reasons.some((reason) => reason.includes('lowered from 90 to 70')),
    `reason should show the drop: ${JSON.stringify(lowered.reasons)}`);

  writeRel(project, 'package.json', JSON.stringify({
    name: 'fixture',
    scripts: { 'coverage': 'c8 node run-tests.js' }
  }, null, 2));
  const removed = integrity.compare(before, integrity.snapshot(project));
  assert(removed.verdict === 'suspect', 'removed threshold should be suspect');
  assert(removed.reasons.some((reason) => reason.includes('was removed')),
    `reason should flag removal: ${JSON.stringify(removed.reasons)}`);
});

test('pytest and go skip markers are counted', () => {
  const project = seedProject();
  const before = integrity.snapshot(project);
  writeRel(project, 'test_units.py', 'import pytest\n@pytest.mark.skip\ndef test_units():\n    assert True\n');
  writeRel(project, 'parser_test.go', 'func TestParser(t *testing.T) { t.Skip("later") }\n');
  const after = integrity.snapshot(project);
  assert(after.skipMarkers === before.skipMarkers + 2,
    `expected two new skip markers, got ${before.skipMarkers} -> ${after.skipMarkers}`);
});

test('a suspect green escalates in classifyFailure regardless of budget', () => {
  const decision = repair.classifyFailure({
    attempts: 0,
    budget: 3,
    error: '',
    integrity: { verdict: 'suspect', reasons: ['skip markers rose from 0 to 2'] }
  });
  assert(decision.strategy === repair.STRATEGIES.ESCALATE, 'suspect green must escalate');
  assert(decision.reason.includes('skip markers rose'), `reason should carry the counter: ${decision.reason}`);
  const clean = repair.classifyFailure({
    attempts: 0,
    budget: 3,
    error: 'tests fail: assertion mismatch',
    integrity: { verdict: 'ok', reasons: [] }
  });
  assert(clean.strategy !== repair.STRATEGIES.ESCALATE, 'an ok integrity verdict must not escalate on its own');
});

report('Repair integrity tests');
