// The golden file helper (tests/helpers/golden.mjs).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { diffLines, expectGolden, stableJson } from './helpers/golden.mjs';

function tempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcr-golden-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/** Runs fn with UPDATE_GOLDEN set to value (or unset when undefined), then restores it. */
function withUpdateEnv(value, fn) {
  const saved = process.env.UPDATE_GOLDEN;
  if (value === undefined) delete process.env.UPDATE_GOLDEN;
  else process.env.UPDATE_GOLDEN = value;
  try {
    return fn();
  } finally {
    if (saved === undefined) delete process.env.UPDATE_GOLDEN;
    else process.env.UPDATE_GOLDEN = saved;
  }
}

const model = { path: 'a.toy', tests: [{ title: 'adds an item', assertions: 1 }, { title: 'pays', assertions: 2 }] };

test('stableJson is 2-space JSON with LF and one trailing newline', () => {
  assert.equal(stableJson({ a: [1] }), '{\n  "a": [\n    1\n  ]\n}\n');
});

test('an equal value matches the golden file and does not rewrite it', (t) => {
  const file = path.join(tempDir(t), 'a.model.json');
  fs.writeFileSync(file, stableJson(model));
  const before = fs.statSync(file).mtimeMs;
  assert.equal(withUpdateEnv(undefined, () => expectGolden(model, file)), 'match');
  assert.equal(withUpdateEnv('1', () => expectGolden(model, file)), 'match');
  assert.equal(fs.statSync(file).mtimeMs, before);
});

test('a golden file checked out with CRLF still matches', (t) => {
  const file = path.join(tempDir(t), 'a.model.json');
  fs.writeFileSync(file, stableJson(model).replace(/\n/g, '\r\n'));
  assert.equal(withUpdateEnv(undefined, () => expectGolden(model, file)), 'match');
});

test('a different value fails with a readable diff and leaves the golden file alone', (t) => {
  const file = path.join(tempDir(t), 'a.model.json');
  fs.writeFileSync(file, stableJson(model));
  const changed = structuredClone(model);
  changed.tests[1].assertions = 3;

  let message = '';
  try {
    withUpdateEnv(undefined, () => expectGolden(changed, file));
  } catch (error) {
    message = error.message;
  }
  assert.match(message, /^Golden mismatch: .*a\.model\.json\n--- golden file\n\+\+\+ actual\n@@ golden line \d+ @@/);
  assert.match(message, /^- {7}"assertions": 2$/m);
  assert.match(message, /^\+ {7}"assertions": 3$/m);
  assert.match(message, /^ {8}"title": "pays",$/m);
  assert.match(message, /UPDATE_GOLDEN=1 npm test and explain the diff in the pull request\.$/);
  assert.doesNotMatch(message, /adds an item/);
  assert.equal(fs.readFileSync(file, 'utf8'), stableJson(model));
});

test('UPDATE_GOLDEN=1 rewrites a golden file that differs', (t) => {
  const file = path.join(tempDir(t), 'a.model.json');
  fs.writeFileSync(file, stableJson(model));
  const changed = { ...model, path: 'b.toy' };
  assert.equal(withUpdateEnv('1', () => expectGolden(changed, file)), 'updated');
  assert.equal(fs.readFileSync(file, 'utf8'), stableJson(changed));
  assert.equal(withUpdateEnv(undefined, () => expectGolden(changed, file)), 'match');
});

test('a missing golden file fails with the command to create it, and UPDATE_GOLDEN=1 creates it', (t) => {
  const file = path.join(tempDir(t), 'nested', 'new.model.json');
  assert.throws(() => withUpdateEnv(undefined, () => expectGolden(model, file)), /Golden file is missing: .*new\.model\.json\nRun UPDATE_GOLDEN=1 npm test to create it/);
  assert.equal(fs.existsSync(file), false);
  assert.equal(withUpdateEnv('1', () => expectGolden(model, file)), 'created');
  assert.equal(fs.readFileSync(file, 'utf8'), stableJson(model));
});

test('UPDATE_GOLDEN values other than 1 do not update, and the update option overrides the variable', (t) => {
  const file = path.join(tempDir(t), 'a.model.json');
  fs.writeFileSync(file, stableJson(model));
  const changed = { ...model, path: 'c.toy' };
  assert.throws(() => withUpdateEnv('true', () => expectGolden(changed, file)), /Golden mismatch/);
  assert.throws(() => withUpdateEnv('1', () => expectGolden(changed, file, { update: false })), /Golden mismatch/);
  assert.equal(withUpdateEnv(undefined, () => expectGolden(changed, file, { update: true })), 'updated');
});

test('diffLines shows removed and added lines with context, and nothing for equal text', () => {
  assert.equal(diffLines('a\nb\n', 'a\nb\n'), '');
  const diff = diffLines('one\ntwo\nthree\nfour\nfive\nsix\n', 'one\ntwo\nthree\nFOUR\nfive\nsix\nseven\n');
  assert.equal(diff, ['--- golden file', '+++ actual', '@@ golden line 2 @@', '  two', '  three', '- four', '+ FOUR', '  five', '  six', '+ seven', '  '].join('\n'));
});

test('diffLines separates distant changes and cuts very long diffs', () => {
  const base = Array.from({ length: 40 }, (_, index) => `line ${index + 1}`);
  const changed = [...base];
  changed[2] = 'changed 3';
  changed[35] = 'changed 36';
  const diff = diffLines(base.join('\n'), changed.join('\n'), { context: 1 });
  assert.match(diff, /- line 3\n\+ changed 3\n {2}line 4\n {2}\.\.\.\n {2}line 35\n- line 36\n\+ changed 36/);

  const long = diffLines(base.join('\n'), base.map((line) => `${line}!`).join('\n'), { maxLines: 10 });
  assert.match(long, /\.\.\. diff cut after 10 lines$/);
});

test('diffLines falls back to a plain remove-then-add listing for very large changes', () => {
  const a = Array.from({ length: 2100 }, (_, index) => `a${index}`).join('\n');
  const b = Array.from({ length: 2100 }, (_, index) => `b${index}`).join('\n');
  const diff = diffLines(a, b, { maxLines: 5000 });
  assert.match(diff, /^- a0$/m);
  assert.match(diff, /^\+ b2099$/m);
});
