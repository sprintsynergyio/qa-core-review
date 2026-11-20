// Cold start timing: a fresh process parses a 1,000-line file in each Tier 1 language.
// The time is measured from process start, so it includes Node startup, loading the parser
// runtime, loading the grammar and the parse. The limit is 500 ms (SPEC.md Milestone 2).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { BIG_FILES } from './helpers/big-files.mjs';
import { repoRoot } from './helpers/schema.mjs';

const LIMIT_MS = 500;
const RUNS = 3;
const helper = path.join(repoRoot, 'tests', 'helpers', 'parse-once.mjs');

function parseOnce(grammar, file, env = process.env) {
  const ran = spawnSync(process.execPath, [helper, grammar, file], { encoding: 'utf8', windowsHide: true, shell: false, env });
  assert.equal(ran.status, 0, ran.stderr);
  return JSON.parse(ran.stdout);
}

for (const [grammar, big] of Object.entries(BIG_FILES)) {
  test(`a 1,000-line ${grammar} file parses in under ${LIMIT_MS} ms from a cold start`, (t) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcr-timing-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const file = path.join(dir, big.name);
    fs.writeFileSync(file, big.text);

    // Every run is a new process, so every run is a cold start. The best of three removes
    // noise from a busy CI machine without hiding a real slowdown.
    const runs = Array.from({ length: RUNS }, () => parseOnce(grammar, file));
    const best = Math.min(...runs.map((run) => run.ms));
    t.diagnostic(`${grammar}: ${runs.map((run) => `${Math.round(run.ms)} ms`).join(', ')} (${runs[0].lines} lines)`);

    assert.ok(runs[0].lines >= 1000, `${runs[0].lines} lines`);
    assert.deepEqual({ fallback: runs[0].fallback, hasError: runs[0].hasError }, { fallback: null, hasError: false });
    assert.ok(runs[0].topLevelNodes > 0);
    assert.ok(best < LIMIT_MS, `best of ${RUNS} cold runs was ${Math.round(best)} ms`);
  });
}

test('parsing needs no other tool: it works with an empty PATH', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcr-nopath-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const env = { PATH: '' };
  // Windows needs SystemRoot to start any process. It names the OS folder, not a toolchain.
  if (process.env.SystemRoot) env.SystemRoot = process.env.SystemRoot;
  for (const [grammar, big] of Object.entries(BIG_FILES)) {
    const file = path.join(dir, big.name);
    fs.writeFileSync(file, big.text);
    assert.equal(parseOnce(grammar, file, env).hasError, false, grammar);
  }
});
