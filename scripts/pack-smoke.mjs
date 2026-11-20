// Packs the package, installs the tarball in a temp folder and runs the installed CLI.
// Nothing is published: the pack is local. Exits 0 only when every check passes.
//
// npm is started without a shell (see scripts/lib/npm.mjs).

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { npm, parsePackJson } from './lib/npm.mjs';
import { readTarball } from './lib/tar.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const REQUIRED = ['package/dist/cli.js', 'package/dist/index.js', 'package/dist/index.d.ts', 'package/schemas/model.schema.json', 'package/schemas/config.schema.json', 'package/schemas/detect.schema.json', 'package/grammars/manifest.json', 'package/grammars/LICENSES.md',
  'package/grammars/javascript.wasm', 'package/grammars/typescript.wasm', 'package/grammars/tsx.wasm', 'package/grammars/python.wasm', 'package/grammars/java.wasm',
  'package/README.md', 'package/CHANGELOG.md', 'package/LICENSE'];
const FORBIDDEN_PREFIXES = ['package/src/', 'package/tests/', 'package/scripts/', 'package/evals/', 'package/fixtures/', 'package/.github/', 'package/node_modules/'];
const FORBIDDEN_NAMES = ['package/SPEC.md', 'package/SPEC.v1.md', 'package/CLAUDE.md'];

function cli(bin, args) {
  return spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8', windowsHide: true, shell: false });
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

const packDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcr-pack-'));
const installDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcr-install-'));
try {
  const info = parsePackJson(npm(['pack', '--pack-destination', packDir, '--json'], root))[0];
  const tarball = path.join(packDir, info.filename);
  const names = [...readTarball(tarball).keys()];

  for (const required of REQUIRED) expect(names.includes(required), `tarball is missing ${required}`);
  const unwanted = names.filter((name) => FORBIDDEN_PREFIXES.some((prefix) => name.startsWith(prefix)) || FORBIDDEN_NAMES.includes(name) || /(^|\/)\.env/.test(name));
  expect(unwanted.length === 0, `tarball has files it should not ship: ${unwanted.join(', ')}`);

  fs.writeFileSync(path.join(installDir, 'package.json'), JSON.stringify({ name: 'qcr-pack-smoke', version: '0.0.0', private: true }));
  npm(['install', '--no-audit', '--no-fund', tarball], installDir);

  const installed = path.join(installDir, 'node_modules', pkg.name);
  const installedPkg = JSON.parse(fs.readFileSync(path.join(installed, 'package.json'), 'utf8'));
  const bin = path.join(installed, installedPkg.bin[pkg.name]);
  expect(fs.readFileSync(bin, 'utf8').startsWith('#!/usr/bin/env node'), 'dist/cli.js has no node shebang');

  const version = cli(bin, ['--version']);
  expect(version.status === 0 && version.stdout.trim() === pkg.version, `--version printed "${version.stdout.trim()}" (exit ${version.status}), expected ${pkg.version}`);

  const help = cli(bin, ['--help']);
  expect(help.status === 0 && help.stdout.includes('Usage:'), `--help did not print usage (exit ${help.status})`);

  const bad = cli(bin, ['--no-such-flag']);
  expect(bad.status === 2, `an unknown flag exited ${bad.status}, expected 2`);
  expect(bad.stdout === '', 'an unknown flag wrote to stdout');
  expect(bad.stderr.includes('Run qa-core-review --help'), `an unknown flag did not point to --help:\n${bad.stderr}`);

  // `detect` on a small project made on the spot: the installed CLI must find it.
  fs.mkdirSync(path.join(installDir, 'tests'));
  fs.writeFileSync(path.join(installDir, 'tests', 'cart.test.js'), "test('adds', () => { expect(1 + 1).toBe(2); });\n");
  fs.writeFileSync(path.join(installDir, 'jest.config.js'), 'module.exports = {};\n');
  const detected = cli(bin, ['detect', '--root', installDir, '--format', 'json']);
  expect(detected.status === 0, `detect exited ${detected.status}:\n${detected.stderr}`);
  const found = JSON.parse(detected.stdout);
  expect(found.projects[0]?.adapter === 'js' && found.projects[0].frameworks.includes('jest') && found.testFiles === 1, `detect found the wrong things:\n${detected.stdout}`);

  const api = await import(pathToFileURL(path.join(installed, installedPkg.main)).href);
  expect(api.VERSION === pkg.version, `the package entry exports VERSION ${api.VERSION}, expected ${pkg.version}`);
  expect(typeof api.selectRules === 'function' && typeof api.createRegistry === 'function' && api.CAPABILITIES.length > 0, 'the package entry does not export the model and adapter API');

  // The installed package must find its config schema and its YAML dependency on its own.
  expect(api.resolveConfig(api.parseYaml('failOn: warn\n')).config.failOn === 'warn', 'the installed package cannot load a YAML config');

  // The installed package must find its grammars and its parser dependency on its own.
  const parser = api.createTreeSitterService();
  for (const [grammar, sample] of [['typescript', 'const total: number = 42;'], ['python', 'assert total == 42\n'], ['java', 'class CartTest {}']]) {
    const tree = await parser.parse(grammar, sample);
    expect(tree !== null && !tree.rootNode.hasError, `the installed package cannot parse ${grammar}: ${parser.loadError(grammar)}`);
  }

  console.log(`pack smoke ok ${pkg.version} (${names.length} files, ${info.size} bytes packed, ${info.unpackedSize} bytes unpacked)`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  fs.rmSync(packDir, { recursive: true, force: true });
  fs.rmSync(installDir, { recursive: true, force: true });
}
