// Tests for scripts/check-text.mjs, the text hygiene check that `npm run lint` runs.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const script = path.join(root, 'scripts', 'check-text.mjs');
const EM_DASH = String.fromCharCode(0x2014);

/** Runs check-text on a temp folder that holds the given files (path -> content). */
function check(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcr-check-text-'));
  try {
    for (const [rel, content] of Object.entries(files)) {
      const file = path.join(dir, rel);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content);
    }
    return spawnSync(process.execPath, [script, dir], { encoding: 'utf8', windowsHide: true, shell: false });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('clean files pass', () => {
  const ran = check({ 'README.md': '# Title\n\nPlain text.\n', 'src/a.ts': 'export const a = 1;\n' });
  assert.equal(ran.status, 0, ran.stderr);
  assert.match(ran.stdout, /^check-text ok \(2 files\)\n$/);
});

test('a tab, trailing whitespace, CRLF and an em dash each fail with file and line', () => {
  const ran = check({
    'src/tab.ts': 'const a = 1;\n\tconst b = 2;\n',
    'src/trailing.ts': 'const a = 1; \n',
    'docs/crlf.md': 'one\r\ntwo\r\n',
    'docs/dash.md': `first line\nsecond ${EM_DASH} line\n`,
  });
  assert.equal(ran.status, 1);
  assert.match(ran.stderr, /^src\/tab\.ts:2: tab character/m);
  assert.match(ran.stderr, /^src\/trailing\.ts:1: trailing whitespace/m);
  assert.match(ran.stderr, /^docs\/crlf\.md: CRLF line endings/m);
  assert.match(ran.stderr, /^docs\/dash\.md:2: em dash/m);
  assert.match(ran.stderr, /check-text failed: 4 problem\(s\) in 4 files/);
});

test('forbidden words match whole words in any case, and the list file itself is exempt', () => {
  const ran = check({
    'scripts/forbidden-words.txt': 'Acme\nbig client\n\n',
    'README.md': 'Built for ACME.\nacmeish is fine.\nOur Big Client said so.\n',
  });
  assert.equal(ran.status, 1);
  assert.match(ran.stderr, /^README\.md:1: forbidden word "Acme"/m);
  assert.match(ran.stderr, /^README\.md:3: forbidden word "big client"/m);
  assert.doesNotMatch(ran.stderr, /README\.md:2/);
  assert.doesNotMatch(ran.stderr, /forbidden-words\.txt/);
});

test('an empty forbidden word list forbids nothing', () => {
  const ran = check({ 'scripts/forbidden-words.txt': '', 'README.md': 'Anything goes.\n' });
  assert.equal(ran.status, 0, ran.stderr);
});

test('sample input folders may use tabs and CRLF but not em dashes', () => {
  const allowed = check({ 'fixtures/go/a_test.go': 'func TestA(t *testing.T) {\n\tt.Log("x")\n}\n', 'evals/corpus/py/crlf_test.py': 'def test_a():\r\n    assert 1 == 1\r\n' });
  assert.equal(allowed.status, 0, allowed.stderr);
  const dash = check({ 'fixtures/js/a.test.js': `// a ${EM_DASH} b\n` });
  assert.equal(dash.status, 1);
  assert.match(dash.stderr, /^fixtures\/js\/a\.test\.js:1: em dash/m);
});

test('binary files and skipped folders are ignored', () => {
  const ran = check({
    'grammars/x.wasm': Buffer.from([0, 97, 115, 109, 9, 13, 10]),
    'node_modules/pkg/index.js': 'a\t\r\n',
    'dist/cli.js': 'a \n',
    'ok.md': 'fine\n',
  });
  assert.equal(ran.status, 0, ran.stderr);
  assert.match(ran.stdout, /check-text ok \(1 files\)/);
});

test('the repo itself passes', () => {
  const ran = spawnSync(process.execPath, [script], { encoding: 'utf8', windowsHide: true, shell: false });
  assert.equal(ran.status, 0, ran.stderr);
});
