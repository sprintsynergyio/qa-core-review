// The lexical scanner (src/parse/lexical.ts): comment- and string-aware, with no grammar.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JAVA_LEXICAL, JS_LEXICAL, PYTHON_LEXICAL, lexicalSyntaxFor, scanLines, segments } from '../dist/index.js';

const kinds = (text, syntax) => segments(text, syntax).map((segment) => [segment.kind, text.slice(segment.start, segment.end)]);

test('segments cover the whole text, in order, with no gaps', () => {
  const samples = [
    ["const a = 'x'; // note\n/* block */ call(`t`);\n", JS_LEXICAL],
    ['def test_a():\n    """Doc."""\n    assert x == "#no"  # yes\n', PYTHON_LEXICAL],
    ['String s = """\n  text // no\n""";\nchar c = \'"\'; /* c */\n', JAVA_LEXICAL],
    ['', JS_LEXICAL],
    ['"never closed', JS_LEXICAL],
  ];
  for (const [text, syntax] of samples) {
    const found = segments(text, syntax);
    assert.equal(found.map((segment) => text.slice(segment.start, segment.end)).join(''), text);
    found.forEach((segment, index) => assert.equal(segment.start, index === 0 ? 0 : found[index - 1].end));
  }
});

test('JavaScript: comment markers inside strings are not comments, and quotes inside comments are not strings', () => {
  assert.deepEqual(kinds("go('http://x'); // it's fine\nnext();", JS_LEXICAL), [
    ['code', 'go('],
    ['string', "'http://x'"],
    ['code', '); '],
    ['comment', "// it's fine"],
    ['code', '\nnext();'],
  ]);
  assert.deepEqual(kinds('a /* "q" // x */ b', JS_LEXICAL).map(([kind]) => kind), ['code', 'comment', 'code']);
});

test('JavaScript: escaped quotes stay inside the string, and template literals span lines', () => {
  assert.deepEqual(kinds("f('it\\'s', \"a\\\\\");", JS_LEXICAL).filter(([kind]) => kind === 'string'), [['string', "'it\\'s'"], ['string', '"a\\\\"']]);
  assert.deepEqual(kinds('t(`line 1\n// not a comment\n`);', JS_LEXICAL).map(([kind]) => kind), ['code', 'string', 'code']);
});

test('Python: triple-quoted strings span lines and hide the hash mark', () => {
  const text = 'x = """one\n# two\n"""\ny = \'#\'  # real\n';
  assert.deepEqual(kinds(text, PYTHON_LEXICAL).filter(([kind]) => kind !== 'code'), [
    ['string', '"""one\n# two\n"""'],
    ['string', "'#'"],
    ['comment', '# real'],
  ]);
});

test('Java: text blocks are strings, and a char literal with a double quote does not open a string', () => {
  const text = 'String s = """\n  // no\n  """;\nchar c = \'"\'; // yes\n';
  assert.deepEqual(kinds(text, JAVA_LEXICAL).filter(([kind]) => kind !== 'code').map(([kind]) => kind), ['string', 'string', 'comment']);
});

test('an unclosed string ends at the end of its line, and an unclosed block comment at the end of the file', () => {
  assert.deepEqual(kinds("a = 'open\nb = 1 // c", JS_LEXICAL), [
    ['code', 'a = '],
    ['string', "'open"],
    ['code', '\nb = 1 '],
    ['comment', '// c'],
  ]);
  assert.equal(segments("a = 'open\n", JS_LEXICAL)[1].closeLength, 0);
  assert.deepEqual(kinds('a /* never\nends', JS_LEXICAL), [['code', 'a '], ['comment', '/* never\nends']]);
});

test('lexicalSyntaxFor builds a syntax from comment markers alone', () => {
  const scala = lexicalSyntaxFor({ line: ['//'], block: [['/*', '*/']] });
  assert.deepEqual(kinds('it("adds") { /* x */ } // y', scala).map(([kind]) => kind), ['code', 'string', 'code', 'comment', 'code', 'comment']);
  const shell = lexicalSyntaxFor({ line: ['#'] });
  assert.equal(shell.block, undefined);
  assert.deepEqual(kinds("echo '# no' # yes", shell).map(([kind]) => kind), ['code', 'string', 'code', 'comment']);
});

test('scanLines keeps columns: comments are blanked in code, string content too in codeNoStrings', () => {
  const lines = scanLines("  await sleep(3000); // wait('x')\nlog('time.sleep(3)');\n", JS_LEXICAL);
  assert.equal(lines.length, 3);
  assert.deepEqual(lines[0], {
    line: 1,
    text: "  await sleep(3000); // wait('x')",
    code: '  await sleep(3000);             ',
    codeNoStrings: '  await sleep(3000);             ',
    indent: 2,
    comments: [{ column: 22, text: "// wait('x')" }],
  });
  assert.equal(lines[1].code, "log('time.sleep(3)');");
  assert.equal(lines[1].codeNoStrings, "log('             ');");
  assert.deepEqual(lines[2], { line: 3, text: '', code: '', codeNoStrings: '', indent: 0, comments: [] });
  for (const line of lines) assert.equal(line.code.length, line.text.length);
});

test('scanLines gives every line of a block comment its own piece, and skips blank pieces', () => {
  const lines = scanLines('a(); /* one\n\n   two */ b();\n', JAVA_LEXICAL);
  assert.deepEqual(lines.map((line) => line.comments), [
    [{ column: 6, text: '/* one' }],
    [],
    [{ column: 1, text: '   two */' }],
    [],
  ]);
  assert.equal(lines[2].code, '          b();');
  assert.equal(lines[2].indent, 3);
});

test('scanLines on Python keeps a docstring out of codeNoStrings and finds the suppression comment', () => {
  const text = 'def test_a():\n    """Uses time.sleep(1)."""\n    time.sleep(3)  # qa-core-review-disable-next-line QCR-W001 -- demo\n';
  const lines = scanLines(text, PYTHON_LEXICAL);
  assert.doesNotMatch(lines[1].codeNoStrings, /sleep/);
  assert.match(lines[2].codeNoStrings, /time\.sleep\(3\)/);
  assert.deepEqual(lines[2].comments, [{ column: 20, text: '# qa-core-review-disable-next-line QCR-W001 -- demo' }]);
});
