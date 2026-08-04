/**
 * Shared tier artifact map for dashboard, gates, and documentation checks.
 *
 * Scope: this owns the per-tier *gate artifacts* (which files a tier requires
 * and the state step it maps to). It is not a flat registry of every
 * `.godpowers/...` path: module-local artifacts (a sync module's log file, the
 * evidence ledger) live in their owning module, and `state.json` is named via
 * `state.STATE_FILE`.
 */

// Cadence tiers separate the speeds at which artifacts may legitimately
// change, so a fast loop can never thrash what a slow loop stewards:
//   fast: derived views and machine state; any loop may regenerate freely.
//   managed: bodies owned by a producing agent, with mechanical stampers
//     allowed only in fenced or single-line regions (version strings,
//     linkage footers).
//   slow: planning-tier bodies (PRD, ARCH, ROADMAP, stack DECISION, DESIGN).
//     Revised only by their owning tier specialist or greenfieldify behind
//     human approval. When a mechanical loop finds a slow artifact's hash
//     stale, the remedy is a review queue entry, never a re-stamp
//     (scripts/version-sync.js, lib/cadence-guard.js).
const CADENCE_LEVELS = ['fast', 'managed', 'slow', 'frozen'];

const TIER_ARTIFACTS = {
  prd: [
    { path: '.godpowers/prd/PRD.mdx', required: true, lint: true, cadence: 'slow' }
  ],
  design: [
    { path: 'DESIGN.md', required: true, lint: true, cadence: 'slow' },
    { path: 'PRODUCT.md', required: false, lint: true, cadence: 'slow' },
    { path: '.godpowers/state.json', required: true, lint: false, cadence: 'fast' }
  ],
  arch: [
    { path: '.godpowers/arch/ARCH.mdx', required: true, lint: true, cadence: 'slow' }
  ],
  roadmap: [
    { path: '.godpowers/roadmap/ROADMAP.mdx', required: true, lint: true, cadence: 'slow' }
  ],
  stack: [
    { path: '.godpowers/stack/DECISION.mdx', required: true, lint: true, cadence: 'slow' }
  ],
  repo: [
    { path: '.godpowers/repo/AUDIT.mdx', required: true, lint: true, cadence: 'managed' },
    // The style genome two agents already read as an input. Not required: a
    // prototype legitimately ships without one, and gating the repo tier on it
    // would fail projects the profile says do not owe it.
    { path: 'CODEDNA.md', required: false, lint: false, cadence: 'managed' }
  ],
  build: [
    { path: '.godpowers/state.json', required: true, lint: false, cadence: 'fast' }
  ],
  harden: [
    { path: '.godpowers/harden/FINDINGS.mdx', required: true, lint: true, cadence: 'managed' }
  ]
};

const TIER_STATE_STEPS = {
  design: { tierKey: 'tier-1', subStepKey: 'design' },
  build: { tierKey: 'tier-2', subStepKey: 'build' },
  // deploy has no artifact gate tier of its own, but the state-step mapping
  // lets evidence surfaces (the dashboard's claimed-vs-executed-backed pair)
  // cover it, since deploy is in evidence.EXECUTED_REQUIRED_SUBSTEPS.
  deploy: { tierKey: 'tier-3', subStepKey: 'deploy' },
  harden: { tierKey: 'tier-3', subStepKey: 'harden' }
};

function normalizeTier(tier) {
  if (!tier) return null;
  return String(tier).replace(/^\/?god-/, '').toLowerCase();
}

function tiers() {
  return Object.keys(TIER_ARTIFACTS);
}

function artifactsForTier(tier) {
  const key = normalizeTier(tier);
  if (!key || !TIER_ARTIFACTS[key]) return null;
  return TIER_ARTIFACTS[key].map((artifact) => ({ ...artifact }));
}

function requiredArtifactsForTier(tier) {
  const artifacts = artifactsForTier(tier);
  return artifacts ? artifacts.filter((artifact) => artifact.required) : null;
}

function stateStepForTier(tier) {
  const key = normalizeTier(tier);
  if (!key || !TIER_STATE_STEPS[key]) return null;
  return { ...TIER_STATE_STEPS[key] };
}

/**
 * Cadence tier for a gate artifact path. Returns null for paths the map does
 * not own (module-local artifacts declare their own cadence in their owning
 * module).
 */
function cadenceForArtifact(relPath) {
  for (const artifacts of Object.values(TIER_ARTIFACTS)) {
    for (const artifact of artifacts) {
      if (artifact.path === relPath) return artifact.cadence || null;
    }
  }
  return null;
}

module.exports = {
  TIER_ARTIFACTS,
  CADENCE_LEVELS,
  normalizeTier,
  tiers,
  artifactsForTier,
  requiredArtifactsForTier,
  stateStepForTier,
  cadenceForArtifact
};
