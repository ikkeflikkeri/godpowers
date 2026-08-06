#!/usr/bin/env node
/**
 * Eval corpus suite: known-good and known-bad artifact fixtures graded by the
 * frozen artifact linter. See fixtures/evals/README.md for the contract:
 * good-* fixtures must produce zero error-severity findings, bad-* fixtures
 * must raise every code named in their manifest, and tripwire fixtures prove
 * a self-authored "PASSED" claim cannot blind the grader.
 *
 * No new grader: lib/artifact-linter.js is the only sensor here, so the
 * static-check singularity guard needs no change. Introducing a second
 * grader for these artifact classes requires first extending that guard
 * (clone the lib/findings-verdict.js precedent in scripts/static-check.js).
 *
 * This suite emits no ledger events: grading fixtures is a test, not project
 * activity, and test runs must never write .godpowers/runs/.
 */

const fs = require('fs');
const path = require('path');

const linter = require('../lib/artifact-linter');
const { test, assert, report } = require('./test-harness');

const ROOT = path.resolve(__dirname, '..');
const EVALS = path.join(ROOT, 'fixtures', 'evals');

console.log('\n  Eval corpus tests\n');

function fixtures() {
  const out = [];
  for (const klass of fs.readdirSync(EVALS).sort()) {
    const klassDir = path.join(EVALS, klass);
    if (!fs.statSync(klassDir).isDirectory()) continue;
    for (const name of fs.readdirSync(klassDir).sort()) {
      const dir = path.join(klassDir, name);
      if (!fs.statSync(dir).isDirectory()) continue;
      const manifestPath = path.join(dir, 'manifest.json');
      out.push({ klass, name, dir, manifestPath });
    }
  }
  return out;
}

const all = fixtures();

test('the corpus is discovered and every fixture carries a manifest', () => {
  assert(all.length >= 7, `expected at least 7 fixtures, found ${all.length}`);
  for (const f of all) {
    assert(fs.existsSync(f.manifestPath), `${f.klass}/${f.name} is missing manifest.json`);
    const manifest = JSON.parse(fs.readFileSync(f.manifestPath, 'utf8'));
    assert(typeof manifest.artifact === 'string', `${f.klass}/${f.name} manifest missing artifact`);
    assert(Array.isArray(manifest.mustRaise), `${f.klass}/${f.name} manifest missing mustRaise array`);
    assert(fs.existsSync(path.join(f.dir, manifest.artifact)),
      `${f.klass}/${f.name} artifact ${manifest.artifact} missing`);
    const isBad = f.name.startsWith('bad-');
    assert(isBad === (manifest.mustRaise.length > 0),
      `${f.klass}/${f.name}: bad-* fixtures must name codes, good-* must name none`);
  }
});

for (const f of all) {
  if (!fs.existsSync(f.manifestPath)) continue;
  const manifest = JSON.parse(fs.readFileSync(f.manifestPath, 'utf8'));
  const artifact = path.join(f.dir, manifest.artifact);
  if (!fs.existsSync(artifact)) continue;

  if (manifest.mustRaise.length === 0) {
    test(`good fixture ${f.klass}/${f.name} produces zero blocking findings`, () => {
      const result = linter.lintFile(artifact, { projectRoot: f.dir });
      assert(result.summary.errors === 0,
        `${f.klass}/${f.name} raised ${result.summary.errors} error(s): `
        + result.findings.filter((x) => x.severity === 'error').map((x) => x.code).join(','));
    });
  } else {
    test(`bad fixture ${f.klass}/${f.name} raises ${manifest.mustRaise.join('+')}`, () => {
      const result = linter.lintFile(artifact, { projectRoot: f.dir });
      const raised = new Set(result.findings
        .filter((x) => x.severity === 'error')
        .map((x) => x.code));
      for (const code of manifest.mustRaise) {
        assert(raised.has(code),
          `sensor went blind: ${f.klass}/${f.name} no longer raises ${code} `
          + `(raised: ${[...raised].join(',') || 'nothing'}). Fix the sensor, never the fixture.`);
      }
    });
  }

  if (manifest.tripwire) {
    test(`tripwire ${f.klass}/${f.name}: a self-authored PASSED claim cannot blind the grader`, () => {
      const content = fs.readFileSync(artifact, 'utf8');
      assert(/PASSED/.test(content),
        'tripwire fixture must carry the self-authored PASSED claim it exists to defeat');
      const result = linter.lintFile(artifact, { projectRoot: f.dir });
      assert(result.summary.errors > 0,
        'the grader accepted a prose compliance claim; the sensor has gone blind');
    });
  }
}

test('grading the corpus emits no ledger events', () => {
  for (const f of all) {
    const runsDir = path.join(f.dir, '.godpowers', 'runs');
    assert(!fs.existsSync(runsDir), `${f.klass}/${f.name} gained a run ledger from grading`);
  }
});

report('Eval corpus tests');
