// The parser service (src/parse/treesitter.ts): lazy loading, caching, broken files and fallback.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ERROR_RATIO_LIMIT, createTreeSitterService, errorRatio, readAsset, spanOfNode, toLf } from '../dist/index.js';

const BOM = String.fromCharCode(0xfeff);
const PY = 'def test_total(cart):\n    assert cart.total() == 42\n';

const BROKEN = {
  typescript: "test('a', () => {\n  expect(1).toBe(1);\n});\n\ntest('b', () => {\n  expect(2).toBe(;\n});\n",
  python: 'def test_a():\n    assert True\n\ndef test_b(:\n    assert 1 == 1\n',
  java: 'class T {\n  @Test void a() { assertTrue(true); }\n  @Test void b() { assertEquals(1, ; }\n}\n',
};
const GARBAGE = '<<<<<<< HEAD\n}}}} ))) ((( === @@@ ### \n>>>>>>> branch\n ]]] {{{ ;;; ??? \n';

test('grammars load on first use only, and once', async () => {
  const service = createTreeSitterService();
  assert.deepEqual(service.loadedGrammars(), []);

  const trees = await Promise.all([service.parse('python', PY), service.parse('python', PY)]);
  assert.deepEqual(service.loadedGrammars(), ['python']);
  await service.parse('java', 'class A {}');
  (await service.parse('python', PY)).delete();
  assert.deepEqual(service.loadedGrammars(), ['python', 'java']);
  trees.forEach((tree) => tree.delete());
});

test('a parsed tree gives 1-based spans with an exclusive end', async () => {
  const tree = await createTreeSitterService().parse('python', PY);
  const statement = tree.rootNode.descendantsOfType('assert_statement')[0];
  assert.equal(statement.text, 'assert cart.total() == 42');
  assert.deepEqual(spanOfNode(statement), { startLine: 2, startColumn: 5, endLine: 2, endColumn: 30 });
  assert.deepEqual(spanOfNode(tree.rootNode), { startLine: 1, startColumn: 1, endLine: 3, endColumn: 1 });
  tree.delete();
});

test('a file with a syntax error gives a tree with errors and does not throw', async () => {
  const service = createTreeSitterService();
  for (const [grammar, text] of Object.entries(BROKEN)) {
    const result = await service.parseForReview(grammar, text);
    assert.equal(result.fallback, null, grammar);
    assert.equal(result.tree.rootNode.hasError, true, grammar);
    assert.ok(result.errorRatio >= 0 && result.errorRatio <= ERROR_RATIO_LIMIT, `${grammar} ratio ${result.errorRatio}`);
    // The tests around the broken line are still in the tree.
    assert.ok(result.tree.rootNode.descendantCount > 20, grammar);
    result.tree.delete();
  }
});

test('a file with ERROR nodes over more than 30% of its text switches to the lexical fallback', async () => {
  const service = createTreeSitterService();
  for (const grammar of ['typescript', 'python', 'java']) {
    const tree = await service.parse(grammar, GARBAGE);
    const ratio = errorRatio(tree, GARBAGE.length);
    tree.delete();
    assert.ok(ratio > ERROR_RATIO_LIMIT, `${grammar} ratio ${ratio}`);

    const result = await service.parseForReview(grammar, GARBAGE);
    assert.deepEqual({ tree: result.tree, fallback: result.fallback }, { tree: null, fallback: 'too-many-errors' });
    assert.equal(result.errorRatio, ratio);
  }
  assert.equal(ERROR_RATIO_LIMIT, 0.3);
});

test('the error ratio grows with the broken share of the file and counts nested errors once', async () => {
  const service = createTreeSitterService();
  const good = 'def test_ok():\n    assert total == 42\n\n';
  const ratioOf = async (text) => {
    const tree = await service.parse('python', text);
    const ratio = errorRatio(tree, text.length);
    tree.delete();
    return ratio;
  };
  assert.equal(await ratioOf(good.repeat(5)), 0);
  const small = await ratioOf(`${good.repeat(20)}}}}} ))) @@@\n`);
  const large = await ratioOf(`${good}}}}} ))) @@@ ((( ]]] {{{ ;;; ???\n`.repeat(3));
  assert.ok(small > 0 && small < 0.1, `small ${small}`);
  assert.ok(large > small && large <= 1, `large ${large}`);
});

test('an empty file parses to an empty tree with no errors', async () => {
  const result = await createTreeSitterService().parseForReview('java', '');
  assert.deepEqual({ fallback: result.fallback, errorRatio: result.errorRatio, hasError: result.tree.rootNode.hasError }, { fallback: null, errorRatio: 0, hasError: false });
  result.tree.delete();
});

test('a grammar that is missing or corrupt means no tree, not a crash, and other grammars still work', async () => {
  const service = createTreeSitterService({
    readAsset(name) {
      if (name === 'grammars/python.wasm') throw new Error('Asset not found: grammars/python.wasm');
      if (name === 'grammars/java.wasm') return new Uint8Array([0, 97, 115, 109, 1, 2, 3, 4]);
      return readAsset(name);
    },
  });
  assert.equal(await service.parse('python', PY), null);
  assert.deepEqual(await service.parseForReview('python', PY), { tree: null, errorRatio: 0, fallback: 'grammar-unavailable' });
  assert.equal(service.loadError('python'), 'Asset not found: grammars/python.wasm');

  assert.deepEqual(await service.parseForReview('java', 'class A {}'), { tree: null, errorRatio: 0, fallback: 'grammar-unavailable' });
  assert.equal(typeof service.loadError('java'), 'string');

  const tree = await service.parse('typescript', 'const a: number = 1;');
  assert.equal(tree.rootNode.hasError, false);
  assert.equal(service.loadError('typescript'), null);
  assert.deepEqual(service.loadedGrammars(), ['typescript']);
  tree.delete();
});

test('a grammar id that is not in the manifest means no tree', async () => {
  const service = createTreeSitterService();
  assert.equal(await service.parse('cobol', 'DISPLAY "HI".'), null);
  assert.equal(service.loadError('cobol'), 'no grammar "cobol" in grammars/manifest.json');
  assert.equal(await service.query('cobol', '(program) @p'), null);
});

test('queries are compiled once per grammar and source, and a bad query throws', async () => {
  const service = createTreeSitterService();
  const source = '(call_expression function: (identifier) @name)';
  const query = await service.query('javascript', source);
  assert.equal(await service.query('javascript', source), query);
  assert.notEqual(await service.query('typescript', source), query);

  const tree = await service.parse('javascript', "test('a', () => { expect(total).toBe(42); });\nit('b', () => {});\n");
  assert.deepEqual(query.captures(tree.rootNode).map((capture) => capture.node.text), ['test', 'expect', 'it']);
  tree.delete();
  await assert.rejects(service.query('javascript', '(no_such_node) @x'));
});

test('CRLF line endings and a byte order mark give the same tree as plain LF text', async () => {
  const service = createTreeSitterService();
  const lf = BROKEN.java.replace('assertEquals(1, ;', 'assertEquals(1, 1);');
  const plain = await service.parse('java', lf);
  const windows = await service.parse('java', toLf(BOM + lf.replace(/\n/g, '\r\n')));
  assert.equal(plain.rootNode.hasError, false);
  assert.equal(windows.rootNode.toString(), plain.rootNode.toString());
  assert.deepEqual(spanOfNode(windows.rootNode), spanOfNode(plain.rootNode));
  plain.delete();
  windows.delete();
});

test('columns after non-ASCII text count UTF-16 code units, like JavaScript strings', async () => {
  const text = "test('añadir al carrito 🛒', () => {});\n";
  const tree = await createTreeSitterService().parse('typescript', text);
  const arrow = tree.rootNode.descendantsOfType('arrow_function')[0];
  assert.equal(tree.rootNode.hasError, false);
  assert.equal(spanOfNode(arrow).startColumn, text.indexOf('() =>') + 1);
  assert.equal(arrow.text, '() => {}');
  tree.delete();
});
