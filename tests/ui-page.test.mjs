// The files of the review page (SPEC.md Section 13.3): the tokenizer of the code view, the
// logic of the page as far as it runs with no browser, and the rule that the page loads nothing
// from outside.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { reviewItems, newSession, startUiServer, LANGUAGE_IDS } from '../dist/index.js';
import {
  CHIPS, LANGUAGE_NAMES, buildItems, countsOf, createApi, findingsByLine, groupItems, languageName, neighbourId, nextUndecidedId, rangesFor, verdictOf, visibleItems,
} from '../ui/app.js';
import { LANGUAGES, highlightLines, languageOf } from '../ui/highlight.js';
import { repoRoot } from './helpers/schema.mjs';
import { SOURCES, call, sampleReport, sessionFileFor } from './helpers/ui.mjs';

const uiFile = (name) => fs.readFileSync(path.join(repoRoot, 'ui', name), 'utf8');
/** Lines of tokens as text: `<k:word>` keyword, `<s:...>` string, `<c:...>` comment, the rest as it is. */
const marked = (source, language) => highlightLines(source, language).map((line) => line.map((part) => (part.type === 'plain' ? part.text : `<${part.type[0]}:${part.text}>`)).join(''));

test('highlighting TypeScript: keywords, strings, template strings over lines, and both kinds of comment', () => {
  const source = [
    "import { test, expect } from '@playwright/test'; // setup",
    "test('adds a \\'backpack\\'', async ({ page }) => {",
    '  /* wait for',
    '     the badge */ const label: string = `items: ${count}',
    '  left`;',
    '  await expect(page.getByText("it\'s here")).toBeVisible();',
    '  order.new = this.class;',
    '});',
  ].join('\n');
  assert.deepEqual(marked(source, 'typescript'), [
    "<k:import> { test, expect } <k:from> <s:'@playwright/test'>; <c:// setup>",
    "test(<s:'adds a \\'backpack\\''>, <k:async> ({ page }) => {",
    '  <c:/* wait for>',
    '<c:     the badge */> <k:const> label: <k:string> = <s:`items: ${count}>',
    '<s:  left`>;',
    '  <k:await> expect(page.getByText(<s:"it\'s here">)).toBeVisible();',
    '  order.new = <k:this>.class;',
    '});',
  ]);
  // `string` and `interface` are words of TypeScript, not of JavaScript.
  assert.deepEqual(marked('interface Cart { name: string }', 'javascript'), ['interface Cart { name: string }']);
});

test('highlighting Python: keywords, triple-quoted strings, and a # that is inside a string', () => {
  const source = ['def test_total(cart):', '    """Adds two items', '    and checks the total."""', "    assert cart.total() == '#1 of 2'  # the label", '    return None', "    name = 'not closed"].join('\n');
  assert.deepEqual(marked(source, 'python'), [
    '<k:def> test_total(cart):', '    <s:"""Adds two items>', '<s:    and checks the total.""">', "    <k:assert> cart.total() == <s:'#1 of 2'>  <c:# the label>", '    <k:return> <k:None>', "    name = <s:'not closed>",
  ]);
});

test('highlighting Java: keywords, strings with escapes, chars, text blocks and comments', () => {
  const source = ['@Test', 'public void addsAnItem() throws Exception {', '    String name = "a \\"quoted\\" name"; // the item', "    char first = '\\'';", '    String body = """', '        { "id": 7 }', '        """;', '    /** Checks it. */', '    assertEquals(1, cart.size());', '}'].join('\n');
  assert.deepEqual(marked(source, 'java'), [
    '@Test', '<k:public> <k:void> addsAnItem() <k:throws> Exception {', '    String name = <s:"a \\"quoted\\" name">; <c:// the item>', "    <k:char> first = <s:'\\''>;", '    String body = <s:""">', '<s:        { "id": 7 }>', '<s:        """>;',
    '    <c:/** Checks it. */>', '    assertEquals(1, cart.size());', '}',
  ]);
});

test('highlighting the other languages: C#, Go, Ruby, Kotlin, PHP, Robot Framework and Gherkin', () => {
  assert.deepEqual(marked('public async Task Adds() { var s = @"C:\\dir"; } // done', 'csharp'), ['<k:public> <k:async> Task Adds() { <k:var> s = <s:@"C:\\dir">; } <c:// done>']);
  assert.deepEqual(marked('func TestAdd(t *testing.T) {\n\tq := `raw\n"text"`\n}', 'go'), ['<k:func> TestAdd(t *testing.T) {', '\tq := <s:`raw>', '<s:"text"`>', '}']);
  assert.deepEqual(marked("=begin\nnotes\n=end\ndef adds\n  expect(cart.size).to eq 'one' # check\nend", 'ruby'), ['<c:=begin>', '<c:notes>', '<c:=end>', '<k:def> adds', "  expect(cart.size).to eq <s:'one'> <c:# check>", '<k:end>']);
  assert.deepEqual(marked('fun adds() { val name = "bag" }', 'kotlin'), ['<k:fun> adds() { <k:val> name = <s:"bag"> }']);
  assert.deepEqual(marked('public function testAdds() { $a = \'x\'; # one\n// two\n}', 'php'), ["<k:public> <k:function> testAdds() { $a = <s:'x'>; <c:# one>", '<c:// two>', '}']);
  assert.deepEqual(marked('*** Test Cases ***\nAdds An Item\n    [Tags]    smoke\n    Click    id=add    # the button\n    IF    ${ok}\n    END', 'robot'), [
    '<k:*** Test Cases ***>', 'Adds An Item', '    <k:[Tags]>    smoke', '    Click    id=add    <c:# the button>', '    <k:IF>    ${ok}', '    <k:END>',
  ]);
  assert.deepEqual(marked('Feature: Cart\n  # a note\n  Scenario Outline: adds\n    Given a "backpack"\n    Givenness is not a step\n    When I add it', 'gherkin'), [
    '<k:Feature:> Cart', '  <c:# a note>', '  <k:Scenario Outline:> adds', '    <k:Given> a <s:"backpack">', '    Givenness is not a step', '    <k:When> I add it',
  ]);
});

test('a language with no table is plain text, and every language id of the tool has a name on the page', () => {
  assert.deepEqual(highlightLines('if x: "a" # b', 'scala'), [[{ type: 'plain', text: 'if x: "a" # b' }]]);
  assert.equal(languageOf('__proto__'), LANGUAGES.plain);
  assert.deepEqual(highlightLines('', 'java'), [[]]);
  for (const id of LANGUAGE_IDS) assert.ok(Object.hasOwn(LANGUAGE_NAMES, id), id);
  for (const id of ['javascript', 'typescript', 'python', 'java', 'csharp', 'go', 'ruby', 'kotlin', 'php', 'robot', 'gherkin']) assert.notEqual(languageOf(id), LANGUAGES.plain, id);
  assert.deepEqual([languageName('csharp'), languageName('scala')], ['C#', 'scala']);
});

test('the tokens of every line give the line back, for every file of the fixtures in every language', () => {
  const byExtension = { '.ts': 'typescript', '.js': 'javascript', '.py': 'python', '.java': 'java' };
  const files = fs.readdirSync(path.join(repoRoot, 'fixtures', 'adapters'), { recursive: true }).map(String).filter((name) => Object.hasOwn(byExtension, path.extname(name)));
  assert.ok(files.length > 60);
  for (const name of files) {
    const source = fs.readFileSync(path.join(repoRoot, 'fixtures', 'adapters', name), 'utf8').replace(/\r\n/g, '\n');
    const lines = highlightLines(source, byExtension[path.extname(name)]);
    assert.equal(lines.map((line) => line.map((part) => part.text).join('')).join('\n'), source, name);
    assert.ok(lines.flat().every((part) => ['plain', 'keyword', 'string', 'comment'].includes(part.type) && part.text !== ''), name);
  }
});

test('the files of the page name no outside address, except links to the docs of this tool', () => {
  const names = fs.readdirSync(path.join(repoRoot, 'ui')).sort();
  assert.deepEqual(names, ['app.js', 'highlight.js', 'index.html', 'styles.css']);
  for (const name of names) {
    const text = uiFile(name);
    const urls = text.match(/(?:https?:|wss?:|ftp:)?\/\/[\w.-]+\.[a-z]{2,}[^\s'"`)<]*/gi) ?? [];
    assert.deepEqual(urls.filter((url) => !url.startsWith('https://github.com/sprintsynergyio/qa-core-review/')), [], name);
    assert.doesNotMatch(text, /@import|url\(|\bXMLHttpRequest\b|\bWebSocket\b|\bEventSource\b|sendBeacon|\bimportScripts\b|\beval\(|new Function|innerHTML|outerHTML|insertAdjacentHTML|document\.write/, name);
  }
  // The one address in the page is the prefix a docs link must have before it is shown as a link.
  assert.deepEqual(names.filter((name) => uiFile(name).includes('https://')), ['app.js']);
  // The page asks for its data from its own server, by path only.
  assert.match(uiFile('app.js'), /fetch\(path, init\)/);
  assert.equal(uiFile('app.js').match(/\bfetch\(/g).length, 1);
});

test('index.html loads only its own three files and has no inline script, style or event handler', () => {
  const html = uiFile('index.html');
  assert.deepEqual([...html.matchAll(/\b(?:src|href)="([^"]*)"/g)].map((match) => match[1]), ['styles.css', 'app.js']);
  assert.match(uiFile('app.js'), /from '\.\/highlight\.js'/);
  assert.deepEqual(html.match(/<script[^>]*>[^<]+<\/script>|<style|\sstyle=|\son[a-z]+=/gi), null);
  assert.match(html, /<html lang="en">/);
  // Every element the script looks up by id is in the page, or is made by the script itself.
  const wanted = new Set([...uiFile('app.js').matchAll(/byId\('([a-z-]+)'\)/g)].map((match) => match[1]));
  const present = new Set([...html.matchAll(/\sid="([a-z-]+)"/g)].map((match) => match[1]));
  assert.deepEqual([...wanted].filter((id) => !present.has(id)), ['test-comment']);
  assert.match(uiFile('app.js'), /id, disabled: state\.finished/);
  // Real buttons, and no element that only looks like one.
  assert.ok(html.match(/<button type="button"/g).length >= 4);
  assert.doesNotMatch(`${html}${uiFile('app.js')}`, /role="button"|el\('div', \{[^}]*onclick/);
});

test('the server serves the page files with their types and the security headers', async (t) => {
  const { report } = await sampleReport();
  const server = await startUiServer({ report, sources: SOURCES, sessionFile: sessionFileFor(t) });
  t.after(() => server.close());
  for (const [target, name, type] of [[`/?t=${server.token}`, 'index.html', 'text/html'], ['/index.html', 'index.html', 'text/html'], ['/app.js', 'app.js', 'text/javascript'], ['/highlight.js', 'highlight.js', 'text/javascript'], ['/styles.css', 'styles.css', 'text/css']]) {
    const answer = await call(server, 'GET', target, { token: null });
    assert.deepEqual([answer.status, answer.headers['content-type'], answer.headers['content-security-policy'], answer.headers['x-content-type-options']], [200, `${type}; charset=utf-8`, "default-src 'self'", 'nosniff'], target);
    assert.equal(answer.text, uiFile(name), target);
  }
  const head = await call(server, 'HEAD', '/app.js', { token: null });
  assert.deepEqual([head.status, head.text], [200, '']);
});

test('the page builds the same items as the session, with a verdict for each', async () => {
  const { report, tests } = await sampleReport();
  const session = newSession(report);
  const items = buildItems(report, session);
  assert.deepEqual(items.map((item) => item.id), reviewItems(report).map((item) => item.id));
  assert.deepEqual(items.map((item) => [item.kind, item.title, item.file, item.line, item.verdict, item.language, item.framework, item.findings.map((entry) => entry.ruleId).join(' ')]), [
    ['test', 'adds a backpack', 'tests/cart.spec.ts', 3, 'fail', 'typescript', 'playwright', 'QCR-A001 QCR-W001'],
    ['test', 'shows the badge', 'tests/cart.spec.ts', 8, 'review', 'typescript', 'playwright', 'QCR-W001'],
    ['test', 'opens the cart', 'tests/cart.spec.ts', 14, 'pass', 'typescript', 'playwright', ''],
    ['file', 'Whole file', 'tests/cart.spec.ts', 1, 'pass', 'typescript', 'playwright', 'QCR-N001'],
    ['file', 'Whole file', 'tests/empty.spec.ts', 1, 'pass', 'typescript', 'playwright', 'QCR-X001'],
  ]);
  assert.deepEqual([verdictOf([]), verdictOf([{ severity: 'info' }]), verdictOf([{ severity: 'warn' }, { severity: 'info' }]), verdictOf([{ severity: 'warn' }, { severity: 'error' }])], ['pass', 'pass', 'review', 'fail']);

  assert.deepEqual(countsOf(items, session), { fail: 1, review: 1, pass: 3, total: 5, decided: 0 });
  session.tests[tests['opens the cart'].id].decision = 'approved';
  session.tests[tests['adds a backpack'].id].decision = 'rejected';
  assert.deepEqual(countsOf(items, session), { fail: 1, review: 1, pass: 3, total: 5, decided: 2 });

  const titles = (filter) => visibleItems(items, session, filter).map((item) => `${item.title} ${item.file.slice(6, 10)}`);
  assert.deepEqual(CHIPS, ['All', 'Fail', 'Review', 'Pass', 'Undecided']);
  assert.equal(visibleItems(items, session).length, 5);
  assert.deepEqual(titles({ chip: 'Fail' }), ['adds a backpack cart']);
  assert.deepEqual(titles({ chip: 'Review' }), ['shows the badge cart']);
  assert.deepEqual(titles({ chip: 'Pass' }), ['opens the cart cart', 'Whole file cart', 'Whole file empt']);
  assert.deepEqual(titles({ chip: 'Undecided' }), ['shows the badge cart', 'Whole file cart', 'Whole file empt']);
  assert.deepEqual(titles({ chip: 'All', language: 'python' }), []);
  assert.equal(visibleItems(items, session, { chip: 'Pass', language: 'typescript' }).length, 3);
});

test('items are grouped by language and file, and J, K and the next undecided test move through the list', () => {
  const item = (id, language, file) => ({ id, language, file });
  const list = [item('a', 'typescript', 'a.spec.ts'), item('b', 'python', 'test_b.py'), item('c', 'typescript', 'a.spec.ts'), item('d', 'typescript', 'd.spec.ts')];
  assert.deepEqual(groupItems(list).map((group) => [group.language, group.files.map((file) => [file.file, file.items.map((entry) => entry.id).join('')])]), [
    ['typescript', [['a.spec.ts', 'ac'], ['d.spec.ts', 'd']]], ['python', [['test_b.py', 'b']]],
  ]);
  assert.deepEqual([neighbourId(list, 'a', 1), neighbourId(list, 'd', 1), neighbourId(list, 'a', -1), neighbourId(list, 'c', -1), neighbourId(list, 'gone', 1), neighbourId([], 'a', 1)], ['b', 'd', 'a', 'b', 'a', null]);
  const session = { tests: { a: { decision: 'pending' }, b: { decision: 'approved' }, c: { decision: 'pending' }, d: { decision: 'rejected' } } };
  assert.deepEqual([nextUndecidedId(list, session, 'a'), nextUndecidedId(list, session, 'c'), nextUndecidedId(list, session, 'd')], ['c', 'a', 'a']);
  session.tests.c.decision = 'approved';
  assert.equal(nextUndecidedId(list, session, 'a'), null);
});

test('the lines shown are the test, a whole short file, or a few lines around each finding of a long file', () => {
  const at = (line) => ({ location: { startLine: line } });
  assert.deepEqual(rangesFor({ kind: 'test', line: 12, endLine: 18, findings: [] }, 40), [[12, 18]]);
  // The file got shorter since the review: the range stays inside it.
  assert.deepEqual(rangesFor({ kind: 'test', line: 12, endLine: 18, findings: [] }, 15), [[12, 15]]);
  assert.deepEqual(rangesFor({ kind: 'file', line: 1, endLine: null, findings: [at(4)] }, 200), [[1, 200]]);
  assert.deepEqual(rangesFor({ kind: 'file', line: 1, endLine: null, findings: [at(300), at(4), at(12), at(996)] }, 1000), [[1, 17], [295, 305], [991, 1000]]);
  assert.deepEqual(rangesFor({ kind: 'file', line: 1, endLine: null, findings: [] }, 1000), [[1, 6]]);
  assert.deepEqual(rangesFor({ kind: 'file', line: 1, endLine: null, findings: [] }, 0), []);

  const inside = { id: 'f1', location: { startLine: 13 } };
  const second = { id: 'f2', location: { startLine: 13 } };
  const outside = { id: 'f3', location: { startLine: 2 } };
  const byLine = findingsByLine({ findings: [inside, outside, second] }, [[12, 18]]);
  assert.deepEqual([...byLine.keys()], [13, null]);
  assert.deepEqual([byLine.get(13), byLine.get(null)], [[inside, second], [outside]]);
});

test('the API client sends the token with every call and gives the reason when a call is refused', async () => {
  const sent = [];
  const answers = [
    { ok: true, status: 200, headers: new Map([['content-type', 'application/json; charset=utf-8']]), text: async () => '{"schemaVersion":1}' },
    { ok: true, status: 200, headers: new Map([['content-type', 'text/plain; charset=utf-8']]), text: async () => 'Outcome: APPROVED' },
    { ok: false, status: 403, headers: new Map(), text: async () => '{"error":"the X-QCR-Token header is missing or wrong"}' },
    { ok: false, status: 502, headers: new Map(), text: async () => 'Bad Gateway' },
  ];
  const api = createApi('abc123', async (target, init) => {
    sent.push([target, init]);
    return answers.shift();
  });
  assert.deepEqual(await api('PUT', '/api/session/general', { comment: 'x' }), { schemaVersion: 1 });
  assert.equal(await api('GET', '/api/prompt'), 'Outcome: APPROVED');
  await assert.rejects(api('GET', '/api/report'), { message: 'GET /api/report: 403 the X-QCR-Token header is missing or wrong' });
  await assert.rejects(api('POST', '/api/finish', {}), { message: 'POST /api/finish: 502 Bad Gateway' });
  assert.deepEqual(sent.slice(0, 2), [
    ['/api/session/general', { method: 'PUT', headers: { 'X-QCR-Token': 'abc123', 'Content-Type': 'application/json' }, body: '{"comment":"x"}' }],
    ['/api/prompt', { method: 'GET', headers: { 'X-QCR-Token': 'abc123' } }],
  ]);
});
