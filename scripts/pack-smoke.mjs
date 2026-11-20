// Packs the package, installs the tarball in a temp folder and runs the installed CLI.
// Nothing is published: the pack is local. Exits 0 only when every check passes.
//
// npm is started through its JavaScript entry with the current Node binary, never through a
// shell, so this works the same on Windows (where npm is npm.cmd) and on Linux and macOS.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const REQUIRED = ['package/dist/cli.js', 'package/dist/index.js', 'package/dist/index.d.ts', 'package/schemas/model.schema.json', 'package/README.md', 'package/CHANGELOG.md', 'package/LICENSE'];
const FORBIDDEN_PREFIXES = ['package/src/', 'package/tests/', 'package/scripts/', 'package/evals/', 'package/fixtures/', 'package/.github/', 'package/node_modules/'];
const FORBIDDEN_NAMES = ['package/SPEC.md', 'package/SPEC.v1.md', 'package/CLAUDE.md'];

function npmCliPath() {
  const fromNpm = process.env.npm_execpath;
  if (fromNpm && /npm-cli\.(c|m)?js$/.test(fromNpm) && fs.existsSync(fromNpm)) return fromNpm;
  const nodeDir = path.dirname(process.execPath);
  const candidates = [
    path.join(nodeDir, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    path.join(nodeDir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error('cannot find npm-cli.js. Run this script with `npm run pack:smoke`.');
  return found;
}

function npm(args, cwd) {
  const ran = spawnSync(process.execPath, [npmCliPath(), ...args], { cwd, encoding: 'utf8', windowsHide: true, shell: false });
  if (ran.error) throw new Error(`npm ${args.join(' ')} failed to start: ${ran.error.message}`);
  if (ran.status !== 0) throw new Error(`npm ${args.join(' ')} exited ${ran.status}\n${ran.stderr || ''}`);
  return ran.stdout;
}

function cli(bin, args) {
  return spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8', windowsHide: true, shell: false });
}

/** File names inside a .tgz, read from the tar headers. */
function listTarball(tarball) {
  const buf = zlib.gunzipSync(fs.readFileSync(tarball));
  const names = [];
  let offset = 0;
  while (offset + 512 <= buf.length) {
    const header = buf.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    let name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
    const prefix = header.subarray(345, 500).toString('utf8').replace(/\0.*$/, '');
    if (prefix) name = `${prefix}/${name}`;
    const size = parseInt(header.subarray(124, 136).toString('utf8').trim(), 8) || 0;
    if (name) names.push(name);
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return names;
}

/** `npm pack --json` prints a JSON array. Lifecycle script output may come before it. */
function parsePackJson(stdout) {
  const start = stdout.search(/^\[/m);
  if (start === -1) throw new Error(`npm pack printed no JSON:\n${stdout}`);
  return JSON.parse(stdout.slice(start));
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

const packDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcr-pack-'));
const installDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcr-install-'));
try {
  const info = parsePackJson(npm(['pack', '--pack-destination', packDir, '--json'], root))[0];
  const tarball = path.join(packDir, info.filename);
  const names = listTarball(tarball);

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

  const api = await import(pathToFileURL(path.join(installed, installedPkg.main)).href);
  expect(api.VERSION === pkg.version, `the package entry exports VERSION ${api.VERSION}, expected ${pkg.version}`);
  expect(typeof api.selectRules === 'function' && typeof api.createRegistry === 'function' && api.CAPABILITIES.length > 0, 'the package entry does not export the model and adapter API');

  console.log(`pack smoke ok ${pkg.version} (${names.length} files, ${info.size} bytes packed, ${info.unpackedSize} bytes unpacked)`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  fs.rmSync(packDir, { recursive: true, force: true });
  fs.rmSync(installDir, { recursive: true, force: true });
}
