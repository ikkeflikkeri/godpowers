/**
 * Test-integrity counter-metric for the autonomous repair loop.
 *
 * The repair loop's success signal is "the failing command exits 0", and the
 * cheapest way to reach it is to shrink the thing being measured: delete a
 * test file, add a skip marker, lower a coverage threshold. This module pairs
 * the green exit code with a counter-metric: snapshot the test surface before
 * the first repair attempt, compare after any green re-run, and report a
 * SUSPECT verdict when a counter shrank. A suspect green escalates instead of
 * continuing (lib/executor-repair.js classifyFailure).
 *
 * Signals are deliberately high-precision and cross-language only: test files
 * deleted (net count drop, so renames stay quiet), skip markers added, and
 * coverage thresholds lowered in package.json or pyproject.toml. No per-file
 * assertion counting: false SUSPECT pauses cost more than missed edge cases.
 */

const fs = require('fs');
const path = require('path');

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'vendor', 'dist', 'build', 'coverage', 'target',
  '.godpowers', '.next', '.venv', 'venv', '__pycache__'
]);

const TEST_DIR_SEGMENTS = new Set(['test', 'tests', '__tests__', 'spec', 'specs']);

const TEST_BASENAME_PATTERNS = [
  /^test_.+\.[a-z]+$/i,          // pytest: test_foo.py
  /.+_test\.[a-z]+$/i,           // go, rust, python: foo_test.go
  /.+\.(test|spec)\.[a-z]+$/i    // js/ts: foo.test.ts, foo.spec.js
];

// Each entry is a literal substring or regex counted across test files. Only
// tokens that unambiguously mean "this test no longer runs" belong here.
const SKIP_MARKER_PATTERNS = [
  /\.skip\s*\(/g,                // it.skip( / test.skip( / describe.skip(
  /\bxit\s*\(/g,                 // mocha/jasmine
  /\bxdescribe\s*\(/g,
  /@pytest\.mark\.skip/g,
  /@unittest\.skip/g,
  /\bpytest\.skip\s*\(/g,
  /\bt\.Skip/g,                  // go: t.Skip( / t.Skipf(
  /#\[ignore\]/g                 // rust
];

const MAX_TEST_FILE_BYTES = 1024 * 1024;

function isTestFile(relPath) {
  const segments = relPath.split(path.sep);
  const basename = segments[segments.length - 1];
  if (!/\.[a-z]+$/i.test(basename)) return false;
  if (segments.slice(0, -1).some((segment) => TEST_DIR_SEGMENTS.has(segment.toLowerCase()))) {
    return true;
  }
  return TEST_BASENAME_PATTERNS.some((pattern) => pattern.test(basename));
}

function walkTestFiles(root, dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_) {
    return out;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walkTestFiles(root, path.join(dir, entry.name), out);
    } else if (entry.isFile()) {
      const rel = path.relative(root, path.join(dir, entry.name));
      if (isTestFile(rel)) out.push(rel);
    }
  }
  return out;
}

function countSkipMarkers(root, testFiles) {
  let total = 0;
  for (const rel of testFiles) {
    let text;
    try {
      const full = path.join(root, rel);
      if (fs.statSync(full).size > MAX_TEST_FILE_BYTES) continue;
      text = fs.readFileSync(full, 'utf8');
    } catch (_) {
      continue;
    }
    for (const pattern of SKIP_MARKER_PATTERNS) {
      const matches = text.match(pattern);
      if (matches) total += matches.length;
    }
  }
  return total;
}

function coverageThresholds(root) {
  const thresholds = {};
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    const scripts = pkg.scripts || {};
    for (const [name, script] of Object.entries(scripts)) {
      for (const flag of ['lines', 'branches', 'functions', 'statements']) {
        const match = String(script).match(new RegExp(`--${flag}[= ](\\d+)`));
        if (match) thresholds[`package.json:${name}:--${flag}`] = Number(match[1]);
      }
    }
    const jestGlobal = pkg.jest && pkg.jest.coverageThreshold && pkg.jest.coverageThreshold.global;
    if (jestGlobal && typeof jestGlobal === 'object') {
      for (const [key, value] of Object.entries(jestGlobal)) {
        if (Number.isFinite(value)) thresholds[`package.json:jest:${key}`] = value;
      }
    }
  } catch (_) { /* no package.json or unparseable: nothing to track */ }
  try {
    const pyproject = fs.readFileSync(path.join(root, 'pyproject.toml'), 'utf8');
    const failUnder = pyproject.match(/fail_under\s*=\s*(\d+(?:\.\d+)?)/);
    if (failUnder) thresholds['pyproject.toml:fail_under'] = Number(failUnder[1]);
  } catch (_) { /* no pyproject.toml */ }
  return thresholds;
}

/**
 * Snapshot the project's test surface. Take one before the first repair
 * attempt; compare after any green re-run.
 */
function snapshot(projectRoot) {
  const root = path.resolve(projectRoot || process.cwd());
  const testFiles = walkTestFiles(root, root, []).sort();
  return {
    testFiles,
    skipMarkers: countSkipMarkers(root, testFiles),
    coverageThresholds: coverageThresholds(root)
  };
}

/**
 * Compare two snapshots. Returns { verdict: 'ok'|'suspect', reasons: [] }.
 * A net drop in test files, added skip markers, or a lowered coverage
 * threshold makes the green SUSPECT.
 */
function compare(before, after) {
  const reasons = [];

  const afterSet = new Set(after.testFiles);
  const missing = before.testFiles.filter((rel) => !afterSet.has(rel));
  if (after.testFiles.length < before.testFiles.length && missing.length > 0) {
    const named = missing.slice(0, 5).join(', ');
    reasons.push(
      `test file count dropped from ${before.testFiles.length} to ${after.testFiles.length} `
      + `(missing: ${named}${missing.length > 5 ? `, and ${missing.length - 5} more` : ''})`
    );
  }

  if (after.skipMarkers > before.skipMarkers) {
    reasons.push(`skip markers rose from ${before.skipMarkers} to ${after.skipMarkers}`);
  }

  for (const [key, value] of Object.entries(before.coverageThresholds)) {
    const now = after.coverageThresholds[key];
    if (Number.isFinite(now) && now < value) {
      reasons.push(`coverage threshold ${key} lowered from ${value} to ${now}`);
    } else if (now === undefined) {
      reasons.push(`coverage threshold ${key} was removed`);
    }
  }

  return {
    verdict: reasons.length > 0 ? 'suspect' : 'ok',
    reasons
  };
}

module.exports = {
  snapshot,
  compare,
  isTestFile,
  SKIP_MARKER_PATTERNS
};
