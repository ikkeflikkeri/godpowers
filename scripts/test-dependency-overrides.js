#!/usr/bin/env node
/**
 * Keep the npm `overrides` block honest.
 *
 * An override is a permanent, invisible constraint. It is the right tool in
 * exactly one situation: an advisory whose fix sits OUTSIDE the range every
 * parent declares, so no amount of resolution reaches it. That was true once
 * here, when `@modelcontextprotocol/sdk` 1.29.0 declared
 * `@hono/node-server: "^1.19.9"` and no 1.x release was ever patched for
 * GHSA-frvp-7c67-39w9.
 *
 * It is the wrong tool everywhere else. During the 5.14.x releases four
 * overrides were added for advisories whose patched versions were already
 * inside the declaring parent's range; npm would have selected them on its own,
 * and a lockfile refresh did. Each of those four then sat in the manifest as a
 * major-version ceiling nobody would think to revisit: `fast-uri: "^3.1.5"`
 * capped at 3.x while upstream was already shipping 4.x.
 *
 * That ceiling is not merely untidy. Dependabot reads npm overrides, and when
 * an override caps resolution below a fix it produces no pull request at all,
 * only an error recorded against the alert. A stale override is therefore a way
 * for the repository to look patched while being pinned to a vulnerable version
 * with nothing on the dashboard to say so.
 *
 * This check asserts, for every override:
 *
 *   1. The package is actually in the tree. An override for something no longer
 *      depended on is dead weight that will confuse the next reader.
 *   2. The override is load-bearing. If every parent that declares the package
 *      already permits the resolved version, npm reaches it unaided and the
 *      override should be deleted.
 *   3. It carries a reason. An override needs an advisory id in
 *      `overrides-rationale`, so retiring it is a lookup rather than an
 *      archaeology exercise.
 *
 * Offline and semver-only: it reads package.json and package-lock.json and
 * talks to no network. Advisory freshness is the job of
 * `.github/workflows/security-audit.yml`.
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function read(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
}

const pkg = read('package.json');
const lock = read('package-lock.json');

const overrides = pkg.overrides || {};
const rationale = pkg['overrides-rationale'] || {};
const names = Object.keys(overrides);

// --- Minimal semver range satisfaction ------------------------------------
// The repo keeps zero production dependencies, so a semver library is not on
// the table. This covers the range forms npm manifests actually use: ^, ~, >=,
// bare versions, x-ranges, and `||` unions. Anything it cannot parse is
// reported rather than assumed to pass, so a novel range shape surfaces as a
// failure to investigate instead of a silent green.
function parseVersion(value) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(String(value).trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compare(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

function satisfiesComparator(version, comparator) {
  const raw = comparator.trim();
  if (raw === '' || raw === '*' || raw === 'x') return true;

  const operator = /^(>=|<=|>|<|=|\^|~)?\s*(.*)$/.exec(raw);
  const op = operator[1] || '=';
  const target = parseVersion(operator[2]);
  if (!target) return null;

  const cmp = compare(version, target);
  if (op === '>=') return cmp >= 0;
  if (op === '<=') return cmp <= 0;
  if (op === '>') return cmp > 0;
  if (op === '<') return cmp < 0;
  if (op === '=') return cmp === 0;
  if (op === '~') {
    // ~1.2.3 allows patch-level changes within 1.2.x
    return cmp >= 0 && version[0] === target[0] && version[1] === target[1];
  }
  // ^1.2.3 allows changes that do not modify the leftmost non-zero element.
  if (target[0] !== 0) return cmp >= 0 && version[0] === target[0];
  if (target[1] !== 0) return cmp >= 0 && version[0] === 0 && version[1] === target[1];
  return cmp === 0;
}

function satisfies(versionString, range) {
  const version = parseVersion(versionString);
  if (!version) return null;
  for (const union of String(range).split('||')) {
    const comparators = union.trim().split(/\s+/).filter(Boolean);
    if (comparators.length === 0) continue;
    let all = true;
    for (const comparator of comparators) {
      const result = satisfiesComparator(version, comparator);
      if (result === null) return null;
      if (!result) { all = false; break; }
    }
    if (all) return true;
  }
  return false;
}

// --- Resolved version and declaring parents for a package -----------------
function resolvedVersion(name) {
  const entry = lock.packages[`node_modules/${name}`];
  return entry ? entry.version : null;
}

function declaringParents(name) {
  const parents = [];
  for (const [location, entry] of Object.entries(lock.packages)) {
    for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
      const range = entry[field] && entry[field][name];
      if (range) parents.push({ location: location || '<root>', field, range });
    }
  }
  return parents;
}

const failures = [];

for (const name of names) {
  const range = overrides[name];
  const version = resolvedVersion(name);

  if (!version) {
    failures.push(
      `override "${name}": "${range}" has no entry in package-lock.json. Nothing depends on it any more; delete the override.`
    );
    continue;
  }

  if (!rationale[name]) {
    failures.push(
      `override "${name}": "${range}" has no "overrides-rationale" entry. Record the advisory id it exists for, so it can be retired without archaeology.`
    );
  }

  const parents = declaringParents(name);
  if (parents.length === 0) continue;

  // Load-bearing means at least one declaring parent would NOT permit the
  // version we ended up on. If every parent already allows it, npm reaches it
  // without help and the override is a ceiling for no benefit.
  let anyParentExcludes = false;
  let unparsed = null;
  for (const parent of parents) {
    const result = satisfies(version, parent.range);
    if (result === null) { unparsed = parent; continue; }
    if (!result) { anyParentExcludes = true; break; }
  }

  if (unparsed && !anyParentExcludes) {
    failures.push(
      `override "${name}": could not parse the range "${unparsed.range}" declared by ${unparsed.location}. Extend the comparator support in this file rather than assuming the override is needed.`
    );
    continue;
  }

  if (!anyParentExcludes) {
    failures.push(
      `override "${name}": "${range}" is not load-bearing. Every parent that declares ${name} already permits the resolved ${version}, so npm selects it unaided. Delete the override and refresh the lockfile; an override that changes nothing is a major-version ceiling that will silently block a future fix.`
    );
  }
}

// A rationale for an override that no longer exists is its own kind of rot.
for (const name of Object.keys(rationale)) {
  if (!names.includes(name)) {
    failures.push(
      `"overrides-rationale" names "${name}" but there is no such override. Remove the stale rationale.`
    );
  }
}

if (failures.length > 0) {
  console.error('\n  Dependency override check failed:\n');
  for (const failure of failures) console.error(`  x ${failure}\n`);
  process.exit(1);
}

console.log(
  names.length === 0
    ? '  + no npm overrides declared; every dependency resolves through its declared ranges'
    : `  + ${names.length} npm override(s) load-bearing, present in the lockfile, and justified`
);
