#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const loopConfig = require('../lib/loop-config');
const repair = require('../lib/executor-repair');
const router = require('../lib/router');
const reviewRequired = require('../lib/review-required');
const { test, assert, mkProject, writeRel, report } = require('./test-harness');

test('defaults resolve without any intent.yaml', () => {
  const project = mkProject('godpowers-loop-config-none-');
  const params = loopConfig.read(project);
  assert(params['repair-attempts'] === 3, `repair-attempts default: ${params['repair-attempts']}`);
  assert(params['outcome-budget'] === 3, 'outcome-budget default');
  assert(params['accepted-change-target'] === 0.5, 'accepted-change-target default');
  assert(params['checkpoint-fresh-hours'] === 24, 'checkpoint-fresh-hours default');
  assert(params['hygiene-fresh-days'] === 30, 'hygiene-fresh-days default');
  assert(params['reaudit-cadence-days'] === 30, 'reaudit-cadence-days default');
});

test('set persists only overrides and read merges them back', () => {
  const project = mkProject('godpowers-loop-config-set-');
  writeRel(project, '.godpowers/intent.yaml', [
    'apiVersion: godpowers/v1',
    'kind: Project',
    'metadata:',
    '  name: loop-config-test',
    'mode: A',
    'scale: small',
    ''
  ].join('\n'));
  loopConfig.set(project, { 'repair-attempts': 5 });
  const raw = fs.readFileSync(path.join(project, '.godpowers', 'intent.yaml'), 'utf8');
  assert(/loop-params:\n  repair-attempts: 5/.test(raw), `block not written: ${raw}`);
  assert(!/outcome-budget/.test(raw), 'defaults must not be persisted as overrides');
  const params = loopConfig.read(project);
  assert(params['repair-attempts'] === 5, 'override should win');
  assert(params['outcome-budget'] === 3, 'untouched keys keep defaults');
  assert(loopConfig.value(project, 'repair-attempts') === 5, 'value() resolves the override');
});

test('setting a knob back to its default removes the override block', () => {
  const project = mkProject('godpowers-loop-config-reset-');
  loopConfig.set(project, { 'repair-attempts': 5 });
  loopConfig.set(project, { 'repair-attempts': 3 });
  const raw = fs.readFileSync(path.join(project, '.godpowers', 'intent.yaml'), 'utf8');
  assert(!/loop-params:/.test(raw), `default-valued override should not persist: ${raw}`);
});

test('a reasoned change is appended to SYNC-LOG.mdx', () => {
  const project = mkProject('godpowers-loop-config-reason-');
  writeRel(project, '.godpowers/SYNC-LOG.mdx', '# Sync Log\n');
  loopConfig.set(project, { 'repair-attempts': 4 }, { reason: 'flaky CI needs one more try' });
  const log = fs.readFileSync(path.join(project, '.godpowers', 'SYNC-LOG.mdx'), 'utf8');
  assert(/repair-attempts: 3 -> 4/.test(log), `log missing change: ${log}`);
  assert(/flaky CI needs one more try/.test(log), 'log missing reason');
});

test('non-finite overrides fall back to defaults', () => {
  const project = mkProject('godpowers-loop-config-bogus-');
  writeRel(project, '.godpowers/intent.yaml', [
    'apiVersion: godpowers/v1',
    'kind: Project',
    'metadata:',
    '  name: bogus',
    'mode: A',
    'scale: small',
    'loop-params:',
    '  repair-attempts: banana',
    ''
  ].join('\n'));
  assert(loopConfig.value(project, 'repair-attempts') === 3, 'bogus override must fall back');
});

test('a persisted repair-attempts override is honored through projectRoot', () => {
  const project = mkProject('godpowers-loop-config-override-honored-');
  loopConfig.set(project, { 'repair-attempts': 5 });
  const withinOverride = repair.classifyFailure({ attempts: 4, error: 'tests fail', projectRoot: project });
  assert(!(withinOverride.strategy === repair.STRATEGIES.ESCALATE && /budget/.test(withinOverride.reason)),
    `attempt 4 of 5 must not exhaust the overridden budget: ${JSON.stringify(withinOverride)}`);
  const exhausted = repair.classifyFailure({ attempts: 5, error: 'tests fail', projectRoot: project });
  assert(exhausted.strategy === repair.STRATEGIES.ESCALATE && /budget/.test(exhausted.reason),
    `attempt 5 must exhaust the overridden budget: ${JSON.stringify(exhausted)}`);
});

test('a persisted accepted-change-target override reaches change metrics', () => {
  const changeMetrics = require('../lib/change-metrics');
  const project = mkProject('godpowers-loop-config-target-');
  loopConfig.set(project, { 'accepted-change-target': 0.9 });
  const metric = changeMetrics.compute(project);
  assert(metric.target === 0.9, `compute() must honor the loop-params target: ${metric.target}`);
});

test('a persisted reaudit-cadence override reaches reaudit status', () => {
  const reaudit = require('../lib/reaudit');
  const project = mkProject('godpowers-loop-config-cadence-');
  loopConfig.set(project, { 'reaudit-cadence-days': 7 });
  const result = reaudit.status(project);
  assert(result.cadenceDays === 7, `status() must honor the loop-params cadence: ${result.cadenceDays}`);
});

test('classifyFailure default budget matches the registry (the 3-vs-2 fork stays closed)', () => {
  // Two attempts must still classify (the old inline default of 2 would
  // escalate here); the third exhausts the registered budget.
  const second = repair.classifyFailure({ attempts: 2, error: 'tests fail' });
  assert(second.strategy !== repair.STRATEGIES.ESCALATE || !/budget/.test(second.reason),
    `attempt 2 of 3 must not exhaust the budget: ${JSON.stringify(second)}`);
  const third = repair.classifyFailure({ attempts: 3, error: 'tests fail' });
  assert(third.strategy === repair.STRATEGIES.ESCALATE && /budget/.test(third.reason),
    `attempt 3 must exhaust the budget: ${JSON.stringify(third)}`);
});

test('error-severity review items block the safe-sync-clear prerequisite until cleared', () => {
  const project = mkProject('godpowers-loop-config-review-');
  reviewRequired.appendBatch(project, {
    source: 'version-sync-roadmap-drift',
    summary: 'test batch',
    items: [{ id: 'roadmap-hash-drift', file: '.godpowers/roadmap/ROADMAP.mdx', severity: 'error', message: 'drifted' }]
  });
  const blocked = router.checkPrerequisites('/god-deploy', project);
  assert(blocked.missing.includes('safe-sync-clear'),
    `deploy must be blocked while an error item is queued: ${JSON.stringify(blocked)}`);
  reviewRequired.clear(project);
  const cleared = router.checkPrerequisites('/god-deploy', project);
  assert(!cleared.missing.includes('safe-sync-clear'),
    `clearing the queue should lift the blocker: ${JSON.stringify(cleared)}`);
});

test('warning-severity review items do not block Tier 3', () => {
  const project = mkProject('godpowers-loop-config-warn-');
  reviewRequired.appendBatch(project, {
    source: 'design-impact',
    summary: 'warnings only',
    items: [{ id: 'w1', file: 'DESIGN.md', severity: 'warning', message: 'soft note' }]
  });
  const satisfied = router.checkPrerequisites('/god-deploy', project);
  assert(!satisfied.missing.includes('safe-sync-clear'),
    `warnings must not block: ${JSON.stringify(satisfied)}`);
});

report('Loop config tests');
