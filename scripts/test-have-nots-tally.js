#!/usr/bin/env node
/**
 * Keep the "Reference Tally" in references/HAVE-NOTS.md tied to the actual
 * have-not entries in the body.
 *
 * The tally (the "- <Section>: N" lines and the "Total: N named have-nots."
 * line near the bottom of the file) is prose, so it silently rots when an
 * entry is added or removed. During the 5.2.0 change U-14 was added to the
 * body but the tally kept saying "Universal: 13" / "Total: 157". This test
 * counts the real "### X-NN" / "#### X-NN" entries per section, asserts every
 * tally number matches its section's true entry count, and asserts the Total
 * line equals the sum. It also checks lib/have-nots-validator.js's header
 * count so the two count-bearing surfaces cannot drift apart.
 *
 * Entries are attributed to the nearest preceding "Have-Nots" header, so the
 * check does not depend on the tally listing sections in body order (the body
 * orders Tier 1 as Domain Glossary / Roadmap / Stack, the tally as Roadmap /
 * Stack / Domain Glossary).
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const HAVE_NOTS = path.join('references', 'HAVE-NOTS.md');
const VALIDATOR = path.join('lib', 'have-nots-validator.js');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const HEADER_RE = /^(#{2,4})\s+(.*\S)\s*$/;
const ENTRY_RE = /^#{3,4}\s+[A-Z]{1,3}-\d{2}\b/;
const TALLY_RE = /^-\s+(.+?):\s+(\d+)\s*$/;
const TOTAL_RE = /\*\*Total:\s+(\d+)\s+named have-nots\.\*\*/;

const content = read(HAVE_NOTS);

const TALLY_MARKER = '## Reference Tally';
const markerIndex = content.indexOf(TALLY_MARKER);
if (markerIndex === -1) {
  throw new Error(`${HAVE_NOTS} is missing its "${TALLY_MARKER}" section.`);
}
const body = content.slice(0, markerIndex);
const tallyText = content.slice(markerIndex);

// --- Count real entries per body section --------------------------------
// A "section" is the nearest preceding header whose title mentions
// "Have-Nots"; an "entry" is a header like "### U-01" or "#### P-01".
const sections = [];
let current = null;
for (const line of body.split('\n')) {
  const header = line.match(HEADER_RE);
  if (!header) continue;
  const title = header[2];
  if (ENTRY_RE.test(line)) {
    if (!current) {
      throw new Error(`${HAVE_NOTS}: entry "${title}" appears before any Have-Nots section header.`);
    }
    current.count += 1;
  } else if (/Have-Nots/.test(title)) {
    current = { title, count: 0 };
    sections.push(current);
  }
}
// Intermediate tier headers (e.g. "Tier 1: Planning Have-Nots") hold no
// entries of their own; only sections that actually contain entries are
// tallied.
const countingSections = sections.filter((s) => s.count > 0);

// --- Parse the Reference Tally -----------------------------------------
const tally = [];
for (const line of tallyText.split('\n')) {
  const match = line.match(TALLY_RE);
  if (match) {
    tally.push({ label: match[1], count: Number(match[2]) });
  }
}
if (tally.length === 0) {
  throw new Error(`${HAVE_NOTS}: no "- <Section>: N" tally lines found under ${TALLY_MARKER}.`);
}

const totalMatch = tallyText.match(TOTAL_RE);
if (!totalMatch) {
  throw new Error(`${HAVE_NOTS}: could not find the "**Total: N named have-nots.**" line.`);
}
const declaredTotal = Number(totalMatch[1]);

// --- Match each tally line to exactly one body section ------------------
// The tally labels ("Tier 1 PRD", "Workflow Deps", ...) carry a distinctive
// key ("PRD", "Deps") that appears in exactly one counting section's title.
const used = new Set();
for (const line of tally) {
  const key = line.label.replace(/^(Tier \d+|Workflow)\s+/, '');
  const matches = countingSections.filter((s) => s.title.includes(key));
  if (matches.length !== 1) {
    throw new Error(
      `Reference Tally line "${line.label}: ${line.count}" (key "${key}") matched ${matches.length} body sections; expected exactly 1.`
    );
  }
  const section = matches[0];
  if (used.has(section)) {
    throw new Error(
      `Reference Tally maps more than one line to the "${section.title}" section (line "${line.label}").`
    );
  }
  used.add(section);
  if (section.count !== line.count) {
    throw new Error(
      `Reference Tally says "${line.label}: ${line.count}" but the body has ${section.count} "${section.title}" entries.`
    );
  }
}

// Every counting section must be represented in the tally (catches a new
// section added to the body but not the tally).
const unlisted = countingSections.filter((s) => !used.has(s));
if (unlisted.length > 0) {
  throw new Error(
    `Reference Tally is missing lines for body section(s): ${unlisted.map((s) => `"${s.title}" (${s.count})`).join(', ')}.`
  );
}

// --- Totals -------------------------------------------------------------
const tallySum = tally.reduce((sum, line) => sum + line.count, 0);
const actualSum = countingSections.reduce((sum, s) => sum + s.count, 0);
if (tallySum !== declaredTotal) {
  throw new Error(
    `Reference Tally section numbers sum to ${tallySum} but the Total line says ${declaredTotal}.`
  );
}
if (actualSum !== declaredTotal) {
  throw new Error(
    `The body contains ${actualSum} named have-nots but the Total line says ${declaredTotal}.`
  );
}

// --- Keep the validator header count in lockstep ------------------------
const validatorSrc = read(VALIDATOR);
const validatorMatch = validatorSrc.match(/against the (\d+) named have-nots/);
if (!validatorMatch) {
  throw new Error(`${VALIDATOR}: could not find the "against the N named have-nots" header count.`);
}
const validatorCount = Number(validatorMatch[1]);
if (validatorCount !== declaredTotal) {
  throw new Error(
    `${VALIDATOR} header says ${validatorCount} named have-nots but ${HAVE_NOTS} totals ${declaredTotal}.`
  );
}

// --- Route standards blocks must not drift from the catalog ---------------
// A `standards.have-nots` list in routing/*.yaml is the contract the gate
// reads, and nothing checked it. Two lists had already rotted: /god-docs still
// named DC-01..DC-05 after 5.13.0 added DC-06..DC-11, and /god-roadmap-update
// stopped at R-07. The rule is deliberately blunt: a route that claims a
// prefix claims all of it, so adding a have-not to a tier cannot silently
// leave the command that authors that tier's artifact checking fewer.
const catalogCodes = new Set();
for (const match of body.matchAll(/^#{3,4}\s+([A-Z]{1,3}-\d{2})\b/gm)) {
  catalogCodes.add(match[1]);
}
const codesByPrefix = new Map();
for (const code of catalogCodes) {
  const prefix = code.slice(0, code.lastIndexOf('-'));
  if (!codesByPrefix.has(prefix)) codesByPrefix.set(prefix, []);
  codesByPrefix.get(prefix).push(code);
}

const routingDir = path.join(root, 'routing');
let routesChecked = 0;
for (const name of fs.readdirSync(routingDir).sort()) {
  if (!name.endsWith('.yaml')) continue;
  const routeSrc = fs.readFileSync(path.join(routingDir, name), 'utf8');
  const listMatch = routeSrc.match(/have-nots:\s*\[([^\]]*)\]/);
  if (!listMatch) continue;
  const listed = listMatch[1].split(',').map((code) => code.trim()).filter(Boolean);
  if (listed.length === 0) continue;
  routesChecked += 1;

  const phantom = listed.filter((code) => !catalogCodes.has(code));
  if (phantom.length > 0) {
    throw new Error(
      `routing/${name} lists have-not(s) that do not exist in ${HAVE_NOTS}: ${phantom.join(', ')}.`
    );
  }

  const prefixes = [...new Set(listed.map((code) => code.slice(0, code.lastIndexOf('-'))))];
  for (const prefix of prefixes) {
    const missing = (codesByPrefix.get(prefix) || []).filter((code) => !listed.includes(code));
    if (missing.length > 0) {
      throw new Error(
        `routing/${name} checks the ${prefix}-* have-nots but omits ${missing.join(', ')}.`
      );
    }
  }
}

console.log(
  `  + HAVE-NOTS reference tally matches body: ${countingSections.length} sections, ${declaredTotal} named have-nots; validator header in sync`
);
console.log(
  `  + ${routesChecked} routing have-not lists resolve to the catalog with no prefix gaps`
);
