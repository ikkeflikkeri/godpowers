/**
 * Style statistics: the measured layer of the style genome.
 *
 * `references/building/STYLE-GENOME.md` asks for numeric norms (comment density,
 * naming-casing histograms, function-length median and p90) and until now nothing
 * produced them, so `god-repo-scaffolder` would have had to estimate from a
 * handful of files and `god-quality-reviewer` judged style by eye. This counts.
 *
 * The measurement discipline comes from codedna (hannsxpeter/codedna). This is a
 * reimplementation for the Node runtime, not a copy of its Python helper, and
 * neither project imports the other. Port fixes by editing both.
 *
 * Numbers are evidence to interpret, not rules to paste. When a histogram and the
 * code disagree the code wins, which is why the report carries sample counts: a
 * casing split derived from four identifiers is noise, not a convention.
 *
 * Public API:
 *   scan(projectRoot, opts) -> { languages, files, skipped }
 *   classifyCasing(name) -> 'camelCase' | 'PascalCase' | ... | 'lower'
 */

const fs = require('fs');
const path = require('path');

const IGNORED_DIRS = new Set([
  '.git', 'node_modules', 'dist', 'build', 'out', 'target', 'vendor',
  'coverage', '.next', '.nuxt', '.svelte-kit', '.venv', 'venv', '__pycache__',
  '.godpowers', '.godaudits', '.godplans'
]);

// Extension to language, and per-language comment and function syntax. Kept to
// the languages godpowers actually routes for; an unlisted extension is skipped
// rather than guessed at, so an unfamiliar tree reports fewer languages instead
// of wrong numbers for one.
const LANGUAGES = {
  '.js': 'js', '.jsx': 'js', '.mjs': 'js', '.cjs': 'js',
  '.ts': 'ts', '.tsx': 'ts',
  '.py': 'py',
  '.go': 'go',
  '.rs': 'rs',
  '.rb': 'rb',
  '.java': 'java',
  '.swift': 'swift',
  '.php': 'php',
  '.cs': 'cs'
};

const LINE_COMMENT = {
  js: '//', ts: '//', go: '//', rs: '//', java: '//', swift: '//', cs: '//',
  php: '//', py: '#', rb: '#'
};

const FUNCTION_PATTERNS = {
  js: [/^\s*(?:export\s+)?(?:async\s+)?function\s+[A-Za-z_$]/, /^\s*(?:export\s+)?const\s+[A-Za-z_$][\w$]*\s*=\s*(?:async\s*)?\(/],
  ts: [/^\s*(?:export\s+)?(?:async\s+)?function\s+[A-Za-z_$]/, /^\s*(?:export\s+)?const\s+[A-Za-z_$][\w$]*\s*=\s*(?:async\s*)?\(/],
  py: [/^\s*(?:async\s+)?def\s+[A-Za-z_]/],
  go: [/^func\s+/],
  rs: [/^\s*(?:pub\s+)?(?:async\s+)?fn\s+/],
  rb: [/^\s*def\s+/],
  java: [/^\s*(?:public|private|protected)\s+[\w<>\[\], ]+\s+\w+\s*\(/],
  swift: [/^\s*(?:public|private|internal|fileprivate)?\s*func\s+/],
  cs: [/^\s*(?:public|private|protected|internal)\s+[\w<>\[\], ]+\s+\w+\s*\(/],
  php: [/^\s*(?:public|private|protected)?\s*function\s+/]
};

const MAX_FILE_BYTES = 1_000_000;
const MAX_FILES_PER_LANGUAGE = 800;

function classifyCasing(name) {
  if (/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/.test(name)) return 'SCREAMING_SNAKE';
  if (/^[A-Z][A-Z0-9]*$/.test(name)) return 'UPPER';
  if (/^[a-z][a-z0-9]*(_[a-z0-9]+)+$/.test(name)) return 'snake_case';
  if (/^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(name)) return 'kebab-case';
  if (/^[a-z][a-z0-9]*([A-Z][a-z0-9]*)+$/.test(name)) return 'camelCase';
  if (/^[A-Z][a-z0-9]*([A-Z][a-z0-9]*)*$/.test(name)) return 'PascalCase';
  if (/^[a-z][a-z0-9]*$/.test(name)) return 'lower';
  return 'other';
}

function percentile(sorted, fraction) {
  if (!sorted.length) return null;
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * fraction));
  return sorted[index];
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[middle];
  return Math.round(((sorted[middle - 1] + sorted[middle]) / 2) * 10) / 10;
}

function emptyLanguage() {
  return {
    files: 0,
    codeLines: 0,
    commentLines: 0,
    blankLines: 0,
    tabIndented: 0,
    spaceIndented: 0,
    quotes: { single: 0, double: 0, backtick: 0 },
    casing: {},
    identifierLengths: {},
    functionLengths: [],
    documentedFunctions: 0,
    markers: 0
  };
}

function bump(bucket, key) {
  bucket[key] = (bucket[key] || 0) + 1;
}

function recordIdentifier(stats, kind, name) {
  if (!stats.casing[kind]) stats.casing[kind] = {};
  bump(stats.casing[kind], classifyCasing(name));
  if (!stats.identifierLengths[kind]) stats.identifierLengths[kind] = [];
  stats.identifierLengths[kind].push(name.length);
}

// One pass per file. Everything here is a heuristic over raw lines rather than a
// parse: a wrong number on a pathological file is acceptable, a dependency on a
// per-language parser is not.
function scanFile(content, language, stats) {
  const lines = content.split(/\r?\n/);
  const comment = LINE_COMMENT[language];
  const functionPatterns = FUNCTION_PATTERNS[language] || [];
  let openFunctionLine = null;
  let previousLineWasDoc = false;

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      stats.blankLines += 1;
      return;
    }

    const isComment = trimmed.startsWith(comment)
      || trimmed.startsWith('/*') || trimmed.startsWith('*')
      || trimmed.startsWith('"""') || trimmed.startsWith("'''");
    if (isComment) {
      stats.commentLines += 1;
      if (/TODO|FIXME|HACK|XXX/.test(trimmed)) stats.markers += 1;
      previousLineWasDoc = trimmed.startsWith('/**') || trimmed.startsWith('*')
        || trimmed.startsWith('"""') || trimmed.startsWith("'''");
      return;
    }

    stats.codeLines += 1;
    if (/^\t/.test(line)) stats.tabIndented += 1;
    else if (/^ {2,}/.test(line)) stats.spaceIndented += 1;

    stats.quotes.single += (line.match(/'/g) || []).length;
    stats.quotes.double += (line.match(/"/g) || []).length;
    stats.quotes.backtick += (line.match(/`/g) || []).length;

    const isFunction = functionPatterns.some((pattern) => pattern.test(line));
    if (isFunction) {
      if (openFunctionLine !== null) {
        stats.functionLengths.push(index - openFunctionLine);
      }
      openFunctionLine = index;
      if (previousLineWasDoc) stats.documentedFunctions += 1;
      const name = line.match(/(?:function|def|fn|func)\s+([A-Za-z_$][\w$]*)/)
        || line.match(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)/);
      if (name) recordIdentifier(stats, 'function', name[1]);
    }

    for (const match of line.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) {
      const name = match[1];
      const kind = /^[A-Z][A-Z0-9_]*$/.test(name) ? 'constant' : 'variable';
      recordIdentifier(stats, kind, name);
    }
    for (const match of line.matchAll(/\b(?:class|interface|type|struct|enum)\s+([A-Za-z_$][\w$]*)/g)) {
      recordIdentifier(stats, 'type', match[1]);
    }

    previousLineWasDoc = false;
  });

  if (openFunctionLine !== null) {
    stats.functionLengths.push(lines.length - openFunctionLine);
  }
}

function walk(dir, onFile, skipped) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    skipped.push({ path: dir, reason: error.code || 'unreadable' });
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.') {
      if (IGNORED_DIRS.has(entry.name)) continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      walk(full, onFile, skipped);
    } else if (entry.isFile()) {
      onFile(full);
    }
  }
}

function summarize(stats) {
  const nonBlank = stats.codeLines + stats.commentLines;
  const sortedFunctions = [...stats.functionLengths].sort((a, b) => a - b);
  const casing = {};
  for (const [kind, buckets] of Object.entries(stats.casing)) {
    const total = Object.values(buckets).reduce((sum, n) => sum + n, 0);
    casing[kind] = {
      samples: total,
      dominant: Object.entries(buckets).sort((a, b) => b[1] - a[1])[0][0],
      distribution: Object.fromEntries(
        Object.entries(buckets)
          .sort((a, b) => b[1] - a[1])
          .map(([name, count]) => [name, Math.round((count / total) * 100)])
      )
    };
  }
  const identifierLengths = {};
  for (const [kind, lengths] of Object.entries(stats.identifierLengths)) {
    identifierLengths[kind] = { median: median(lengths), samples: lengths.length };
  }
  const quoteTotal = stats.quotes.single + stats.quotes.double + stats.quotes.backtick;
  return {
    files: stats.files,
    codeLines: stats.codeLines,
    commentDensityPct: nonBlank ? Math.round((stats.commentLines / nonBlank) * 1000) / 10 : 0,
    indentation: stats.tabIndented > stats.spaceIndented ? 'tabs' : 'spaces',
    indentSamples: { tabs: stats.tabIndented, spaces: stats.spaceIndented },
    quotes: quoteTotal
      ? Object.fromEntries(Object.entries(stats.quotes)
        .map(([name, count]) => [name, Math.round((count / quoteTotal) * 100)]))
      : { single: 0, double: 0, backtick: 0 },
    functionLength: {
      median: median(stats.functionLengths),
      p90: percentile(sortedFunctions, 0.9),
      samples: stats.functionLengths.length
    },
    docCoveragePct: stats.functionLengths.length
      ? Math.round((stats.documentedFunctions / stats.functionLengths.length) * 100)
      : 0,
    markers: stats.markers,
    casing,
    identifierLengths
  };
}

/**
 * Scan a project tree and return per-language style statistics.
 *
 * opts.maxFilesPerLanguage caps work on large trees; the cap is reported rather
 * than applied silently, because a truncated sample that looks complete is the
 * measurement version of a doc that lies.
 */
function scan(projectRoot, opts = {}) {
  const root = path.resolve(projectRoot || '.');
  const cap = opts.maxFilesPerLanguage || MAX_FILES_PER_LANGUAGE;
  const languages = {};
  const skipped = [];
  const truncated = new Set();
  let files = 0;

  walk(root, (full) => {
    const language = LANGUAGES[path.extname(full)];
    if (!language) return;
    if (!languages[language]) languages[language] = emptyLanguage();
    const stats = languages[language];
    if (stats.files >= cap) {
      truncated.add(language);
      return;
    }
    let content;
    try {
      const info = fs.statSync(full);
      if (info.size > MAX_FILE_BYTES) {
        skipped.push({ path: path.relative(root, full), reason: 'too-large' });
        return;
      }
      content = fs.readFileSync(full, 'utf8');
    } catch (error) {
      skipped.push({ path: path.relative(root, full), reason: error.code || 'unreadable' });
      return;
    }
    stats.files += 1;
    files += 1;
    scanFile(content, language, stats);
  }, skipped);

  const summary = {};
  for (const [language, stats] of Object.entries(languages)) {
    summary[language] = summarize(stats);
    if (truncated.has(language)) summary[language].truncatedAt = cap;
  }
  return { languages: summary, files, skipped };
}

module.exports = { scan, classifyCasing, LANGUAGES };
