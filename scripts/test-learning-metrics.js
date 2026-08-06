#!/usr/bin/env node
/**
 * Learning-loop metric tests.
 */

const learningMetrics = require('../lib/learning-metrics');
const events = require('../lib/events');
const { test, assert, mkProject, report } = require('./test-harness');

console.log('\n  Learning-loop metric tests\n');

test('classify counts recorded and recalled lessons', () => {
  const summary = learningMetrics.classify([
    { name: 'lesson.recorded', ts: '2026-07-01T00:00:00Z' },
    { name: 'lesson.recorded', ts: '2026-07-01T00:01:00Z' },
    { name: 'lesson.recalled', ts: '2026-07-01T00:02:00Z', attrs: { count: 3 } }
  ]);
  assert(summary.recorded === 2, `recorded=${summary.recorded}`);
  assert(summary.recallEvents === 1, `recallEvents=${summary.recallEvents}`);
  assert(summary.recalledLessons === 3, `recalledLessons=${summary.recalledLessons}`);
  assert(summary.verdict === 'active', `verdict=${summary.verdict}`);
});

test('classify reports no-data on an empty or unrelated ledger', () => {
  const empty = learningMetrics.classify([]);
  assert(empty.verdict === 'no-data', `verdict=${empty.verdict}`);
  const unrelated = learningMetrics.classify([
    { name: 'gate.pass' },
    { name: 'change.accepted' }
  ]);
  assert(unrelated.verdict === 'no-data', `verdict=${unrelated.verdict}`);
  assert(unrelated.recorded === 0 && unrelated.recallEvents === 0, JSON.stringify(unrelated));
});

test('a recall event without a numeric count still counts as a recall', () => {
  const summary = learningMetrics.classify([
    { name: 'lesson.recalled' },
    { name: 'lesson.recalled', attrs: { count: 'not-a-number' } }
  ]);
  assert(summary.recallEvents === 2, `recallEvents=${summary.recallEvents}`);
  assert(summary.recalledLessons === 0, `recalledLessons=${summary.recalledLessons}`);
});

test('since window filters out older events', () => {
  const summary = learningMetrics.classify([
    { name: 'lesson.recorded', ts: '2020-01-01T00:00:00Z' },
    { name: 'lesson.recorded', ts: new Date().toISOString() }
  ], { since: '1d' });
  assert(summary.recorded === 1, `recorded=${summary.recorded}`);
});

test('compute reads a real project ledger and carries accepted-change alongside', () => {
  const project = mkProject('godpowers-learning-metrics-');
  const handle = events.startRun(project, { source: 'test' });
  handle.emit({ span_id: events.generateSpanId(), name: 'lesson.recorded', attrs: { milestone: 'm1' } });
  handle.emit({ span_id: events.generateSpanId(), name: 'lesson.recalled', attrs: { count: 2 } });
  handle.emit({ span_id: events.generateSpanId(), name: 'gate.pass' });
  const metric = learningMetrics.compute(project);
  assert(metric.recorded === 1, `recorded=${metric.recorded}`);
  assert(metric.recallEvents === 1, `recallEvents=${metric.recallEvents}`);
  assert(metric.recalledLessons === 2, `recalledLessons=${metric.recalledLessons}`);
  assert(metric.verdict === 'active', `verdict=${metric.verdict}`);
  assert(metric.acceptedChange && metric.acceptedChange.accepted === 1,
    `acceptedChange=${JSON.stringify(metric.acceptedChange)}`);
  const chain = events.verifyChain(handle.file);
  assert(chain.valid === true, 'emitting lesson events must not break the hash chain');
});

test('render never claims causation', () => {
  const project = mkProject('godpowers-learning-metrics-render-');
  const handle = events.startRun(project, { source: 'test' });
  handle.emit({ span_id: events.generateSpanId(), name: 'lesson.recalled', attrs: { count: 1 } });
  handle.emit({ span_id: events.generateSpanId(), name: 'gate.pass' });
  const text = learningMetrics.render(learningMetrics.compute(project));
  assert(text.includes('Learning loop'), 'render should title the section');
  assert(text.includes('correlation only, not causation'),
    'the accepted-change line must carry the correlation-only label');
});

test('render reports no event evidence when the ledger is silent', () => {
  const project = mkProject('godpowers-learning-metrics-empty-');
  const text = learningMetrics.render(learningMetrics.compute(project));
  assert(text.includes('no event evidence'), `unexpected render: ${text}`);
});

report('Learning-loop metric tests');
