#!/usr/bin/env node

/**
 * Tests for scripts/check-live-advisories.js. Offline by design: fetch is
 * injected everywhere, and the real registry is never contacted.
 */

const fs = require('fs');
const path = require('path');

const { collectProductionPackages, runCheck } = require('./check-live-advisories');
const { test, asyncTest, assert, report } = require('./test-harness');

console.log('\n  Live advisory check tests\n');

const LOCKFILE = {
  packages: {
    '': { name: 'godpowers', version: '9.9.9' },
    'packages/mcp': { name: '@godpowers/mcp', version: '9.9.9' },
    'node_modules/@godpowers/mcp': { resolved: 'packages/mcp', link: true },
    'node_modules/prod-dep': { version: '1.2.3' },
    'node_modules/prod-dep/node_modules/nested-dep': { version: '4.5.6' },
    'node_modules/@scope/scoped-dep': { version: '7.8.9' },
    'node_modules/aliased': { name: 'real-name', version: '2.0.0' },
    'node_modules/dev-only': { version: '0.0.1', dev: true },
    'node_modules/versionless': {}
  }
};

test('collectProductionPackages keeps production entries and drops the rest', () => {
  const resolved = collectProductionPackages(LOCKFILE);
  assert(resolved.get('prod-dep').has('1.2.3'), 'direct production dep kept');
  assert(resolved.get('nested-dep').has('4.5.6'), 'nested name derived past inner node_modules');
  assert(resolved.get('@scope/scoped-dep').has('7.8.9'), 'scoped name preserved');
  assert(resolved.get('real-name').has('2.0.0'), 'entry.name overrides the path-derived name');
  assert(!resolved.has('dev-only'), 'dev-only entry dropped');
  assert(!resolved.has('@godpowers/mcp') && !resolved.has('godpowers'), 'root, workspace dir, and link dropped');
  assert(collectProductionPackages({}).size === 0, 'missing packages map -> empty');
  assert(collectProductionPackages(null).size === 0, 'null lockfile -> empty');
});

test('collectProductionPackages parses the real lockfile without network', () => {
  const real = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package-lock.json'), 'utf8'));
  const resolved = collectProductionPackages(real);
  assert(resolved instanceof Map, 'returns a map');
  for (const [name, versions] of resolved) {
    assert(name && versions.size > 0, `entry ${name} carries versions`);
  }
});

asyncTest('runCheck passes when the live feed returns no advisories', async () => {
  let posted = null;
  const fetchImpl = async (url, opts) => {
    posted = JSON.parse(opts.body);
    return { ok: true, status: 200, json: async () => ({}) };
  };
  const result = await runCheck({ lockfile: LOCKFILE, fetchImpl });
  assert(result.status === 'clean' && result.findingCount === 0, 'clean status');
  assert(posted['prod-dep'].includes('1.2.3'), 'resolved versions posted');
  assert(!('dev-only' in posted), 'dev deps never posted');
});

asyncTest('runCheck fails on any returned advisory, matching npm audit severity behavior', async () => {
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      'prod-dep': [{ github_advisory_id: 'GHSA-test', severity: 'low', title: 'Test advisory', vulnerable_versions: '<2.0.0' }],
      'nested-dep': []
    })
  });
  const result = await runCheck({ lockfile: LOCKFILE, fetchImpl });
  assert(result.status === 'findings' && result.findingCount === 1, 'one finding, even at low severity');
  assert(result.lines.some((l) => /GHSA-test/.test(l) && /1\.2\.3/.test(l)), 'finding names advisory and resolved version');
  assert(result.lines.some((l) => /Dependabot/.test(l)), 'remediation points at Dependabot, not overrides');
});

asyncTest('runCheck reports blocked on HTTP errors and network failures, never clean', async () => {
  const httpError = await runCheck({ lockfile: LOCKFILE, fetchImpl: async () => ({ ok: false, status: 503 }) });
  assert(httpError.status === 'blocked' && /503/.test(httpError.lines[0]), 'HTTP error is blocked');
  const netError = await runCheck({ lockfile: LOCKFILE, fetchImpl: async () => { throw new Error('offline'); } });
  assert(netError.status === 'blocked' && /offline/.test(netError.lines[0]), 'thrown fetch is blocked');
  assert(/do not claim the check passed/.test(netError.lines[0]), 'blocked wording forbids claiming a pass');
});

asyncTest('runCheck skips the network entirely when no production packages resolve', async () => {
  let called = false;
  const fetchImpl = async () => { called = true; return { ok: true, status: 200, json: async () => ({}) }; };
  const result = await runCheck({ lockfile: { packages: { '': {}, 'node_modules/x': { dev: true, version: '1.0.0' } } }, fetchImpl });
  assert(result.status === 'empty' && called === false, 'empty set never posts');
});

report('Live advisory check tests');
