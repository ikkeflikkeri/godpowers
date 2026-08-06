#!/usr/bin/env node

/**
 * Tests for lib/blind-compare.js: sealed assignment, verdict-before-unseal
 * ordering, and verdict immutability.
 */

const fs = require('fs');
const path = require('path');

const blind = require('../lib/blind-compare');
const { test, assert, mkProject, report } = require('./test-harness');

console.log('\n  Blind compare tests\n');

function mkShots(root, names = ['candidate.png', 'reference.png']) {
  const out = [];
  for (const name of names) {
    const file = path.join(root, name);
    fs.writeFileSync(file, `PNG:${name}`);
    out.push(file);
  }
  return out;
}

test('preparePair copies both artifacts into neutral a/b slots', () => {
  const root = mkProject('godpowers-blind-prepare-');
  const [candidate, reference] = mkShots(root);
  const pair = blind.preparePair({
    roles: { candidate, reference },
    outDir: path.join(root, 'blind')
  });
  assert(/^pair-[0-9a-f]{12}$/.test(path.basename(pair.pairDir)), 'pair dir named by id');
  assert(pair.status === 'sealed', 'starts sealed');
  assert(pair.files.a === 'a.png' && pair.files.b === 'b.png', 'extension preserved');
  const aBody = fs.readFileSync(path.join(pair.pairDir, 'a.png'), 'utf8');
  const bBody = fs.readFileSync(path.join(pair.pairDir, 'b.png'), 'utf8');
  assert(aBody !== bBody, 'slots hold distinct artifacts');
  assert([aBody, bBody].sort().join('|') === 'PNG:candidate.png|PNG:reference.png', 'both sources copied');
});

test('preparePair assignment is deterministic for identical inputs', () => {
  const root = mkProject('godpowers-blind-deterministic-');
  const [candidate, reference] = mkShots(root);
  const first = blind.preparePair({ roles: { candidate, reference }, outDir: path.join(root, 'x') });
  const firstAssignment = JSON.parse(fs.readFileSync(path.join(first.pairDir, 'assignment.json'), 'utf8'));
  const second = blind.preparePair({ roles: { reference, candidate }, outDir: path.join(root, 'y') });
  const secondAssignment = JSON.parse(fs.readFileSync(path.join(second.pairDir, 'assignment.json'), 'utf8'));
  assert(first.id === second.id, 'role order does not change the id');
  assert(firstAssignment.a === secondAssignment.a && firstAssignment.b === secondAssignment.b, 'assignment is stable');
});

test('preparePair salt varies the id', () => {
  const root = mkProject('godpowers-blind-salt-');
  const [candidate, reference] = mkShots(root);
  const plain = blind.preparePair({ roles: { candidate, reference }, outDir: path.join(root, 'p') });
  const salted = blind.preparePair({ roles: { candidate, reference }, outDir: path.join(root, 'p'), salt: 'round-2' });
  assert(plain.id !== salted.id, 'salt produces a distinct pair');
});

test('preparePair refuses malformed role sets and missing files', () => {
  const root = mkProject('godpowers-blind-refuse-');
  const [candidate] = mkShots(root, ['candidate.png']);
  for (const roles of [null, {}, { candidate }, { a: candidate, b: candidate, c: candidate }]) {
    let threw = false;
    try {
      blind.preparePair({ roles, outDir: path.join(root, 'out') });
    } catch (e) {
      threw = /exactly two/.test(e.message);
    }
    assert(threw, `refuses roles ${JSON.stringify(roles && Object.keys(roles))}`);
  }
  let missing = false;
  try {
    blind.preparePair({ roles: { candidate, reference: path.join(root, 'nope.png') }, outDir: path.join(root, 'out') });
  } catch (e) {
    missing = /readable file/.test(e.message);
  }
  assert(missing, 'refuses a missing source file');
  let noOut = false;
  try {
    blind.preparePair({ roles: { candidate, reference: candidate } });
  } catch (e) {
    noOut = /outDir/.test(e.message);
  }
  assert(noOut, 'refuses a missing outDir');
});

test('readPair exposes the manifest but never the roles', () => {
  const root = mkProject('godpowers-blind-read-');
  const [candidate, reference] = mkShots(root);
  const pair = blind.preparePair({ roles: { candidate, reference }, outDir: path.join(root, 'blind') });
  const view = blind.readPair(pair.pairDir);
  assert(view.id === pair.id && view.status === 'sealed' && view.hasVerdict === false, 'public view matches');
  assert(!('assignment' in view) && !JSON.stringify(view).includes('candidate'), 'no role leakage');
  let threw = false;
  try {
    blind.readPair(path.join(root, 'nowhere'));
  } catch (e) {
    threw = /no pair manifest/.test(e.message);
  }
  assert(threw, 'refuses a directory without a manifest');
});

test('recordVerdict validates winner and rationale, then becomes immutable', () => {
  const root = mkProject('godpowers-blind-verdict-');
  const [candidate, reference] = mkShots(root);
  const pair = blind.preparePair({ roles: { candidate, reference }, outDir: path.join(root, 'blind') });

  for (const [args, pattern] of [
    [{ winner: 'c', rationale: 'long enough rationale' }, /winner must be/],
    [{ winner: 'a', rationale: 'short' }, /concrete evidence/],
    [{ winner: 'a' }, /concrete evidence/]
  ]) {
    let threw = false;
    try {
      blind.recordVerdict(pair.pairDir, args);
    } catch (e) {
      threw = pattern.test(e.message);
    }
    assert(threw, `refuses ${JSON.stringify(args)}`);
  }

  const verdict = blind.recordVerdict(pair.pairDir, { winner: 'a', rationale: 'sharper hierarchy and denser layout in a' });
  assert(verdict.winner === 'a', 'verdict recorded');
  assert(blind.readPair(pair.pairDir).hasVerdict === true, 'readPair reflects the verdict');

  let overwrite = false;
  try {
    blind.recordVerdict(pair.pairDir, { winner: 'b', rationale: 'changed my mind after peeking' });
  } catch (e) {
    overwrite = /immutable/.test(e.message);
  }
  assert(overwrite, 'second verdict refused');

  let noPair = false;
  try {
    blind.recordVerdict(path.join(root, 'nowhere'), { winner: 'a', rationale: 'long enough rationale' });
  } catch (e) {
    noPair = /no pair manifest/.test(e.message);
  }
  assert(noPair, 'refuses without a manifest');
});

test('unseal refuses before a verdict, resolves roles after, and is idempotent', () => {
  const root = mkProject('godpowers-blind-unseal-');
  const [candidate, reference] = mkShots(root);
  const pair = blind.preparePair({ roles: { candidate, reference }, outDir: path.join(root, 'blind') });

  let early = false;
  try {
    blind.unseal(pair.pairDir);
  } catch (e) {
    early = /judge the pair before unsealing/.test(e.message);
  }
  assert(early, 'unseal refuses before a verdict');

  blind.recordVerdict(pair.pairDir, { winner: 'b', rationale: 'b reads cleaner at a glance, tighter spacing scale' });
  const result = blind.unseal(pair.pairDir);
  assert(['candidate', 'reference'].includes(result.winner), 'winner resolved to a role');
  const assignment = JSON.parse(fs.readFileSync(path.join(pair.pairDir, 'assignment.json'), 'utf8'));
  assert(result.winner === assignment.b, 'winner matches the sealed assignment');
  assert(blind.readPair(pair.pairDir).status === 'unsealed', 'manifest status flips');

  const again = blind.unseal(pair.pairDir);
  assert(again.winner === result.winner && again.rationale === result.rationale, 'idempotent re-read');

  let late = false;
  try {
    blind.recordVerdict(pair.pairDir, { winner: 'a', rationale: 'post-unseal edit attempt, should refuse' });
  } catch (e) {
    late = /already unsealed/.test(e.message);
  }
  assert(late, 'verdict cannot change after unseal');
});

test('unseal maps a tie straight through', () => {
  const root = mkProject('godpowers-blind-tie-');
  const [current, proposed] = mkShots(root, ['current.png', 'proposed.png']);
  const pair = blind.preparePair({ roles: { current, proposed }, outDir: path.join(root, 'blind') });
  blind.recordVerdict(pair.pairDir, { winner: 'tie', rationale: 'no visible difference in hierarchy or contrast' });
  assert(blind.unseal(pair.pairDir).winner === 'tie', 'tie survives unsealing');
});

test('preparePair refuses to rebuild a judged pair', () => {
  const root = mkProject('godpowers-blind-rebuild-');
  const [candidate, reference] = mkShots(root);
  const outDir = path.join(root, 'blind');
  const pair = blind.preparePair({ roles: { candidate, reference }, outDir });
  blind.recordVerdict(pair.pairDir, { winner: 'a', rationale: 'stronger type contrast on the hero block' });
  let threw = false;
  try {
    blind.preparePair({ roles: { candidate, reference }, outDir });
  } catch (e) {
    threw = /already carries a verdict/.test(e.message);
  }
  assert(threw, 'judged pair cannot be rebuilt');
});

test('unseal reports a missing assignment sidecar', () => {
  const root = mkProject('godpowers-blind-sidecar-');
  const [candidate, reference] = mkShots(root);
  const pair = blind.preparePair({ roles: { candidate, reference }, outDir: path.join(root, 'blind') });
  blind.recordVerdict(pair.pairDir, { winner: 'a', rationale: 'denser information layout without crowding' });
  fs.rmSync(path.join(pair.pairDir, 'assignment.json'));
  let threw = false;
  try {
    blind.unseal(pair.pairDir);
  } catch (e) {
    threw = /assignment sidecar is missing/.test(e.message);
  }
  assert(threw, 'missing sidecar is a hard error');
});

report('Blind compare tests');
