#!/usr/bin/env node

const artifactMap = require('../lib/artifact-map');
const guard = require('../lib/cadence-guard');
const { test, assert, report } = require('./test-harness');

const ROADMAP = [
  '# Roadmap',
  '',
  'Source version: `5.14.3`',
  '',
  '## Now',
  '',
  '- [DECISION] Ship the thing.'
].join('\n');

test('artifact map assigns cadence tiers to every gate artifact', () => {
  for (const artifacts of Object.values(artifactMap.TIER_ARTIFACTS)) {
    for (const artifact of artifacts) {
      assert(artifactMap.CADENCE_LEVELS.includes(artifact.cadence),
        `${artifact.path} has no valid cadence: ${artifact.cadence}`);
    }
  }
  assert(artifactMap.cadenceForArtifact('.godpowers/roadmap/ROADMAP.mdx') === 'slow',
    'roadmap must be a slow artifact');
  assert(artifactMap.cadenceForArtifact('.godpowers/state.json') === 'fast',
    'state.json must be a fast artifact');
  assert(artifactMap.cadenceForArtifact('unknown.md') === null,
    'unknown paths return null');
});

test('a matching hash classifies as fresh', () => {
  const delta = guard.classifyRoadmapDelta({
    recordedHash: guard.sha(ROADMAP),
    roadmapText: ROADMAP,
    version: '5.14.3',
    previousVersion: '5.14.3'
  });
  assert(delta.verdict === 'fresh', `expected fresh, got ${delta.verdict}`);
});

test('a delta that is exactly the managed version stamp classifies as managed-stamp', () => {
  const stamped = ROADMAP.replace('Source version: `5.14.3`', 'Source version: `5.15.0`');
  const delta = guard.classifyRoadmapDelta({
    recordedHash: guard.sha(ROADMAP),
    roadmapText: stamped,
    version: '5.15.0',
    previousVersion: '5.14.3'
  });
  assert(delta.verdict === 'managed-stamp', `expected managed-stamp, got ${delta.verdict}`);
});

test('a body change classifies as content-drift even alongside a version stamp', () => {
  const stampedAndEdited = ROADMAP
    .replace('Source version: `5.14.3`', 'Source version: `5.15.0`')
    .replace('Ship the thing.', 'Ship a different thing.');
  const delta = guard.classifyRoadmapDelta({
    recordedHash: guard.sha(ROADMAP),
    roadmapText: stampedAndEdited,
    version: '5.15.0',
    previousVersion: '5.14.3'
  });
  assert(delta.verdict === 'content-drift', `expected content-drift, got ${delta.verdict}`);
});

test('a body change with no version stamp classifies as content-drift', () => {
  const edited = ROADMAP.replace('Ship the thing.', 'Ship a different thing.');
  const delta = guard.classifyRoadmapDelta({
    recordedHash: guard.sha(ROADMAP),
    roadmapText: edited,
    version: '5.14.3',
    previousVersion: '5.14.3'
  });
  assert(delta.verdict === 'content-drift', `expected content-drift, got ${delta.verdict}`);
});

test('roadmapSourceVersion reads the managed line', () => {
  assert(guard.roadmapSourceVersion(ROADMAP) === '5.14.3',
    `unexpected version: ${guard.roadmapSourceVersion(ROADMAP)}`);
  assert(guard.roadmapSourceVersion('no line here') === null, 'missing line returns null');
});

report('Cadence guard tests');
