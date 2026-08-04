/**
 * Shared verdict authority for `.godpowers/harden/FINDINGS.mdx`.
 *
 * Both consumers of the harden findings artifact (the launch-side routing
 * prerequisite in lib/router.js and the hash-bound publication gate in
 * lib/prepublication-gate.js) resolve verdicts through this module, so the
 * same document can never satisfy one gate and fail the other through parser
 * drift.
 *
 * Frozen rule: no auditor-authored summary line ever satisfies a gate. The
 * harden auditor writes FINDINGS.mdx, so a "Launch gate: PASSED" line in that
 * file is the audited party grading its own gate. Verdicts derive only from
 * per-finding statuses. An explicit "Launch gate: BLOCKED" line still blocks
 * (self-blocking is safe, self-passing is not), and a PASSED line that
 * disagrees with the parsed findings is reported as a summary conflict.
 *
 * Two named policies pin the launch-vs-publication divergence as an owned
 * contract instead of accidental drift between two regex implementations:
 *   - launch: a Critical explicitly accepted as risk by the human counts as
 *     handled; accepted risk resumes the arc (SKILL.md Critical-Finding Gate).
 *   - publication: accepted risk never authorizes publication; an accepted
 *     Critical still blocks (hash-bound pre-publication gate).
 */

const syncFs = require('./sync-fs');

const FINDINGS_FILE = '.godpowers/harden/FINDINGS.mdx';
const POLICIES = ['launch', 'publication'];

function normalizedStatus(value) {
  return String(value || '').trim().toLowerCase().replace(/[_.\s]+/g, '-');
}

function classifyStatus(value) {
  const status = normalizedStatus(value);
  if (['fixed', 'resolved', 'closed', 'verified'].includes(status)) return 'resolved';
  if (['accepted-risk', 'accepted'].includes(status)) return 'accepted';
  return 'unresolved';
}

/**
 * Parse the Critical findings recorded in a findings document. Recognizes the
 * severity summary table row, `### [CRITICAL-...]` heading sections, and
 * `severity: critical` YAML blocks. Never derives a verdict from summary
 * lines; those are surfaced as flags for the policy layer.
 *
 * @param {string|null} content Raw findings text (null when the file is absent).
 * @returns {{ present: boolean, summaryTotal: number|null, total: number,
 *   resolved: number, accepted: number, unresolved: number,
 *   unclassified: number, explicitBlocked: boolean, explicitPassed: boolean }}
 */
function parse(content) {
  const present = content !== null && content !== undefined;
  const text = present ? String(content) : '';
  const summary = text.match(/\|\s*Critical\s*\|\s*(\d+)\s*\|/i);
  const summaryTotal = summary ? Number(summary[1]) : null;
  const entries = [];

  const headingPattern = /^###\s+\[CRITICAL-[^\n]+\]([\s\S]*?)(?=^###\s+\[|(?![\s\S]))/gim;
  let match;
  while ((match = headingPattern.exec(text)) !== null) {
    const status = match[1].match(/(?:\*\*)?Status(?:\*\*)?:\s*([^\n.]+)/i);
    entries.push(classifyStatus(status ? status[1] : 'unknown'));
  }

  const yamlPattern = /^severity:\s*critical\s*$([\s\S]*?)(?=^severity:\s*|(?![\s\S]))/gim;
  while ((match = yamlPattern.exec(text)) !== null) {
    const status = match[1].match(/^status:\s*([^\n#]+)/im);
    entries.push(classifyStatus(status ? status[1] : 'unknown'));
  }

  const total = summaryTotal === null ? entries.length : Math.max(summaryTotal, entries.length);
  return {
    present,
    summaryTotal,
    total,
    resolved: entries.filter((status) => status === 'resolved').length,
    accepted: entries.filter((status) => status === 'accepted').length,
    unresolved: entries.filter((status) => status === 'unresolved').length,
    unclassified: Math.max(0, total - entries.length),
    explicitBlocked: /Launch gate(?:\*\*)?:\s*BLOCKED/i.test(text),
    explicitPassed: /Launch gate(?:\*\*)?:\s*PASSED/i.test(text)
  };
}

function assertPolicy(policy) {
  if (!POLICIES.includes(policy)) {
    throw new Error(`Unknown findings policy: ${policy}. Known policies: ${POLICIES.join(', ')}`);
  }
}

/**
 * Policy-resolved Critical counts. `unresolved` is the blocking count under
 * the named policy: unclassified findings always block, and accepted risk
 * blocks only under the publication policy.
 *
 * @param {ReturnType<typeof parse>} parsed
 * @param {'launch'|'publication'} policy
 * @returns {{ total: number, resolved: number, accepted: number, unresolved: number }}
 */
function counts(parsed, policy) {
  assertPolicy(policy);
  const blocking = policy === 'publication'
    ? parsed.unresolved + parsed.unclassified + parsed.accepted
    : parsed.unresolved + parsed.unclassified;
  return {
    total: parsed.total,
    resolved: parsed.resolved,
    accepted: parsed.accepted,
    unresolved: blocking
  };
}

/**
 * Evaluate parsed findings under a named policy without touching disk.
 */
function evaluate(parsed, policy) {
  assertPolicy(policy);
  const resolvedCounts = counts(parsed, policy);
  const reasons = [];
  if (!parsed.present) reasons.push(`missing ${FINDINGS_FILE}`);
  if (parsed.explicitBlocked) reasons.push('findings record a blocked launch gate');
  if (resolvedCounts.unresolved > 0) {
    reasons.push(`${resolvedCounts.unresolved} Critical finding(s) block the ${policy} policy`);
  }
  const summaryConflict = parsed.explicitPassed && resolvedCounts.unresolved > 0;
  if (summaryConflict) {
    reasons.push('summary line claims Launch gate: PASSED but parsed findings disagree; summary lines never satisfy a gate');
  }
  return {
    policy,
    pass: reasons.length === 0,
    criticals: resolvedCounts,
    explicitBlocked: parsed.explicitBlocked,
    summaryConflict,
    reasons
  };
}

/**
 * Project-level verdict: read the findings artifact (mdx-first with legacy
 * fallback) and evaluate it under the named policy.
 */
function verdict(projectRoot, policy) {
  assertPolicy(policy);
  const content = syncFs.readArtifactOrNull(projectRoot, FINDINGS_FILE);
  return evaluate(parse(content), policy);
}

module.exports = {
  FINDINGS_FILE,
  POLICIES,
  classifyStatus,
  parse,
  counts,
  evaluate,
  verdict
};
