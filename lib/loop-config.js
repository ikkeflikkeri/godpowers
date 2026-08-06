/**
 * Loop parameter registry: the slow loop's single home for every fast loop's
 * operating knobs.
 *
 * Fast loops (autonomous repair, outcome verification, change metrics,
 * freshness checks, permission reaudit) each used to carry their own inline
 * constant, so two layers could publish different values for one knob (the
 * runbook allowed 3 repair attempts while lib/executor-repair.js defaulted to
 * 2) and no single surface let a human see or revise the loop system's
 * parameters. This module owns the defaults, and a per-project override lives
 * in `.godpowers/intent.yaml > loop-params`, edited through /god-budget (the
 * same governed surface as the budgets block) rather than by whichever loop
 * runs first.
 *
 * Public API mirrors lib/budget.js:
 *   defaults() -> built-in values
 *   read(projectRoot) -> defaults merged with the project's loop-params block
 *   value(projectRoot, key) -> one resolved value
 *   set(projectRoot, partial, opts) -> merged block (opts.reason appends the
 *     change to .godpowers/SYNC-LOG.mdx so revisions carry their why)
 *   summary(params) -> display string
 */

const fs = require('fs');
const path = require('path');

const intent = require('./intent');
const budget = require('./budget');

const DEFAULTS = {
  // Repair attempts the autonomous repair loop spends on one root failure
  // before escalating to a human pause. The runbook quotes this number;
  // scripts/static-check.js keeps the two in lockstep.
  'repair-attempts': 3,
  // Outcome-verify iteration budget (evidence.outcome.start).
  'outcome-budget': 3,
  // Accepted-change ratio target for lib/change-metrics.js.
  'accepted-change-target': 0.5,
  // Dashboard freshness window for CHECKPOINT.mdx and SYNC-LOG.mdx.
  'checkpoint-fresh-hours': 24,
  // Dashboard hygiene window (checkpoint age before /god-hygiene is nudged).
  'hygiene-fresh-days': 30,
  // Permission reaudit cadence for lib/reaudit.js.
  'reaudit-cadence-days': 30,
  // How many recent project-scope lessons the planner recalls before slicing
  // (specialists/god-planner.md, fed from the evidence lessons store).
  'lessons-recall-limit': 10,
  // Open improvement proposals allowed at once (lib/improvement-proposals.js).
  // One at a time by default: each prompt change gets reviewed on its own.
  'proposal-open-limit': 1
};

function defaults() {
  return { ...DEFAULTS };
}

function intentPath(projectRoot) {
  return path.join(path.resolve(projectRoot || process.cwd()), '.godpowers', 'intent.yaml');
}

/**
 * Resolved parameters: built-in defaults overlaid with the project's
 * loop-params block (when intent.yaml exists and has one). Unknown keys in
 * the block are preserved; non-finite numeric overrides fall back.
 */
function read(projectRoot) {
  const merged = defaults();
  const i = intent.read(path.resolve(projectRoot || process.cwd()));
  const block = i && i['loop-params'] && typeof i['loop-params'] === 'object'
    ? i['loop-params']
    : {};
  for (const [key, value] of Object.entries(block)) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) merged[key] = numeric;
  }
  return merged;
}

function value(projectRoot, key) {
  return read(projectRoot)[key];
}

function renderBlock(params) {
  const lines = ['loop-params:'];
  for (const [key, val] of Object.entries(params)) {
    lines.push(`  ${key}: ${val}`);
  }
  return lines.join('\n') + '\n';
}

function stripBlock(raw) {
  const lines = raw.split('\n');
  const range = budget.findTopLevelBlock(lines, 'loop-params');
  if (!range) return raw;
  return lines.slice(0, range.start).concat(lines.slice(range.end))
    .join('\n').replace(/\n{3,}/g, '\n\n');
}

/**
 * Update a subset of loop parameters. Only overrides that differ from the
 * defaults are persisted. When opts.reason is given, the change is appended
 * to .godpowers/SYNC-LOG.mdx (old value, new value, reason) so the slow loop
 * keeps a record of why a knob moved.
 */
function set(projectRoot, partial, opts = {}) {
  const before = read(projectRoot);
  const merged = { ...before, ...partial };

  const overrides = {};
  for (const [key, val] of Object.entries(merged)) {
    if (DEFAULTS[key] === undefined || val !== DEFAULTS[key]) overrides[key] = val;
  }

  const file = intentPath(projectRoot);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let raw = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (!raw.trim()) {
    raw = 'apiVersion: godpowers/v1\nkind: Project\nmetadata:\n  name: unnamed\nmode: A\nscale: small\n';
  }
  const stripped = stripBlock(raw);
  const block = Object.keys(overrides).length > 0 ? renderBlock(overrides) : '';
  const out = stripped.endsWith('\n') ? stripped + block : stripped + '\n' + block;
  fs.writeFileSync(file, out);

  if (opts.reason) {
    const syncLog = path.join(projectRoot, '.godpowers', 'SYNC-LOG.mdx');
    const changes = Object.entries(partial)
      .map(([key, val]) => `${key}: ${before[key]} -> ${val}`)
      .join(', ');
    fs.appendFileSync(syncLog,
      `\n- ${new Date().toISOString()} loop-params changed (${changes}): ${opts.reason}\n`);
  }
  return read(projectRoot);
}

function summary(params) {
  const resolved = params || DEFAULTS;
  const lines = ['GODPOWERS LOOP PARAMETERS', ''];
  for (const [key, val] of Object.entries(resolved)) {
    const marker = DEFAULTS[key] !== undefined && val !== DEFAULTS[key] ? ' (override)' : '';
    lines.push(`  ${key}: ${val}${marker}`);
  }
  return lines.join('\n');
}

module.exports = {
  DEFAULTS,
  defaults,
  read,
  value,
  set,
  summary
};
