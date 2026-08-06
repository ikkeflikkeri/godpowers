# Eval corpus fixtures

Frozen known-good and known-bad artifacts for the classes the frozen grader
(`lib/artifact-linter.js`) understands. `scripts/test-eval-set.js` asserts
that every `good-*` fixture produces zero error-severity findings and every
`bad-*` fixture raises the finding codes named in its `manifest.json`.

This corpus protects the sensors and gives reviewers reference examples. It
does NOT measure the effect of a prompt change: a frozen grader run on a
frozen corpus returns identical results whether or not a prompt was edited.
Anything claiming otherwise is eval theater.

Rules (the same contract as `fixtures/tripwires/`):

- Never "fix" a fixture to make a suite green. If a `bad-*` fixture stops
  raising its named code, the sensor regressed; fix the sensor.
- One failure mode per `bad-*` fixture. Name the directory after the failure
  mode it encodes, not after the sensor.
- Land a fixture change and its sensor change together.
- `bad-*` fixtures intentionally contain content the linter bans (em dashes,
  MDX-unsafe characters, missing sections). That is their job; do not clean
  them up.
- Fixtures whose manifest sets `"tripwire": true` carry a self-authored
  "PASSED" claim above a genuine violation. They prove no prose compliance
  claim can blind the grader: the named codes must fire anyway.

Layout: `<class>/<fixture-name>/<ARTIFACT>` plus `manifest.json` declaring
`artifact` (the file to lint) and `mustRaise` (error codes that must fire;
empty for `good-*`).

Grader singularity: these classes are graded by `lib/artifact-linter.js`
only. Introducing a second grader for them requires first extending the
static-check singularity scan (the `lib/findings-verdict.js` precedent in
`scripts/static-check.js`).
