/**
 * Learning-loop metrics.
 *
 * The learning loop is: /god-extract-learnings records lessons
 * (lesson.recorded), and the planner recalls them before slicing
 * (lesson.recalled, attrs.count = how many were injected). This module derives
 * observability for that loop from the hash-chained event ledger
 * (lib/events.js), on the same shape as lib/change-metrics.js: a pure
 * classify() over a flat event list, compute() over a project's runs, and a
 * render() for /god-metrics.
 *
 * Deliberately observability-only: no thresholds, no verdicts beyond
 * 'no-data', and nothing gates on these numbers. The accepted-change rate is
 * shown alongside recall activity strictly as a correlation; a lesson recall
 * appearing near a healthy rate proves nothing about causation, and this
 * module never claims otherwise. A count reports zero only when the ledger
 * genuinely holds no evidence for it.
 */

const events = require('./events');
const { parseSince } = require('./change-metrics');

function withinWindow(event, sinceMs) {
  if (sinceMs === null) return true;
  const ts = event && event.ts ? Date.parse(event.ts) : NaN;
  if (Number.isNaN(ts)) return false;
  return ts >= sinceMs;
}

/**
 * Classify a flat list of ledger events into learning-loop counts. Pure: no
 * disk access, so the whole metric can be unit-tested against synthetic
 * ledgers.
 */
function classify(eventList, opts = {}) {
  const sinceMs = opts.sinceMs !== undefined ? opts.sinceMs : parseSince(opts.since);

  let recorded = 0;
  let recallEvents = 0;
  let recalledLessons = 0;

  for (const event of Array.isArray(eventList) ? eventList : []) {
    if (!event || !event.name || !withinWindow(event, sinceMs)) continue;
    if (event.name === 'lesson.recorded') recorded += 1;
    if (event.name === 'lesson.recalled') {
      recallEvents += 1;
      const count = event.attrs && Number(event.attrs.count);
      if (Number.isFinite(count) && count > 0) recalledLessons += Math.floor(count);
    }
  }

  return {
    recorded,
    recallEvents,
    recalledLessons,
    verdict: recorded + recallEvents === 0 ? 'no-data' : 'active'
  };
}

function collectEvents(projectRoot, runIds) {
  const runs = Array.isArray(runIds) ? runIds : events.listRuns(projectRoot);
  const all = [];
  for (const runId of runs) {
    for (const event of events.readRun(projectRoot, runId)) all.push(event);
  }
  return all;
}

/**
 * Compute the learning-loop metric for a project from its run ledgers. The
 * accepted-change summary rides along for correlation context only; it is
 * computed by lib/change-metrics.js, never re-derived here.
 */
function compute(projectRoot, opts = {}) {
  const changeMetrics = require('./change-metrics');
  const loopConfig = require('./loop-config');
  const runs = events.listRuns(projectRoot);
  const eventList = collectEvents(projectRoot, runs);
  const summary = classify(eventList, opts);
  // Resolve the accepted-change target through the loop-parameter registry,
  // exactly like changeMetrics.compute does, so a per-project override never
  // yields two different verdicts for the same events in one /god-metrics
  // output.
  const target = typeof opts.target === 'number'
    ? opts.target
    : loopConfig.value(projectRoot, 'accepted-change-target');
  return {
    project: projectRoot,
    window: opts.since && opts.since !== 'all' ? String(opts.since) : 'all',
    runs: runs.length,
    ...summary,
    acceptedChange: changeMetrics.classify(eventList, { ...opts, target })
  };
}

function render(metric) {
  const lines = [
    'Learning loop',
    '',
    `  Window:            ${metric.window || 'all'} (${metric.runs} run${metric.runs === 1 ? '' : 's'})`,
    `  Lessons recorded:  ${metric.recorded}`,
    `  Recall events:     ${metric.recallEvents}`,
    `  Lessons recalled:  ${metric.recalledLessons}`,
    `  Verdict:           ${metric.verdict === 'no-data' ? 'no event evidence' : 'active'}`
  ];
  if (metric.acceptedChange) {
    const rate = metric.acceptedChange.rate === null
      ? 'n/a'
      : `${metric.acceptedChange.ratePercent}%`;
    lines.push(`  Accepted-change:   ${rate} alongside (correlation only, not causation)`);
  }
  return lines.join('\n');
}

module.exports = {
  classify,
  compute,
  render
};
