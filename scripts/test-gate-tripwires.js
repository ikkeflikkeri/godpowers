#!/usr/bin/env node
/**
 * Tripwire suite: known-bad fixtures that prove the release-blocking sensors
 * still fire. See fixtures/tripwires/README.md. A sensor that stops failing
 * its tripwire has gone blind; fix the sensor, never the fixture.
 */

const path = require('path');

const gate = require('../lib/gate');
const router = require('../lib/router');
const findingsVerdict = require('../lib/findings-verdict');
const { test, assert, report } = require('./test-harness');

const ROOT = path.resolve(__dirname, '..');
const TRIPWIRES = path.join(ROOT, 'fixtures', 'tripwires');

function fixture(name) {
  return path.join(TRIPWIRES, name);
}

test('tripwire: a self-authored PASSED line above an open Critical fails both policies', () => {
  const project = fixture('self-passed-critical');
  for (const policy of findingsVerdict.POLICIES) {
    const result = findingsVerdict.verdict(project, policy);
    assert(result.pass === false, `${policy} policy went blind: it passed the self-passed-critical tripwire`);
    assert(result.summaryConflict === true, `${policy} policy should flag the summary conflict`);
  }
  assert(router.hasNoCriticalFindings(project) === false,
    'router launch prerequisite went blind: it passed the self-passed-critical tripwire');
  const hardenGate = gate.check({ tier: 'harden', projectRoot: project });
  assert(hardenGate.verdict === 'fail', 'harden gate went blind on the self-passed-critical tripwire');
  assert(hardenGate.findings.some((finding) => finding.id === 'harden-critical-findings'),
    'harden gate should name the critical-findings sensor');
});

test('tripwire: claimed passes with an empty ledger raise the attestation gap', () => {
  const project = fixture('attested-not-executed');
  const result = gate.check({ tier: 'build', projectRoot: project });
  const gap = result.findings.find((finding) => finding.id === 'build-attestation-gap');
  assert(gap, 'attestation-gap sensor went blind: no finding on the attested-not-executed tripwire');
  // Staged severity: while the gap ships as a warning the gate still passes;
  // when ATTESTATION_GAP_SEVERITY is promoted to error the same fixture must
  // start failing the gate. Both states are pinned here so the promotion is a
  // deliberate, tested transition rather than silent behavior drift.
  if (gap.severity === 'error') {
    assert(result.verdict === 'fail', 'an error-severity attestation gap must fail the gate');
  } else {
    assert(gap.severity === 'warning', `unexpected attestation-gap severity: ${gap.severity}`);
    assert(result.verdict === 'pass', 'a warning-severity attestation gap must not fail the gate');
  }
});

test('tripwire: an uncited OWASP table raises the citation advisory', () => {
  const project = fixture('uncited-owasp');
  const result = gate.check({ tier: 'harden', projectRoot: project });
  const citation = result.findings.find((finding) => finding.id === 'harden-owasp-citation');
  assert(citation, 'owasp-citation sensor went blind: no advisory on the uncited-owasp tripwire');
  assert(citation.reason.includes('A01:2025'), 'citation advisory should name the uncited rows');
});

report('Gate tripwire tests');
