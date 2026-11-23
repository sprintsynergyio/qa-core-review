// Tests for the command line entry point. They run the built CLI (dist/cli.js) as a child process.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cliPath = path.join(root, 'dist', 'cli.js');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

function run(...args) {
  return spawnSync(process.execPath, [cliPath, ...args], { encoding: 'utf8', windowsHide: true, shell: false });
}

test('--version prints the package version', () => {
  const ran = run('--version');
  assert.equal(ran.status, 0);
  assert.equal(ran.stdout, `${pkg.version}\n`);
  assert.equal(ran.stderr, '');
});

test('-v is the same as --version', () => {
  const ran = run('-v');
  assert.equal(ran.status, 0);
  assert.equal(ran.stdout, `${pkg.version}\n`);
});

test('the version constant matches package.json and is exported from the package entry', async () => {
  const api = await import(pathToFileURL(path.join(root, 'dist', 'index.js')).href);
  assert.equal(api.VERSION, pkg.version);
});

test('--help prints usage', () => {
  const ran = run('--help');
  assert.equal(ran.status, 0);
  assert.match(ran.stdout, /^qa-core-review \d+\.\d+\.\d+\n/);
  assert.match(ran.stdout, /Usage:/);
  assert.match(ran.stdout, /--version \| -v/);
  assert.match(ran.stdout, /--help \| -h/);
  assert.equal(ran.stderr, '');
});

test('-h prints the same usage as --help', () => {
  const ran = run('-h');
  assert.equal(ran.status, 0);
  assert.equal(ran.stdout, run('--help').stdout);
});

test('--version wins when --help is also given', () => {
  const ran = run('--help', '--version');
  assert.equal(ran.status, 0);
  assert.equal(ran.stdout, `${pkg.version}\n`);
});

test('an unknown flag exits 2 with a one-line error and a pointer to --help', () => {
  const ran = run('--no-such-flag');
  assert.equal(ran.status, 2);
  assert.equal(ran.stdout, '');
  const lines = ran.stderr.trimEnd().split('\n');
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^qa-core-review: .*--no-such-flag/);
  assert.equal(lines[1], 'Run qa-core-review --help');
});

test('a command that is not built yet exits 2 and names the command', () => {
  const ran = run('explain', 'QCR-A001');
  assert.equal(ran.status, 2);
  assert.equal(ran.stdout, '');
  assert.match(ran.stderr, /^qa-core-review: the "explain" command is not available yet/);
  assert.match(ran.stderr, /Run qa-core-review --help\n$/);
});

test('the built CLI starts with a node shebang and has LF line endings', () => {
  const text = fs.readFileSync(cliPath, 'utf8');
  assert.ok(text.startsWith('#!/usr/bin/env node\n'));
  assert.ok(!text.includes('\r\n'));
});
