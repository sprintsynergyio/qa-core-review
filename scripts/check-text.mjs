// Text hygiene check, run by `npm run lint`.
//
// Fails on: tab characters, trailing spaces, CRLF line endings, em dashes, and any word listed
// in scripts/forbidden-words.txt (one word or phrase per line, matched as a whole word, any case).
//
// Usage: node scripts/check-text.mjs [root]
// Default root is the repo. Sample input files under fixtures/ and evals/corpus/ may need tabs,
// trailing spaces or CRLF on purpose, so only the em dash and forbidden word checks apply there.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const root = path.resolve(process.argv[2] ?? repoRoot);

const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'coverage', '.qa-core', 'build-bin']);
const RAW_INPUT_DIRS = ['fixtures/', 'evals/corpus/'];
const WORD_LIST = 'scripts/forbidden-words.txt';
const EM_DASH = String.fromCharCode(0x2014);
const MAX_BYTES = 2 * 1024 * 1024;

/** Root-relative paths with '/' separators, sorted, so output is the same on every OS. */
function listFiles(dir, prefix = '') {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix + entry.name;
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) found.push(...listFiles(path.join(dir, entry.name), `${rel}/`));
    } else if (entry.isFile()) {
      found.push(rel);
    }
  }
  return found.sort();
}

function readForbiddenWords() {
  const file = path.join(root, WORD_LIST);
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

function wordPattern(word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'iu');
}

const forbidden = readForbiddenWords().map((word) => ({ word, pattern: wordPattern(word) }));
const problems = [];
let checked = 0;

for (const rel of listFiles(root)) {
  const bytes = fs.readFileSync(path.join(root, rel));
  // Binary files (grammars, images, archives) and very large files are not text to check.
  if (bytes.length > MAX_BYTES || bytes.includes(0)) continue;
  checked += 1;

  const text = bytes.toString('utf8');
  const rawInput = RAW_INPUT_DIRS.some((dir) => rel.startsWith(dir));
  if (!rawInput && text.includes('\r\n')) problems.push(`${rel}: CRLF line endings (use LF)`);

  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const where = `${rel}:${index + 1}`;
    if (!rawInput && line.includes('\t')) problems.push(`${where}: tab character (use spaces)`);
    if (!rawInput && /[ \t]+$/.test(line)) problems.push(`${where}: trailing whitespace`);
    if (line.includes(EM_DASH)) problems.push(`${where}: em dash (use a comma, a colon or a period)`);
    if (rel !== WORD_LIST) {
      for (const { word, pattern } of forbidden) {
        if (pattern.test(line)) problems.push(`${where}: forbidden word "${word}"`);
      }
    }
  }
}

if (problems.length > 0) {
  for (const problem of problems) console.error(problem);
  console.error(`check-text failed: ${problems.length} problem(s) in ${checked} files`);
  process.exit(1);
}
console.log(`check-text ok (${checked} files)`);
