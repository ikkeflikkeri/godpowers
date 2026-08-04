const loopConfig = require('./loop-config');

const STRATEGIES = Object.freeze({
  RETRY: 'retry',
  DECOMPOSE: 'decompose',
  PRUNE: 'prune',
  ESCALATE: 'escalate'
});

function classifyFailure(input = {}) {
  const attempts = Number(input.attempts || 0);
  // The budget has exactly one home (lib/loop-config.js repair-attempts,
  // overridable per project via intent.yaml loop-params); the runbook quotes
  // the same default and scripts/static-check.js keeps prose and code in
  // lockstep. Pass input.projectRoot so a /god-budget --loop override is
  // honored; an explicit input.budget wins over both.
  const budget = Number(Object.prototype.hasOwnProperty.call(input, 'budget')
    ? input.budget
    : loopConfig.value(input.projectRoot, 'repair-attempts'));
  const error = String(input.error || '').toLowerCase();
  const criteria = String(input.doneCriteria || '').toLowerCase();

  // A green re-run whose repair shrank the test surface is not green. The
  // integrity verdict comes from lib/repair-integrity.js compare(); a suspect
  // green escalates regardless of remaining budget, because the loop's own
  // metric (exit code 0) has been gamed rather than satisfied.
  const integrity = input.integrity;
  if (integrity && integrity.verdict === 'suspect') {
    const detail = Array.isArray(integrity.reasons) && integrity.reasons.length > 0
      ? integrity.reasons.join('; ')
      : 'test surface shrank during repair';
    return {
      strategy: STRATEGIES.ESCALATE,
      reason: `green is suspect: ${detail}`
    };
  }

  if (attempts >= budget) {
    return {
      strategy: STRATEGIES.ESCALATE,
      reason: 'repair budget exhausted'
    };
  }

  if (/architecture|product decision|ambiguous|human/.test(error)) {
    return {
      strategy: STRATEGIES.ESCALATE,
      reason: 'failure requires a human or architecture decision'
    };
  }

  if (/not found|enoent|missing dependency|cannot find module|wrong path|permission|timeout|network|econn/.test(error)) {
    return {
      strategy: STRATEGIES.RETRY,
      reason: 'failure looks environmental or mechanical'
    };
  }

  if (/and|multiple|all of|end-to-end|full flow/.test(criteria) || /too broad|partial|only.*part/.test(error)) {
    return {
      strategy: STRATEGIES.DECOMPOSE,
      reason: 'done criteria appears too broad for one verified step'
    };
  }

  if (/out of scope|blocked by missing prerequisite|unsupported|cannot be implemented/.test(error)) {
    return {
      strategy: STRATEGIES.PRUNE,
      reason: 'task appears infeasible in the current slice'
    };
  }

  return {
    strategy: STRATEGIES.RETRY,
    reason: 'default to one focused retry before broader action'
  };
}

function renderRepairLog(task, decision) {
  const name = task || 'task';
  const strategy = decision.strategy.toUpperCase();
  return `[Executor Repair - ${strategy}] ${name}: ${decision.reason}`;
}

module.exports = {
  STRATEGIES,
  classifyFailure,
  renderRepairLog
};
