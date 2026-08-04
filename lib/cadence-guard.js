/**
 * Slow-artifact re-bless guard.
 *
 * The roadmap is a slow-cadence artifact (lib/artifact-map.js): its body is
 * stewarded by the roadmap tier, and the only region a mechanical stamper may
 * touch is the managed `Source version` line. When the blessed hash recorded
 * in state.json goes stale, this module decides whether the delta is the
 * mechanical stamp (safe to re-bless) or content drift (escalate for review,
 * never re-stamp). Commit 1e99b1b is the incident this exists to prevent: a
 * dependency bump closed a roadmap-freshness check by blind re-stamp with
 * zero content review (see the 5.14.3 notes in RELEASE.md).
 */

const crypto = require('crypto');

const SOURCE_VERSION_LINE = /(Source version: `)([0-9]+\.[0-9]+\.[0-9]+)(`)/;

function sha(text) {
  return `sha256:${crypto.createHash('sha256').update(text).digest('hex')}`;
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Classify why the recorded roadmap hash no longer matches the bytes on disk.
 *
 * @param {{ recordedHash: string|null, roadmapText: string,
 *   version: string, previousVersion?: string|null }} input
 *   `version` is the version currently stamped in the managed line;
 *   `previousVersion` is what the line held before the mechanical stamp
 *   (null/equal when no stamp happened this run).
 * @returns {{ verdict: 'fresh'|'managed-stamp'|'content-drift',
 *   currentHash: string }}
 */
function classifyRoadmapDelta(input) {
  const roadmapText = String(input.roadmapText || '');
  const currentHash = sha(roadmapText);
  if (input.recordedHash === currentHash) {
    return { verdict: 'fresh', currentHash };
  }
  const previous = input.previousVersion;
  if (previous && previous !== input.version) {
    const reverted = roadmapText.replace(
      new RegExp(`(Source version: \`)${escapeRegExp(input.version)}(\`)`),
      `$1${previous}$2`
    );
    if (input.recordedHash === sha(reverted)) {
      return { verdict: 'managed-stamp', currentHash };
    }
  }
  return { verdict: 'content-drift', currentHash };
}

/**
 * Read the version currently held by the managed Source version line.
 */
function roadmapSourceVersion(roadmapText) {
  const match = String(roadmapText || '').match(SOURCE_VERSION_LINE);
  return match ? match[2] : null;
}

module.exports = {
  sha,
  classifyRoadmapDelta,
  roadmapSourceVersion
};
