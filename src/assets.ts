// Every file the tool ships next to its code is read through this module: grammars, the review
// page, schemas, templates and the skill. Milestone 24 adds a second source here (assets embedded
// in the standalone binary), so nothing else in the code base may build a path to these files.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The package folder. This file is dist/assets.js, so the package is one level up. */
const packageRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/** The folders that hold assets. A name outside them is a bug, not a missing file. */
export const ASSET_DIRS = ['grammars', 'ui', 'schemas', 'templates', 'skill'] as const;

/**
 * The absolute path of an asset. `name` is package-relative with '/' separators on every OS,
 * for example 'grammars/python.wasm'.
 */
export function assetPath(name: string): string {
  const parts = name.split('/');
  const safe = !name.includes('\\') && parts.every((part) => part !== '' && part !== '.' && part !== '..');
  if (!safe || parts.length < 2 || !(ASSET_DIRS as readonly string[]).includes(parts[0]!)) {
    throw new Error(`Not an asset name: "${name}". Use a path such as "grammars/python.wasm".`);
  }
  return path.join(packageRoot, ...parts);
}

export function readAsset(name: string): Uint8Array {
  const file = assetPath(name);
  try {
    return fs.readFileSync(file);
  } catch {
    throw new Error(`Asset not found: ${name}`);
  }
}

export function readAssetText(name: string): string {
  return Buffer.from(readAsset(name)).toString('utf8');
}

/** The WebAssembly runtime of the parser, from the web-tree-sitter dependency. */
export function readParserRuntime(): Uint8Array {
  const require = createRequire(import.meta.url);
  return fs.readFileSync(require.resolve('web-tree-sitter/web-tree-sitter.wasm'));
}
