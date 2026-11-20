// The vendored grammars: files, hashes, ABI versions and licenses must match grammars/manifest.json.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { LANGUAGE_VERSION, Language, MIN_COMPATIBLE_VERSION } from 'web-tree-sitter';
import { createTreeSitterService } from '../dist/index.js';
import { readJson, repoRoot } from './helpers/schema.mjs';

const manifest = readJson('grammars', 'manifest.json');
const grammarsDir = path.join(repoRoot, 'grammars');
const TIER_1 = ['javascript', 'typescript', 'tsx', 'python', 'java'];
const ALLOWED_LICENSES = ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause'];

const SAMPLES = {
  javascript: "const { test } = require('node:test');\ntest('adds', () => { assert.equal(1 + 1, 2); });\nconst view = <Cart items={[]} />;\n",
  typescript: "test('adds', async ({ page }: { page: Page }) => {\n  await expect(page).toHaveURL(/cart/);\n});\n",
  tsx: "it('renders', () => {\n  const view = render(<Cart items={[] as Item[]} />);\n  expect(view).toBeDefined();\n});\n",
  python: 'def test_adds(cart):\n    cart.add("backpack")\n    assert cart.total() == 29.99\n',
  java: 'class CartTest {\n    @Test\n    void adds() {\n        assertEquals(1, cart.size());\n    }\n}\n',
};

test('the manifest lists the five Tier 1 grammars with unique ids', () => {
  assert.equal(manifest.schemaVersion, 1);
  assert.deepEqual(manifest.grammars.map((grammar) => grammar.id), TIER_1);
  for (const key of ['id', 'file', 'package', 'version', 'sourceFile', 'integrity', 'repo', 'license', 'abi', 'bytes', 'sha256']) {
    for (const grammar of manifest.grammars) assert.ok(grammar[key], `${grammar.id} has no ${key}`);
  }
});

test('the manifest pins the installed web-tree-sitter version, and package.json pins it exactly', () => {
  const installed = readJson('node_modules', 'web-tree-sitter', 'package.json').version;
  assert.equal(manifest.runtime.package, 'web-tree-sitter');
  assert.equal(manifest.runtime.version, installed);
  assert.equal(readJson('package.json').dependencies['web-tree-sitter'], installed);
});

test('every grammar file matches the size and sha256 in the manifest', () => {
  for (const grammar of manifest.grammars) {
    const bytes = fs.readFileSync(path.join(grammarsDir, grammar.file));
    assert.equal(bytes.length, grammar.bytes, `${grammar.file} size`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), grammar.sha256, `${grammar.file} sha256`);
  }
});

test('the grammars folder holds exactly the files the manifest lists', () => {
  const expected = [...manifest.grammars.map((grammar) => grammar.file), 'LICENSES.md', 'manifest.json'].sort();
  assert.deepEqual(fs.readdirSync(grammarsDir).sort(), expected);
});

test('every grammar loads and parses a sample without errors', async () => {
  const service = createTreeSitterService();
  for (const grammar of manifest.grammars) {
    const tree = await service.parse(grammar.id, SAMPLES[grammar.id]);
    assert.ok(tree, `${grammar.id} did not load: ${service.loadError(grammar.id)}`);
    assert.equal(tree.rootNode.hasError, false, `${grammar.id} sample has a parse error: ${tree.rootNode.toString()}`);
    assert.ok(tree.rootNode.namedChildCount > 0);
    tree.delete();
  }
  assert.deepEqual(service.loadedGrammars(), TIER_1);
});

test('every grammar has the ABI version the manifest records, inside the range the runtime accepts', async () => {
  await createTreeSitterService().parse('python', '');
  assert.equal(manifest.runtime.abi, LANGUAGE_VERSION);
  assert.equal(manifest.runtime.minAbi, MIN_COMPATIBLE_VERSION);
  for (const grammar of manifest.grammars) {
    const language = await Language.load(fs.readFileSync(path.join(grammarsDir, grammar.file)));
    assert.equal(language.abiVersion, grammar.abi, `${grammar.id} ABI`);
    assert.ok(grammar.abi >= MIN_COMPATIBLE_VERSION && grammar.abi <= LANGUAGE_VERSION, `${grammar.id} ABI ${grammar.abi} is out of range`);
  }
});

test('every grammar has an allowed license, and LICENSES.md carries its text', () => {
  const licenses = fs.readFileSync(path.join(grammarsDir, 'LICENSES.md'), 'utf8');
  for (const grammar of manifest.grammars) {
    assert.ok(ALLOWED_LICENSES.includes(grammar.license), `${grammar.id} is licensed ${grammar.license}`);
    assert.match(grammar.repo, /^https:\/\/github\.com\/tree-sitter\//);
    assert.ok(licenses.includes(`| \`${grammar.file}\` | \`${grammar.package}\` | ${grammar.version} | ${grammar.license} |`), `${grammar.file} row`);
    assert.ok(licenses.includes(`## ${grammar.package}@${grammar.version}`), `${grammar.package} license text`);
  }
  assert.equal(licenses.match(/Permission is hereby granted/g).length, new Set(manifest.grammars.map((grammar) => grammar.package)).size);
});
