#!/usr/bin/env node
/**
 * Keep public surface claims tied to the repository contents.
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));

function countFiles(dir, pattern) {
  return fs
    .readdirSync(path.join(root, dir))
    .filter((name) => pattern.test(name))
    .length;
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function assertIncludes(rel, expected) {
  const content = read(rel);
  if (!content.includes(expected)) {
    throw new Error(`${rel} missing expected text: ${expected}`);
  }
}

function countTree(dir, pattern) {
  let total = 0;
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    if (entry.isDirectory()) total += countTree(path.join(dir, entry.name), pattern);
    else if (pattern.test(entry.name)) total += 1;
  }
  return total;
}

const counts = {
  skills: countFiles('skills', /^god.*\.md$/),
  agents: countFiles('specialists', /^god.*\.md$/),
  workflows: countFiles('workflows', /\.yaml$/),
  recipes: countFiles(path.join('routing', 'recipes'), /\.yaml$/),
  libModules: countFiles('lib', /\.js$/),
  routes: countFiles('routing', /\.yaml$/),
  templates: countFiles('templates', /\./),
  references: countTree('references', /\.md$/),
  docsPages: countFiles('docs', /\.md$/),
  testScripts: countFiles('scripts', /^test-.*\.js$/),
};

// The have-not total is owned by references/HAVE-NOTS.md and independently
// checked against the body by scripts/test-have-nots-tally.js. Read it rather
// than recounting, so this file cannot disagree with that gate.
const haveNotsMatch = read(path.join('references', 'HAVE-NOTS.md'))
  .match(/\*\*Total:\s+(\d+)\s+named have-nots\.\*\*/);
if (!haveNotsMatch) {
  throw new Error('references/HAVE-NOTS.md is missing its "Total: N named have-nots." line');
}
counts.haveNots = Number(haveNotsMatch[1]);

const version = pkg.version;
const surface = `${counts.skills} skills, ${counts.agents} agents`;
const commandSurface = `${counts.skills} slash commands`;
const workflowSurface = `${counts.workflows} workflows`;
const recipeSurface = `${counts.recipes} recipes`;

assertIncludes('package.json', `${counts.skills} slash commands and ${counts.agents} specialist agents`);
assertIncludes('README.md', `version-${version}-blue`);
assertIncludes('README.md', `all ${counts.skills} skills + ${counts.agents} agents`);
assertIncludes('USERS.md', `current source version is v${version}`);
assertIncludes('ARCHITECTURE.md', `STABLE v${version}`);
assertIncludes('ARCHITECTURE.md', `Core: ${surface}, ${workflowSurface}`);
assertIncludes('docs/ROADMAP.md', `Current source: v${version}`);
assertIncludes('docs/ROADMAP.md', `**${commandSurface}**`);
assertIncludes('docs/ROADMAP.md', `**${counts.agents} specialist agents**`);
assertIncludes('docs/reference.md', `reference for v${version}`);
assertIncludes('docs/reference.md', `Slash commands (${counts.skills} total)`);
assertIncludes('docs/reference.md', `Specialist agents (${counts.agents} total)`);
assertIncludes('skills/god-version.md', `Surface: ${surface}, ${workflowSurface}, ${recipeSurface}`);
assertIncludes('skills/god-doctor.md', `[OK] ${counts.skills} skills installed`);
assertIncludes('skills/god-doctor.md', `[OK] ${counts.agents} agents installed`);

// ARCHITECTURE-MAP.md was the one count-bearing doc with no machine guard, so it
// silently rotted to v2.4.3 counts (DOC-001). Guard its surface and version
// markers here so it stays in lockstep with the rest of the release surface.
assertIncludes('ARCHITECTURE-MAP.md',
  `${counts.skills} slash commands, ${counts.agents} agents, ${counts.workflows} workflows, ${counts.recipes} recipes`);
assertIncludes('ARCHITECTURE-MAP.md', `## Numbers (as of v${version})`);
assertIncludes('ARCHITECTURE-MAP.md', `package.json (v${version})`);
assertIncludes('ARCHITECTURE-MAP.md', `<- ${counts.skills} slash-command skill files`);
assertIncludes('ARCHITECTURE-MAP.md', `Real JS runtime (${counts.libModules} modules)`);
assertIncludes('ARCHITECTURE-MAP.md', `| Slash commands | ${counts.skills} |`);
assertIncludes('ARCHITECTURE-MAP.md', `| Intent recipes | ${counts.recipes} |`);
assertIncludes('ARCHITECTURE-MAP.md', `**JS runtime modules** | **${counts.libModules}**`);

// The 5.11.0 -> 5.12.0 audit found a second wave of the DOC-001 failure: every
// count-bearing line NOT listed above had rotted. ARCHITECTURE.md still said
// 120 skills and 120 routes, ARCHITECTURE-MAP.md said 39 reference documents,
// 34 docs pages, and 80 test suites. Each was true once. None was guarded, so
// nothing noticed. Guard them here, derived from disk, so the next drift is a
// test failure instead of a wrong sentence a reader has no reason to doubt.
const derivedSurfaceClaims = [
  // ARCHITECTURE.md route-topology block and its summary table.
  ['ARCHITECTURE.md', `${counts.skills}\n\`skills/*.md\` command files match ${counts.routes} \`routing/*.yaml\` route files`],
  ['ARCHITECTURE.md', `includes ${counts.agents} \`specialists/god-*.md\` specialist\nagents, ${counts.workflows} workflow YAML files, and ${counts.recipes} intent recipes.`],
  ['ARCHITECTURE.md', `All ${counts.recipes} recipes contain at least one slash-command route`],
  ['ARCHITECTURE.md', `| Skills | ${counts.skills} |`],
  ['ARCHITECTURE.md', `| Routes | ${counts.routes} |`],
  ['ARCHITECTURE.md', `| Agents | ${counts.agents} |`],
  ['ARCHITECTURE.md', `| Workflows | ${counts.workflows} |`],
  ['ARCHITECTURE.md', `| Recipes | ${counts.recipes} |`],

  // ARCHITECTURE-MAP.md repository tree and Numbers table.
  ['ARCHITECTURE-MAP.md', `<- ${counts.agents} core specialist agents`],
  ['ARCHITECTURE-MAP.md', `<- ${counts.workflows} executable workflow YAMLs`],
  ['ARCHITECTURE-MAP.md', `<- ${counts.templates} artifact templates`],
  ['ARCHITECTURE-MAP.md', `(${counts.skills} = ${counts.skills - 1} \`god-*\` commands`],
  ['ARCHITECTURE-MAP.md', `| Specialist agents | ${counts.agents} |`],
  ['ARCHITECTURE-MAP.md', `| Workflows (core YAMLs) | ${counts.workflows} |`],
  ['ARCHITECTURE-MAP.md', `| Have-nots | ${counts.haveNots} documented`],
  ['ARCHITECTURE-MAP.md', `| Templates | ${counts.templates} |`],
  ['ARCHITECTURE-MAP.md', `| Reference documents | ${counts.references} |`],
  ['ARCHITECTURE-MAP.md', `| Documentation pages | ${counts.docsPages} under docs/`],
  ['ARCHITECTURE-MAP.md', `| **Test suites** | **${counts.testScripts} script files`],

  // Prose surfaces that quote a count in a sentence.
  ['README.md', `are ${counts.skills} of them`],
  ['README.md', `all ${counts.skills} commands visible at once`],
  ['README.md', `${counts.skills} slash commands, ${counts.agents} specialist agents,\n${counts.workflows} workflows, and ${counts.recipes} recipes.`],
  ['RELEASE.md', `core package contains ${counts.libModules} runtime library modules`],
  ['docs/reference.md', `The ${counts.skills} total is ${counts.skills - 1} \`god-*\` commands`],
  ['docs/reference.md', `All ${counts.skills} commands remain direct entry points`],
  ['docs/getting-started.md', `all ${counts.skills} slash commands and CLI helpers`],
  ['docs/loop-engineering.md', `the ${counts.skills} skills carry durable`],
  ['docs/surface-contraction.md', `the full ${counts.skills}-command compatibility profile`],
  ['docs/arc-integrations.md', `How ${counts.workflows} executable workflows, ${counts.recipes} intent recipes, and ${counts.skills} slash commands`],
  ['docs/arc-integrations.md', `${counts.workflows} executable workflows, ${counts.recipes} recipes, ${counts.skills} slash\ncommands, and ${counts.agents} agents.`],
  ['skills/god-agent-audit.md', `${counts.agents} agents audited`],
  ['skills/god-agent-audit.md', `${counts.agents} structured contracts`],
  ['agents/arch.md', `all ${counts.skills} shipped skills`],

  // Pillars context files. Not shipped in the package, but they are what a
  // cold-start agent reads first, so a stale count here misleads every run.
  ['agents/context.md', `includes ${counts.skills} slash commands, ${counts.agents} specialist agents, ${counts.workflows} workflows, and ${counts.recipes} recipes`],
  ['agents/context.md', `contains ${counts.libModules} runtime library modules`],
  ['agents/deploy.md', `contains ${counts.skills} slash commands, ${counts.agents} specialist agents, ${counts.workflows} workflows, and ${counts.recipes} recipes`],
  ['agents/deploy.md', `contains ${counts.libModules} runtime library modules`],
];
for (const [rel, expected] of derivedSurfaceClaims) {
  assertIncludes(rel, expected);
}

// Install-profile sizes in docs/surface-contraction.md rotted silently as the
// profiles grew. Derive each size from lib/install-profiles.js selection
// against the shipped skills/ directory so the doc cannot drift again.
const installProfiles = require(path.join(root, 'lib', 'install-profiles.js'));
const skillNames = fs
  .readdirSync(path.join(root, 'skills'))
  .filter((name) => /^god.*\.md$/.test(name))
  .map((name) => name.replace(/\.md$/, ''));
for (const profile of [...Object.keys(installProfiles.PROFILE_SKILLS), 'full']) {
  const size = installProfiles.selectedSkillNames(profile, skillNames).size;
  assertIncludes(
    'docs/surface-contraction.md',
    `The \`${profile}\` profile currently selects ${size} skills from the shipped \`skills/\` directory.`
  );
}

// Catalog completeness (DOC-004 / PATTERN-E): every lib/*.js must have a row in
// lib/README.md so the "living module catalog" cannot silently drift again.
const libReadme = read(path.join('lib', 'README.md'));
const undocumented = fs
  .readdirSync(path.join(root, 'lib'))
  .filter((name) => /\.js$/.test(name))
  .filter((name) => !libReadme.includes('`' + name + '`'));
if (undocumented.length > 0) {
  throw new Error(`lib/README.md is missing catalog rows for: ${undocumented.join(', ')}`);
}

console.log(`  + public surface docs match v${version}: ${surface}, ${workflowSurface}, ${recipeSurface}, ${counts.libModules} lib modules; lib/README catalog complete`);
console.log(`  + ${derivedSurfaceClaims.length} derived count claims match disk across ${new Set(derivedSurfaceClaims.map(([rel]) => rel)).size} files: ${counts.routes} routes, ${counts.templates} templates, ${counts.references} references, ${counts.docsPages} docs pages, ${counts.testScripts} test scripts, ${counts.haveNots} have-nots`);
