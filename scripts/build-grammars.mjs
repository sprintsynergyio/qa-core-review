// Vendors the tree-sitter grammar .wasm files into grammars/. Run by hand only, never from an
// npm lifecycle script. It is the only script in this repo that needs the network.
//
//   node scripts/build-grammars.mjs
//
// Each grammar comes from the prebuilt .wasm inside the official grammar package on npm, at the
// exact version pinned in grammars/manifest.json. The script checks the package tarball against
// the pinned integrity hash, copies the .wasm, loads it with the installed web-tree-sitter to
// read its ABI version, then rewrites the manifest (abi, bytes, sha256) and grammars/LICENSES.md.
//
// To update a grammar: change its "version" in the manifest, set "integrity" to null, run this
// script, run `npm test`, and commit the changed files. To add one: add a manifest entry with
// id, file, package, version, sourceFile and "integrity": null, then do the same.

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Language, LANGUAGE_VERSION, MIN_COMPATIBLE_VERSION, Parser } from 'web-tree-sitter';
import { npm, parsePackJson } from './lib/npm.mjs';
import { readTarball } from './lib/tar.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const grammarsDir = path.join(root, 'grammars');
const manifestPath = path.join(grammarsDir, 'manifest.json');
const ALLOWED_LICENSES = ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause'];

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const runtimePkg = JSON.parse(fs.readFileSync(path.join(root, 'node_modules', 'web-tree-sitter', 'package.json'), 'utf8'));
await Parser.init();
manifest.runtime = { package: 'web-tree-sitter', version: runtimePkg.version, abi: LANGUAGE_VERSION, minAbi: MIN_COMPATIBLE_VERSION };

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'qcr-grammars-'));
const packages = new Map();

/** The repository field of a package.json as a plain https URL. */
function repoUrl(repository) {
  const raw = typeof repository === 'string' ? repository : String(repository?.url ?? '');
  return raw.replace(/^git\+/, '').replace(/\.git$/, '').replace(/^github:/, 'https://github.com/');
}

/** Downloads one package tarball (once) and returns its files, license and integrity hash. */
function fetchPackage(name, version) {
  const key = `${name}@${version}`;
  if (!packages.has(key)) {
    const info = parsePackJson(npm(['pack', key, '--pack-destination', work, '--json'], work))[0];
    const tarball = path.join(work, info.filename);
    const integrity = `sha512-${createHash('sha512').update(fs.readFileSync(tarball)).digest('base64')}`;
    const files = readTarball(tarball);
    const pkg = JSON.parse(files.get('package/package.json').toString('utf8'));
    const licenseFile = ['LICENSE', 'LICENSE.md', 'LICENSE.txt'].map((file) => files.get(`package/${file}`)).find(Boolean);
    if (!licenseFile) throw new Error(`${key} has no LICENSE file`);
    packages.set(key, { files, integrity, license: pkg.license, licenseText: licenseFile.toString('utf8'), repo: repoUrl(pkg.repository) });
  }
  return packages.get(key);
}

try {
  for (const grammar of manifest.grammars) {
    const key = `${grammar.package}@${grammar.version}`;
    const source = fetchPackage(grammar.package, grammar.version);
    if (grammar.integrity && grammar.integrity !== source.integrity) {
      throw new Error(`${key}: the tarball integrity is ${source.integrity}, but the manifest pins ${grammar.integrity}`);
    }
    if (!ALLOWED_LICENSES.includes(source.license)) {
      throw new Error(`${key} is licensed ${source.license}. Only ${ALLOWED_LICENSES.join(', ')} may be vendored. Stop and ask.`);
    }
    const wasm = source.files.get(`package/${grammar.sourceFile}`);
    if (!wasm) throw new Error(`${key} does not contain ${grammar.sourceFile}`);

    const abi = (await Language.load(new Uint8Array(wasm))).abiVersion;
    if (abi < MIN_COMPATIBLE_VERSION || abi > LANGUAGE_VERSION) {
      throw new Error(`${key} has ABI ${abi}. web-tree-sitter ${runtimePkg.version} accepts ${MIN_COMPATIBLE_VERSION} to ${LANGUAGE_VERSION}.`);
    }

    fs.writeFileSync(path.join(grammarsDir, grammar.file), wasm);
    Object.assign(grammar, {
      repo: source.repo,
      license: source.license,
      integrity: source.integrity,
      abi,
      bytes: wasm.length,
      sha256: createHash('sha256').update(wasm).digest('hex'),
    });
    console.log(`${grammar.file}  ${key}  ABI ${abi}  ${wasm.length} bytes  ${grammar.sha256.slice(0, 12)}`);
  }

  const licenses = [
    '# Licenses of the vendored grammars',
    '',
    'The `.wasm` files in this folder are prebuilt tree-sitter grammars, copied unchanged from the',
    'official grammar packages on npm. `manifest.json` lists the exact version and sha256 of each.',
    'This file is written by `scripts/build-grammars.mjs`. Do not edit it by hand.',
    '',
    '| File | Package | Version | License | Source |',
    '| --- | --- | --- | --- | --- |',
    ...manifest.grammars.map((g) => `| \`${g.file}\` | \`${g.package}\` | ${g.version} | ${g.license} | ${g.repo} |`),
  ];
  for (const [key, source] of packages) {
    const text = source.licenseText.replace(/\r\n/g, '\n').split('\n').map((line) => line.replace(/\s+$/, '').replace(/\t/g, '    ')).join('\n').trim();
    licenses.push('', `## ${key}`, '', '```text', text, '```');
  }
  fs.writeFileSync(path.join(grammarsDir, 'LICENSES.md'), `${licenses.join('\n')}\n`);
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`wrote ${manifest.grammars.length} grammars, manifest.json and LICENSES.md`);
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}
