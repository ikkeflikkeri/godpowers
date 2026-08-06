#!/usr/bin/env node
'use strict';

/**
 * Live advisory check: ask the registry directly, bypassing npm's cache.
 *
 * `npm audit` reads the advisory feed through npm's HTTP cache, so a local
 * `npm audit --omit=dev` can report zero findings while CI, minutes later,
 * fails the same gate on an advisory the feed published in between. That is
 * exactly how the `hono` advisory surfaced during 5.14.x: as a failed publish
 * run instead of a failed local gate (CONTRIBUTING.md, "Dependencies and
 * security advisories").
 *
 * This script closes the gap mechanically. It collects the resolved
 * production dependency set from package-lock.json (the same scope
 * `npm audit --omit=dev` evaluates, including workspace production deps) and
 * POSTs it to the registry's bulk advisory endpoint with plain fetch, no npm
 * cache in the path. Any advisory returned for the posted versions fails the
 * gate, matching npm audit's default behavior at every severity.
 *
 * Exit codes:
 *   0  no advisories affect the resolved production set
 *   1  advisories found (gate failure; merge the Dependabot PR, do not
 *      hand-roll an override; see CONTRIBUTING.md)
 *   2  check blocked (network or registry error); per
 *      docs/RELEASE-CHECKLIST.md, record the blocker and do not claim the
 *      check passed
 *
 * Wired into `test:audit` beside `npm audit --omit=dev` so the local release
 * gate and CI read the same live feed.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BULK_ADVISORY_URL = 'https://registry.npmjs.org/-/npm/v1/security/advisories/bulk';
const REQUEST_TIMEOUT_MS = 30000;

/**
 * Resolve the production package set from a v2/v3 lockfile `packages` map:
 * every registry-resolved entry not marked dev-only. Skips the root entry,
 * workspace link entries, and workspace source directories (our own
 * packages are not registry dependencies).
 *
 * Returns Map<name, Set<version>>.
 */
function collectProductionPackages(lockfile) {
  const out = new Map();
  for (const [key, entry] of Object.entries((lockfile && lockfile.packages) || {})) {
    if (key === '' || !entry || entry.dev || entry.link || !entry.version) continue;
    const marker = key.lastIndexOf('node_modules/');
    if (marker === -1) continue;
    const name = entry.name || key.slice(marker + 'node_modules/'.length);
    if (!out.has(name)) out.set(name, new Set());
    out.get(name).add(String(entry.version));
  }
  return out;
}

function formatAdvisory(name, versions, advisory) {
  const id = advisory.github_advisory_id || advisory.id || 'advisory';
  const range = advisory.vulnerable_versions || 'unknown range';
  const severity = advisory.severity || 'unknown severity';
  const title = advisory.title || 'untitled';
  return `  ${name} (resolved: ${[...versions].join(', ')}) ${severity} ${id}: ${title} [vulnerable: ${range}]`;
}

/**
 * Run the live check. `fetchImpl` is injectable for tests; the default is
 * global fetch. Returns { status: 'clean' | 'findings' | 'blocked' | 'empty',
 * lines, findingCount }.
 */
async function runCheck({ lockfile, fetchImpl = fetch } = {}) {
  const resolved = collectProductionPackages(lockfile);
  if (resolved.size === 0) {
    return { status: 'empty', lines: ['  0 production packages resolved; nothing to check.'], findingCount: 0 };
  }

  const body = {};
  for (const [name, versions] of resolved) body[name] = [...versions];

  let response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    response = await fetchImpl(BULK_ADVISORY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    clearTimeout(timer);
  } catch (e) {
    return {
      status: 'blocked',
      lines: [`  live advisory check blocked: ${e.message}. Record the blocker; do not claim the check passed.`],
      findingCount: 0
    };
  }

  if (!response.ok) {
    return {
      status: 'blocked',
      lines: [`  live advisory check blocked: registry responded ${response.status}. Record the blocker; do not claim the check passed.`],
      findingCount: 0
    };
  }

  const advisories = await response.json();
  const names = Object.keys(advisories || {}).filter((name) => (advisories[name] || []).length > 0);
  if (names.length === 0) {
    return {
      status: 'clean',
      lines: [`  + live advisory feed clean for ${resolved.size} production packages (no npm cache in the path)`],
      findingCount: 0
    };
  }

  const lines = [];
  let findingCount = 0;
  for (const name of names.sort()) {
    for (const advisory of advisories[name]) {
      lines.push(formatAdvisory(name, resolved.get(name) || new Set(['?']), advisory));
      findingCount++;
    }
  }
  lines.push('  Merge the Dependabot pull request rather than hand-rolling an override (CONTRIBUTING.md).');
  return { status: 'findings', lines, findingCount };
}

async function main() {
  const lockfile = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));
  const result = await runCheck({ lockfile });
  console.log('\n  Live advisory check\n');
  for (const line of result.lines) console.log(line);
  console.log('');
  if (result.status === 'findings') process.exit(1);
  if (result.status === 'blocked') process.exit(2);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(`  live advisory check blocked: ${e.message}`);
    process.exit(2);
  });
}

module.exports = { collectProductionPackages, runCheck, BULK_ADVISORY_URL };
