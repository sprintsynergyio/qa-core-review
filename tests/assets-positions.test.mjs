// Asset loading (src/assets.ts) and text positions (src/parse/positions.ts).
import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { ASSET_DIRS, LineIndex, assetPath, readAsset, readAssetText, readParserRuntime, spanOfNode, toLf } from '../dist/index.js';
import { repoRoot } from './helpers/schema.mjs';

const BOM = String.fromCharCode(0xfeff);
const WASM_MAGIC = [0, 97, 115, 109];

test('assetPath resolves inside the package folder', () => {
  assert.equal(assetPath('grammars/python.wasm'), path.join(repoRoot, 'grammars', 'python.wasm'));
  assert.equal(assetPath('templates/ci/github-actions.yml'), path.join(repoRoot, 'templates', 'ci', 'github-actions.yml'));
  assert.deepEqual([...ASSET_DIRS], ['grammars', 'ui', 'schemas', 'templates', 'skill']);
});

test('names that leave the asset folders are refused', () => {
  for (const name of ['../package.json', 'grammars/../../secret', 'grammars\\python.wasm', '/etc/passwd', 'src/cli.ts', 'grammars', 'grammars//x', 'grammars/./x', '']) {
    assert.throws(() => assetPath(name), /Not an asset name/, name);
  }
});

test('readAsset returns the bytes, and a missing asset fails with its name', () => {
  assert.deepEqual([...readAsset('grammars/java.wasm').subarray(0, 4)], WASM_MAGIC);
  assert.equal(JSON.parse(readAssetText('grammars/manifest.json')).schemaVersion, 1);
  assert.equal(JSON.parse(readAssetText('schemas/model.schema.json')).title, 'qa-core-review normalized test model (NFile)');
  assert.throws(() => readAsset('grammars/cobol.wasm'), /^Error: Asset not found: grammars\/cobol\.wasm$/);
});

test('readParserRuntime returns the WebAssembly runtime of web-tree-sitter', () => {
  assert.deepEqual([...readParserRuntime().subarray(0, 4)], WASM_MAGIC);
});

test('toLf removes a byte order mark and turns CRLF and lone CR into LF', () => {
  assert.equal(toLf(`${BOM}a\r\nb\rc\n`), 'a\nb\nc\n');
  assert.equal(toLf('a\nb'), 'a\nb');
  assert.equal(toLf(''), '');
  assert.equal(toLf(`a${BOM}`), `a${BOM}`);
});

test('LineIndex turns offsets into 1-based lines and columns', () => {
  const text = 'ab\n\ncde\n';
  const index = new LineIndex(text);
  assert.equal(index.lineCount, 4);
  assert.deepEqual(index.positionAt(0), { line: 1, column: 1 });
  assert.deepEqual(index.positionAt(2), { line: 1, column: 3 });
  assert.deepEqual(index.positionAt(3), { line: 2, column: 1 });
  assert.deepEqual(index.positionAt(4), { line: 3, column: 1 });
  assert.deepEqual(index.positionAt(6), { line: 3, column: 3 });
  assert.deepEqual(index.positionAt(text.length), { line: 4, column: 1 });
  assert.deepEqual(index.positionAt(-5), { line: 1, column: 1 });
  assert.deepEqual(index.positionAt(999), { line: 4, column: 1 });
  assert.equal(new LineIndex('').lineCount, 1);
});

test('LineIndex.spanOf and spanOfNode give spans with an exclusive end', () => {
  const index = new LineIndex('one\ntwo three\n');
  assert.deepEqual(index.spanOf(4, 7), { startLine: 2, startColumn: 1, endLine: 2, endColumn: 4 });
  assert.deepEqual(index.spanOf(0, 13), { startLine: 1, startColumn: 1, endLine: 2, endColumn: 10 });
  assert.deepEqual(spanOfNode({ startPosition: { row: 1, column: 0 }, endPosition: { row: 1, column: 3 } }), { startLine: 2, startColumn: 1, endLine: 2, endColumn: 4 });
});
