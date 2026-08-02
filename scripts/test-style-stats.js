#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');

const { scan, classifyCasing } = require('../lib/style-stats');
const { test, assert, report } = require('./test-harness');

function fixture(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'godpowers-style-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return dir;
}

test('classifyCasing separates every identifier kind the genome names', () => {
  assert(classifyCasing('MAX_RETRIES') === 'SCREAMING_SNAKE', 'screaming snake');
  assert(classifyCasing('PORT') === 'UPPER', 'single-word all caps');
  assert(classifyCasing('read_file') === 'snake_case', 'snake');
  assert(classifyCasing('read-file') === 'kebab-case', 'kebab');
  assert(classifyCasing('readFile') === 'camelCase', 'camel');
  assert(classifyCasing('ReadFile') === 'PascalCase', 'pascal');
  assert(classifyCasing('read') === 'lower', 'single lowercase word');
});

test('scan reports comment density, function length, and casing per language', () => {
  const dir = fixture({
    'src/a.js': [
      '// one comment',
      'function readFile(name) {',
      '  const filePath = name;',
      '  return filePath;',
      '}',
      '',
      'function writeFile(name) {',
      '  return name;',
      '}'
    ].join('\n'),
    'src/b.py': [
      'def read_file(name):',
      '    return name'
    ].join('\n')
  });

  const out = scan(dir);
  assert(out.files === 2, `expected 2 scanned files, got ${out.files}`);
  assert(out.languages.js, 'js reported');
  assert(out.languages.py, 'py reported');
  assert(out.languages.js.commentDensityPct > 0, 'comment density counted');
  assert(out.languages.js.casing.function.dominant === 'camelCase', 'js functions camelCase');
  assert(out.languages.py.casing.function.dominant === 'snake_case', 'py functions snake_case');
  assert(out.languages.js.functionLength.samples === 2, 'both js functions measured');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('scan skips vendored and generated trees rather than fingerprinting them', () => {
  const dir = fixture({
    'src/a.js': 'function keep() { return 1; }\n',
    'node_modules/pkg/index.js': 'function vendored() { return 2; }\n',
    'dist/bundle.js': 'function built() { return 3; }\n',
    '.godpowers/state.js': 'function state() { return 4; }\n'
  });

  const out = scan(dir);
  assert(out.files === 1, `expected only src/a.js, got ${out.files}`);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('an unlisted extension is skipped, not guessed at', () => {
  const dir = fixture({ 'notes.txt': 'function looksLikeCode() {}\n' });
  const out = scan(dir);
  assert(out.files === 0, 'unknown extensions contribute nothing');
  assert(Object.keys(out.languages).length === 0, 'no language invented');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a truncated sample says so instead of reading as complete', () => {
  const files = {};
  for (let i = 0; i < 5; i += 1) files[`src/f${i}.js`] = `function f${i}() { return ${i}; }\n`;
  const dir = fixture(files);

  const out = scan(dir, { maxFilesPerLanguage: 2 });
  assert(out.languages.js.files === 2, 'cap applied');
  assert(out.languages.js.truncatedAt === 2, 'truncation reported, not silent');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('casing distributions carry their sample count', () => {
  const dir = fixture({ 'src/a.js': 'function only() { return 1; }\n' });
  const out = scan(dir);
  assert(out.languages.js.casing.function.samples === 1, 'sample count exposed');
  fs.rmSync(dir, { recursive: true, force: true });
});

report('style-stats tests');
