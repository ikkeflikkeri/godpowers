/**
 * Blind compare: mechanical support for blind A/B judgment of visual
 * artifacts.
 *
 * A judge that knows which screenshot is "ours" grades the label, not the
 * pixels. This module removes the label: preparePair() copies two role-named
 * artifacts (candidate vs reference, current vs proposed, round-3 vs
 * round-4) into a pair directory as neutral "a" and "b" files, with the
 * role assignment held in a sealed sidecar the judging agent never reads.
 * The judge looks only at a and b, records a verdict with recordVerdict(),
 * and only then does unseal() resolve which role won.
 *
 * Ordering is enforced mechanically: unseal() refuses until a verdict
 * exists, recordVerdict() refuses to overwrite one that already landed, and
 * preparePair() refuses to rebuild a pair that already carries a verdict.
 * The blindness itself is procedural: assignment.json sits beside the pair,
 * and the judging protocol (references/design/BLIND-COMPARISON.md) forbids
 * reading it before the verdict lands. Honest framing: this is a seatbelt
 * against accidental peeking and after-the-fact verdict edits, not
 * cryptography.
 *
 * Assignment is deterministic: sha256 over the sorted role names, source
 * paths, and optional salt decides which role lands on "a", so re-preparing
 * the same pair reproduces the same layout, while different pairs vary.
 *
 * The blind side-by-side framing was influenced by the gauntlet-loop skill
 * (see INSPIRATION.md). No code or prose is taken from it; the sealed
 * verdict-before-unseal ordering is godpowers' own.
 *
 * Pair directory shape:
 *   pair.json         public manifest: id, files, status; carries no roles
 *   a.<ext>, b.<ext>  the two artifacts, role-stripped
 *   assignment.json   sealed { a: role, b: role }; judge must not read
 *   verdict.json      { winner: 'a' | 'b' | 'tie', rationale }
 *   result.json       { winner: role | 'tie', assignment, rationale }
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const atomic = require('./atomic-write');

const SLOTS = ['a', 'b'];

function readJson(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_) {
    return null;
  }
}

function writeJson(file, value) {
  atomic.writeJsonAtomic(file, value);
}

function pairPaths(pairDir) {
  return {
    manifest: path.join(pairDir, 'pair.json'),
    assignment: path.join(pairDir, 'assignment.json'),
    verdict: path.join(pairDir, 'verdict.json'),
    result: path.join(pairDir, 'result.json')
  };
}

/**
 * Copy two role-named artifacts into pairDir as neutral a/b files.
 *
 * roles: object with exactly two keys; each value is a path to an existing
 * file. Role names are free-form ('candidate'/'reference',
 * 'current'/'proposed', 'round-3'/'round-4').
 *
 * Returns { pairDir, id, files: { a, b }, status: 'sealed' }.
 */
function preparePair({ roles, outDir, salt = '' } = {}) {
  if (!roles || typeof roles !== 'object' || Object.keys(roles).length !== 2) {
    throw new Error('blind-compare: roles must name exactly two artifacts');
  }
  if (!outDir) {
    throw new Error('blind-compare: outDir is required');
  }
  const names = Object.keys(roles).sort();
  for (const name of names) {
    const source = roles[name];
    if (typeof source !== 'string' || !fs.existsSync(source) || !fs.statSync(source).isFile()) {
      throw new Error(`blind-compare: role "${name}" does not point at a readable file`);
    }
  }

  const digest = crypto
    .createHash('sha256')
    .update(names.map((name) => `${name}:${roles[name]}`).join('|') + '|' + salt)
    .digest();
  const id = digest.toString('hex').slice(0, 12);
  // Last digest byte decides which sorted role takes slot "a", so the
  // layout is reproducible for the same inputs and varies across pairs.
  const firstSlot = digest[digest.length - 1] % 2 === 0 ? 0 : 1;
  const assignment = {
    a: names[firstSlot],
    b: names[1 - firstSlot]
  };

  const pairDir = path.join(outDir, `pair-${id}`);
  const paths = pairPaths(pairDir);
  if (fs.existsSync(paths.verdict) || fs.existsSync(paths.result)) {
    throw new Error('blind-compare: pair already carries a verdict; prepare a new pair instead of rebuilding this one');
  }
  fs.mkdirSync(pairDir, { recursive: true });

  const files = {};
  for (const slot of SLOTS) {
    const source = roles[assignment[slot]];
    const ext = path.extname(source) || '.bin';
    const fileName = `${slot}${ext}`;
    fs.copyFileSync(source, path.join(pairDir, fileName));
    files[slot] = fileName;
  }

  writeJson(paths.assignment, assignment);
  writeJson(paths.manifest, { id, files, status: 'sealed' });
  return { pairDir, id, files, status: 'sealed' };
}

/**
 * Public view of a pair for the judging agent: never exposes roles.
 */
function readPair(pairDir) {
  const paths = pairPaths(pairDir);
  const manifest = readJson(paths.manifest);
  if (!manifest) {
    throw new Error(`blind-compare: no pair manifest at ${pairDir}`);
  }
  return {
    id: manifest.id,
    files: manifest.files,
    status: manifest.status,
    hasVerdict: fs.existsSync(paths.verdict)
  };
}

/**
 * Record the blind verdict. Refuses to overwrite one that already exists
 * and refuses once the pair is unsealed, so a verdict can never be edited
 * to match the assignment after the assignment is known.
 */
function recordVerdict(pairDir, { winner, rationale } = {}) {
  const paths = pairPaths(pairDir);
  if (!readJson(paths.manifest)) {
    throw new Error(`blind-compare: no pair manifest at ${pairDir}`);
  }
  if (!SLOTS.includes(winner) && winner !== 'tie') {
    throw new Error('blind-compare: winner must be "a", "b", or "tie"');
  }
  if (typeof rationale !== 'string' || rationale.trim().length < 10) {
    throw new Error('blind-compare: rationale must state concrete evidence (10+ characters)');
  }
  if (fs.existsSync(paths.result)) {
    throw new Error('blind-compare: pair is already unsealed; the verdict is immutable');
  }
  if (fs.existsSync(paths.verdict)) {
    throw new Error('blind-compare: a verdict already exists; it is immutable');
  }
  const verdict = { winner, rationale: rationale.trim() };
  writeJson(paths.verdict, verdict);
  return verdict;
}

/**
 * Resolve the blind verdict against the sealed assignment. Refuses until a
 * verdict exists; idempotent afterwards (re-reading the stored result).
 *
 * Returns { winner: role | 'tie', assignment, rationale }.
 */
function unseal(pairDir) {
  const paths = pairPaths(pairDir);
  const existing = readJson(paths.result);
  if (existing) return existing;

  const verdict = readJson(paths.verdict);
  if (!verdict) {
    throw new Error('blind-compare: no verdict recorded; judge the pair before unsealing');
  }
  const assignment = readJson(paths.assignment);
  if (!assignment) {
    throw new Error(`blind-compare: assignment sidecar is missing at ${pairDir}`);
  }
  const result = {
    winner: verdict.winner === 'tie' ? 'tie' : assignment[verdict.winner],
    assignment,
    rationale: verdict.rationale
  };
  writeJson(paths.result, result);
  const manifest = readJson(paths.manifest);
  if (manifest) {
    writeJson(paths.manifest, { ...manifest, status: 'unsealed' });
  }
  return result;
}

module.exports = {
  preparePair,
  readPair,
  recordVerdict,
  unseal
};
