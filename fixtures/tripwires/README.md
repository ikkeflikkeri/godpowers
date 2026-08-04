# Tripwire fixtures

Frozen known-bad projects that prove the release-blocking sensors still fire.

Each directory is an adversarial fixture for exactly one sensor, and
`scripts/test-gate-tripwires.js` asserts that the sensor FAILS (or raises its
finding) on it. A gate that always passes is indistinguishable from a gate
that has gone blind; these fixtures are the held-out set that tells the two
apart.

Rules:

- Never "fix" a tripwire fixture to make a suite green. If a tripwire stops
  firing, the sensor regressed; fix the sensor.
- One sensor per fixture. Name the directory after the failure mode it
  encodes, not after the sensor.
- Add a tripwire in the same change that adds or fixes a sensor, so the
  detection logic and its known-bad case land together.

Fixtures:

- `self-passed-critical/`: a findings file whose auditor-authored
  "Launch gate: PASSED" line sits above an unresolved CRITICAL section. The
  shared findings parser must fail it under both policies.
- `attested-not-executed/`: a state.json that claims passed verification
  commands with an empty evidence ledger. The tier gate must raise the
  attestation-gap finding.
- `uncited-owasp/`: an OWASP coverage table whose evidence cells cite no
  resolvable executed-ledger record. The harden gate must raise the citation
  advisory.
