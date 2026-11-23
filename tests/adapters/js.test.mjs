// The JS/TS adapter (SPEC.md Sections 9.1 and 17): golden models, framework detection,
// vocabulary coverage, capabilities and robustness.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  JS_VOCAB_SURFACE, MAX_SOURCE_BYTES, bodyHash, clipText, createHelperIndex, createRegistry, createTreeSitterService, jsAdapter, jsGrammarFor, parseSuppression,
  readAsset, readSourceFile,
} from '../../dist/index.js';
import { adapterContext, capabilityFilled, fixtureRoot, frameworkFolders, normalizeProject, normalizeText } from '../helpers/adapter-suite.mjs';
import { BIG_FILES } from '../helpers/big-files.mjs';
import { expectGolden } from '../helpers/golden.mjs';
import { repoRoot, schemaErrors } from '../helpers/schema.mjs';

const FRAMEWORKS = ['cypress', 'jest', 'mocha', 'node-test', 'playwright', 'vitest', 'webdriverio'];
const models = new Map();
/** Every fixture file of one framework folder, normalized once and kept for the other tests. */
async function modelsOf(framework) {
  if (!models.has(framework)) models.set(framework, await normalizeProject(jsAdapter, fixtureRoot('adapters', 'js', framework)));
  return models.get(framework);
}
const modelOf = async (framework, file) => (await modelsOf(framework)).find((entry) => entry.file === file).model;
const summary = (model) => model.tests.map((t) => [t.fullTitle, t.modifiers.join(' '), t.parameterized && `${t.parameterized.source}:${t.parameterized.cases}`]);
const js = (text, relPath = 'tests/a.test.ts', options) => normalizeText(jsAdapter, relPath, text, options);

test('there is a fixture folder for each of the seven frameworks, and the adapter is registered', () => {
  assert.deepEqual(frameworkFolders('js'), FRAMEWORKS);
  assert.equal(createRegistry().get('js'), jsAdapter);
  assert.deepEqual(createRegistry().forPath('src/Cart.test.TSX'), [jsAdapter]);
});

for (const framework of FRAMEWORKS) {
  test(`${framework}: every fixture matches its golden model and the model schema`, async () => {
    const results = await modelsOf(framework);
    assert.ok(results.length > 0);
    for (const { file, model } of results) {
      assert.deepEqual(schemaErrors('model.schema.json', model), [], file);
      expectGolden(model, path.join(fixtureRoot('adapters', 'js', framework), `${file}.model.json`));
      assert.equal(model.role, file.includes('/pages/') ? 'support' : 'test', file);
      assert.equal(model.parseStatus, 'ok', file);
    }
  });
}

test('framework detection is right for every fixture file', async () => {
  const detected = {};
  for (const framework of FRAMEWORKS) {
    for (const { file, source, model } of await modelsOf(framework)) {
      detected[`${framework}/${file}`] = [model.runner, model.language, jsAdapter.detectFrameworks(source, null).confidence];
    }
  }
  assert.deepEqual(detected, {
    'cypress/cypress/e2e/assertions.cy.js': ['cypress', 'javascript', 'medium'],
    'cypress/cypress/e2e/login.cy.js': ['cypress', 'javascript', 'medium'], // the `cy` global
    'jest/src/Cart.test.tsx': ['jest', 'typescript', 'medium'], // no import: the project's only runner with globals
    'jest/src/CartDom.test.tsx': ['jest', 'typescript', 'medium'],
    'jest/src/cart.test.ts': ['jest', 'typescript', 'high'], // imports @jest/globals
    'jest/src/matchers.test.ts': ['jest', 'typescript', 'high'],
    'mocha/test/chai.test.js': ['mocha', 'javascript', 'medium'],
    'mocha/test/orders.test.js': ['mocha', 'javascript', 'medium'],
    'mocha/test/tdd.test.js': ['mocha', 'javascript', 'high'],
    'node-test/test/assert.test.mjs': ['node-test', 'javascript', 'high'],
    'node-test/test/cart.test.mjs': ['node-test', 'javascript', 'high'],
    'playwright/tests/api.spec.ts': ['playwright', 'typescript', 'high'],
    'playwright/tests/assertions.spec.ts': ['playwright', 'typescript', 'high'],
    'playwright/tests/checkout.spec.ts': ['playwright', 'typescript', 'high'],
    'playwright/tests/pages/cart-page.ts': ['playwright', 'typescript', 'high'], // a support file
    'vitest/src/assertions.test.ts': ['vitest', 'typescript', 'high'],
    'vitest/src/price.test.ts': ['vitest', 'typescript', 'high'],
    'webdriverio/test/specs/cart.e2e.js': ['webdriverio', 'javascript', 'medium'], // `browser.` and `$(` count because the project has WebdriverIO
    'webdriverio/test/specs/login.e2e.ts': ['webdriverio', 'typescript', 'high'],
    'webdriverio/test/specs/matchers.e2e.ts': ['webdriverio', 'typescript', 'high'],
  });
});

test('a Playwright file and a Jest file in the same project each get their own runner', async () => {
  const results = await normalizeProject(jsAdapter, fixtureRoot('projects', 'js-basic'));
  assert.deepEqual(results.map(({ file, model }) => [file, model.runner, model.role, model.tests.length]), [
    ['src/cart.test.ts', 'jest', 'test', 2],
    ['tests/checkout.spec.ts', 'playwright', 'test', 2],
    ['tests/helpers/login.ts', 'playwright', 'support', 0], // it imports a type from @playwright/test
  ]);
});

test('detection: file markers beat the project, and a config override beats both', async () => {
  const project = (frameworks, evidence = ['package.json']) => ({ dir: '.', adapterId: 'js', languages: ['javascript', 'typescript'], frameworks, evidence });
  const globalsOnly = "describe('a', () => { it('b', () => { expect(1).toBe(1); }); });";
  assert.equal((await js(globalsOnly, 'a.test.js', { project: project(['playwright', 'vitest', 'mocha']) })).runner, 'mocha');
  assert.equal((await js(globalsOnly, 'a.test.js', { project: project(['vitest']) })).runner, 'vitest');
  assert.equal((await js(globalsOnly, 'a.test.js', { project: project(['playwright', 'vitest']) })).runner, 'unknown');
  assert.equal((await js(globalsOnly, 'a.test.js')).runner, 'unknown');
  assert.equal((await js(globalsOnly, 'e2e/a.cy.ts')).runner, 'cypress');
  assert.equal((await js("import { it } from 'vitest';\nit('a', () => {});", 'a.test.ts', { project: project(['jest']) })).runner, 'vitest');
  const mixed = await js("const { test } = require('node:test');\ntest('a', () => { jest.fn(); });", 'a.test.js');
  assert.deepEqual([mixed.runner, mixed.libraries], ['node-test', ['jest']]);
  // A marker inside a string or a comment is not a use of the framework.
  assert.equal((await js("// cy.visit('/')\nit('a', () => { log('vi.fn()'); });", 'a.test.js')).runner, 'unknown');
  assert.equal((await js("it('a', () => { browser.url('/'); });", 'a.test.js')).runner, 'unknown');
  assert.equal((await js(globalsOnly, 'a.test.js', { project: project(['testng', 'jest'], ['config: projects[0]', 'package.json']) })).runner, 'testng');
  assert.equal((await js("import { it } from 'vitest';\nit('a', () => {});", 'a.test.ts', { config: { framework: 'jest' } })).runner, 'jest');
});

test('Playwright: full titles, modifiers, skips and generated tests', async () => {
  const model = await modelOf('playwright', 'tests/checkout.spec.ts');
  assert.deepEqual(summary(model), [
    ['Checkout > adds a backpack to the cart', '', null],
    ['Checkout > opens the cart page', 'only', null],
    ['Checkout > removes an item', 'skip', null],
    ['Checkout > applies a coupon', 'fixme', null],
    ['Checkout > uploads a receipt', '', null],
    ['Checkout > prints the order', '', null],
    ['Checkout > logs in as ${user}', '', 'loop:3'],
    ['Checkout > sees the product list as ${user}', '', 'loop:null'],
    ['Checkout > Payment > fills the address', '', null],
    ['Checkout > Payment > rejects an empty address', 'fail', null],
    ['Checkout > Sorting > sorts by price', '', null],
  ]);
  const byTitle = (title) => model.tests.find((t) => t.title === title);
  assert.deepEqual(byTitle('removes an item').skip, { unconditional: true, conditional: false, reason: null });
  assert.deepEqual(byTitle('applies a coupon').skip, { unconditional: true, conditional: false, reason: null });
  assert.deepEqual(byTitle('uploads a receipt').skip, { unconditional: false, conditional: true, reason: 'File picker is not supported on Windows CI' });
  assert.deepEqual(byTitle('prints the order').skip, { unconditional: true, conditional: false, reason: null });
  assert.equal(byTitle('adds a backpack to the cart').skip, null);
  // `test.step` inside a test is not a test of its own.
  assert.equal(model.tests.filter((t) => t.title.includes('open the form')).length, 0);
  assert.deepEqual(byTitle('fills the address').suitePath, ['Checkout', 'Payment']);

  const [checkout] = model.suites;
  assert.deepEqual([checkout.title, checkout.testIds.length, checkout.hooks.map((hook) => [hook.kind, hook.scope])], ['Checkout', 8, [['afterEach', 'suite']]]);
  assert.deepEqual(checkout.suites.map((suite) => [suite.title, suite.modifiers, suite.hooks.map((hook) => hook.kind)]), [['Payment', ['serial'], ['beforeAll', 'afterAll']], ['Sorting', ['concurrent'], []]]);
  assert.deepEqual(model.fileHooks.map((hook) => [hook.kind, hook.scope, hook.span.startLine]), [['beforeEach', 'file', 14]]);
});

test('Playwright: spans are 1-based, the body span is the function body, and the hash ignores comments', async () => {
  const model = await modelOf('playwright', 'tests/checkout.spec.ts');
  const first = model.tests[0];
  assert.deepEqual(first.span, { startLine: 23, startColumn: 3, endLine: 26, endColumn: 5 });
  assert.deepEqual(first.bodySpan, { startLine: 23, startColumn: 59, endLine: 26, endColumn: 4 });
  assert.equal(first.statementCount, 2);
  assert.match(first.bodyHash, /^[0-9a-f]{40}$/);
  // The comment inside this body is not a statement and is not in the hash.
  assert.equal(model.tests[1].statementCount, 3);
  const plain = await js("test('a', async () => {\n  await go();\n  check();\n});");
  const noisy = await js("test('a', async () => {\n  // step one\n  await   go();\n\n  check(); /* done */\n});");
  assert.equal(noisy.tests[0].bodyHash, plain.tests[0].bodyHash);
  assert.notEqual((await js("test('a', async () => { await go(); check2(); });")).tests[0].bodyHash, plain.tests[0].bodyHash);
});

test('Playwright: two tests with the same full title get different ids, and imports and suppressions are read', async () => {
  const api = await modelOf('playwright', 'tests/api.spec.ts');
  assert.deepEqual(api.tests.map((t) => t.fullTitle), ['lists the orders', 'creates an order', 'lists the orders']);
  assert.equal(new Set(api.tests.map((t) => t.id)).size, 3);
  assert.deepEqual(api.imports.map((i) => [i.source, i.names, i.typeOnly, i.framework]), [['@playwright/test', ['test', 'expect'], false, true]]);

  const checkout = await modelOf('playwright', 'tests/checkout.spec.ts');
  assert.deepEqual(checkout.imports.map((i) => [i.names, i.typeOnly]), [[['test', 'expect'], false], [['Page'], true]]);
  assert.deepEqual(checkout.suppressions.map((s) => [s.scope, s.rules, s.reason, s.span.startLine]), [
    ['file', ['QCR-S001'], 'the shop uses generated class names', 1],
    ['next-line', ['QCR-W001'], 'the cart animation has no end event', 30],
  ]);
});

test('Jest: each tables, tagged templates, aliases, todo and describe.each', async () => {
  const model = await modelOf('jest', 'src/cart.test.ts');
  assert.deepEqual(summary(model), [
    ['Cart > adds an item', '', null],
    ['Cart > totals %i items to %d', '', 'each:3'],
    ['Cart > applies the $code coupon', '', 'each:2'],
    ['Cart > sends a receipt', 'concurrent', null],
    ['Cart > rejects a negative price', 'fail', null],
    ['Cart > merges two carts', 'todo', null],
    ['Cart > is focused by mistake', 'only', null],
    ['Cart > is switched off', 'skip', null],
    ['Cart > is switched off too', 'skip', null],
    ['Cart in %s > formats the total', '', 'each:2'],
    ['Focused suite > runs alone', '', null],
    ['Old checkout > is never run', '', null],
  ]);
  assert.deepEqual(model.suites.map((suite) => [suite.title, suite.modifiers]), [['Cart', []], ['Cart in %s', []], ['Focused suite', ['only']], ['Old checkout', ['skip']]]);
  assert.deepEqual(model.suites[0].hooks.map((hook) => hook.kind), ['beforeAll', 'afterAll', 'beforeEach']);
  const todo = model.tests.find((t) => t.title === 'merges two carts');
  assert.deepEqual([todo.bodyHash, todo.statementCount, todo.skip], [null, 0, null]);
  assert.deepEqual(todo.bodySpan, { startLine: todo.span.endLine, startColumn: todo.span.endColumn, endLine: todo.span.endLine, endColumn: todo.span.endColumn });
  // TSX parses with its own grammar.
  assert.deepEqual(summary(await modelOf('jest', 'src/Cart.test.tsx')), [['CartView > shows the number of items', '', null], ['CartView > shows an empty message', '', null]]);
});

test('Vitest: fails, skipIf, runIf, test.for and tests made by map', async () => {
  const model = await modelOf('vitest', 'src/price.test.ts');
  assert.deepEqual(summary(model), [
    ['formatPrice > formats euros', '', null],
    ['formatPrice > rounds half up', 'fail', null],
    ['formatPrice > reads the live rates', '', null],
    ['formatPrice > uses the cached rates', '', null],
    ['formatPrice > uses the %s symbol', '', 'each:2'],
    ['loadRates > returns every currency', '', null],
    ['rate cache > caches ${currency}', '', 'loop:2'],
  ]);
  assert.deepEqual(model.tests[2].skip, { unconditional: false, conditional: true, reason: null });
  assert.deepEqual(model.suites.map((suite) => suite.modifiers), [[], ['concurrent'], ['serial']]);
});

test('Mocha, Cypress, WebdriverIO and node:test: their own ways to declare, skip and focus', async () => {
  const mocha = await modelOf('mocha', 'test/orders.test.js');
  assert.deepEqual(summary(mocha), [
    ['orders > create > gives the order an id', '', null],
    ['orders > create > needs a database', '', null],
    ['orders > create > rejects an empty order', 'todo', null],
    ['orders > create > an order has a creation time', '', null],
    ['orders > cancel > marks the order as cancelled', '', null],
    ['orders > lists every order', 'only', null],
  ]);
  assert.deepEqual(mocha.tests[1].skip, { unconditional: false, conditional: true, reason: null }); // `if (...) this.skip()`
  assert.deepEqual(mocha.suites[0].suites.map((suite) => [suite.title, suite.modifiers]), [['create', []], ['cancel', ['skip']]]);
  assert.deepEqual(mocha.imports.map((i) => [i.source, i.names, i.framework]), [['chai', ['expect'], true], ['assert', ['*'], true], ['sinon', ['*'], true], ['../src/orders', ['*'], false]]);
  assert.deepEqual(summary(await modelOf('mocha', 'test/tdd.test.js')), [['total > adds the prices', '', null], ['total > with no prices > is zero', '', null]]);

  const cypress = await modelOf('cypress', 'cypress/e2e/login.cy.js');
  assert.deepEqual(summary(cypress).map(([title, modifiers]) => [title, modifiers]), [
    ['Login > with valid details > logs in the standard user', ''],
    ['Login > with valid details > shows the product list', ''],
    ['Login > with valid details > the cart starts empty', ''],
    ['Login > with a locked account > shows an error', 'only'],
    ['Login > with a locked account > keeps the user on the login page', 'skip'],
  ]);
  assert.deepEqual(cypress.suites[0].hooks.map((hook) => hook.kind), ['beforeAll', 'beforeEach', 'afterAll']);

  assert.deepEqual(summary(await modelOf('webdriverio', 'test/specs/login.e2e.ts')).map(([title]) => title), ['Login page > logs in the standard user', 'Login page > shows an error for a locked account']);

  const node = await modelOf('node-test', 'test/cart.test.mjs');
  assert.deepEqual(summary(node).map(([title, modifiers]) => [title, modifiers]), [
    ['a new cart is empty', ''], ['talks to the payment service', 'skip'], ['exports to CSV', 'todo'], ['is focused', 'only'],
    ['Cart > adds an item', ''], ['Cart > removes an item', 'skip'], ['Cart > merges two carts', 'todo'], ['namedTest', ''],
  ]);
  assert.deepEqual(node.tests[1].skip, { unconditional: true, conditional: false, reason: 'needs a sandbox account' });
  assert.deepEqual(node.imports.map((i) => [i.source, i.names]), [['node:assert/strict', ['default']], ['node:test', ['default', 'describe', 'it']], ['../src/cart.mjs', ['Cart']]]);
});

test('titles: escapes are decoded, templates keep ${...}, and a title that is not a literal keeps its source', async () => {
  const model = await js("it('it\\'s \\u00e9 \\n ok', () => {});\nit(`adds ${count} items`, () => {});\nit(Cart.name + ' works', () => {});\ndescribe(Cart.name, () => { it(\"quoted \\\"x\\\"\", () => {}); });");
  assert.deepEqual(model.tests.map((t) => t.fullTitle), [`it's ${String.fromCharCode(0xe9)} \n ok`, 'adds ${count} items', "Cart.name + ' works'", 'Cart.name > quoted "x"']);
});

test('only real declarations are tests: no false positives from look-alike calls', async () => {
  const model = await js(`
    const ok = /a/.test(input);
    function test(value) { return value; }
    test(5);
    items.forEach((it) => it.save());
    describe.configure({ mode: 'serial' });
    test.use({ locale: 'en' });
    test.extend({});
    it('real', () => { other.test('nested', () => {}); });
    import('./lazy').then((m) => m.describe('x', () => {}));
  `);
  assert.deepEqual(model.tests.map((t) => t.title), ['real']);
  assert.deepEqual(model.suites, []);
});

test('an import alias for a test function is followed, and tests inside helper functions are found', async () => {
  const model = await js("import { test as check, describe as group } from 'vitest';\ngroup('g', () => { check('a', () => {}); check.skip('b', () => {}); });\nfunction shared() { it('c', () => {}); }");
  assert.deepEqual(model.tests.map((t) => [t.fullTitle, t.modifiers]), [['g > a', []], ['g > b', ['skip']], ['c', []]]);
});

test('every vocabulary entry appears in at least one fixture', () => {
  const sources = [];
  for (const framework of FRAMEWORKS) {
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
      if (entry.isDirectory()) walk(path.join(dir, entry.name));
      else if (!entry.name.endsWith('.json')) sources.push(fs.readFileSync(path.join(dir, entry.name), 'utf8'));
    });
    walk(fixtureRoot('adapters', 'js', framework));
  }
  const all = sources.join('\n');
  const missing = JS_VOCAB_SURFACE.filter((entry) => {
    const escaped = entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const lead = /^[\w$]+$/.test(entry) ? '(?<![\\w$.])' : /^[\w$]/.test(entry) ? '(?<![\\w$])' : '';
    const pattern = `${lead}${escaped}${/[\w$]$/.test(entry) ? '(?![\\w$])' : ''}`;
    return !new RegExp(pattern).test(all);
  });
  assert.deepEqual(missing, []);
  assert.ok(JS_VOCAB_SURFACE.length > 350);
});

test('every capability the adapter declares is filled in at least one golden', async () => {
  const all = [];
  for (const framework of FRAMEWORKS) all.push(...(await modelsOf(framework)).map((entry) => entry.model));
  assert.deepEqual(jsAdapter.capabilities, ['tests', 'suites', 'hooks', 'modifiers', 'parameterized', 'assertions', 'assertion-operands', 'try-blocks', 'body-hash', 'helpers', 'reachability']);
  for (const capability of jsAdapter.capabilities) {
    assert.ok(all.some((model) => capabilityFilled(capability, model)), `no golden fills "${capability}"`);
    assert.ok(all.every((model) => model.capabilities.includes(capability)));
  }
});

test('robustness: a syntax error keeps the tests around it, and the file is marked partial', async () => {
  const model = await js("test('before', () => { expect(1).toBe(1); });\n\ntest('broken', () => {\n  expect(2).toBe(;\n});\n\ntest('after', () => { expect(3).toBe(3); });\n");
  assert.equal(model.parseStatus, 'partial');
  assert.deepEqual(model.tests.map((t) => t.title), ['before', 'broken', 'after']);
  assert.deepEqual(schemaErrors('model.schema.json', model), []);
});

test('robustness: an empty file, a file with no tests, and a file that is not code', async () => {
  const empty = await js('');
  assert.deepEqual([empty.role, empty.parseStatus, empty.tests.length, empty.runner], ['support', 'ok', 0, 'unknown']);
  assert.equal((await js("export function login(page) { return page.goto('/'); }\n")).role, 'support');
  const garbage = await js('<<<<<<< HEAD\n}}}} ))) ((( === @@@ ### \n>>>>>>> branch\n ]]] {{{ ;;; ??? \n');
  assert.deepEqual([garbage.parseStatus, garbage.capabilities, garbage.tests], ['failed', [], []]);
  assert.deepEqual(schemaErrors('model.schema.json', garbage), []);
});

test('robustness: a missing grammar gives a failed file, not a crash', async () => {
  const parser = createTreeSitterService({ readAsset: (name) => (name.endsWith('typescript.wasm') ? (() => { throw new Error('gone'); })() : readAsset(name)) });
  const model = await js("test('a', () => {});", 'a.test.ts', { parser });
  assert.deepEqual([model.parseStatus, model.capabilities, model.role], ['failed', [], 'support']);
});

test('robustness: CRLF, a byte order mark and non-ASCII titles', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcr-js-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const text = "describe('Café 🛒', () => {\n  it('añade un artículo', () => {\n    expect(total).toBe(1);\n  });\n});\n";
  fs.writeFileSync(path.join(dir, 'lf.test.js'), text);
  fs.writeFileSync(path.join(dir, 'crlf.test.js'), String.fromCharCode(0xfeff) + text.replace(/\n/g, '\r\n'));
  const [crlf, lf] = await normalizeProject(jsAdapter, dir);
  assert.deepEqual([crlf.file, lf.file], ['crlf.test.js', 'lf.test.js']);
  assert.deepEqual({ ...crlf.model, path: '', tests: crlf.model.tests.map((x) => ({ ...x, id: '' })), suites: [] }, { ...lf.model, path: '', tests: lf.model.tests.map((x) => ({ ...x, id: '' })), suites: [] });
  assert.equal(lf.model.tests[0].fullTitle, `Caf${String.fromCharCode(0xe9)} ${String.fromCodePoint(0x1f6d2)} > a${String.fromCharCode(0xf1)}ade un art${String.fromCharCode(0xed)}culo`);
  assert.deepEqual(lf.model.tests[0].span, { startLine: 2, startColumn: 3, endLine: 4, endColumn: 5 });
});

test('robustness: a file over 1 MB is not read, and a missing file is not an error', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcr-js-big-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'huge.test.js'), `test('a', () => {});\n${'// filler\n'.repeat(MAX_SOURCE_BYTES / 10)}`);
  fs.writeFileSync(path.join(dir, 'small.test.js'), "test('a', () => {});\r\n");
  const found = (name) => ({ path: name, adapterId: 'js', language: 'javascript', languageHint: null, project: null });
  assert.equal(readSourceFile(dir, found('huge.test.js')), null);
  assert.equal(readSourceFile(dir, found('gone.test.js')), null);
  assert.equal(readSourceFile(dir, found('small.test.js')).text, "test('a', () => {});\n");
});

test('robustness: a 1,000-line file is normalized in under 2 seconds from a cold start', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcr-js-timing-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, BIG_FILES.typescript.name);
  fs.writeFileSync(file, BIG_FILES.typescript.text);
  const helper = path.join(repoRoot, 'tests', 'helpers', 'normalize-once.mjs');
  const runs = [1, 2].map(() => JSON.parse(spawnSync(process.execPath, [helper, 'js', file], { encoding: 'utf8', windowsHide: true, shell: false }).stdout));
  t.diagnostic(`js: ${runs.map((run) => `${Math.round(run.ms)} ms`).join(', ')}`);
  assert.deepEqual([runs[0].tests, runs[0].parseStatus], [125, 'ok']);
  assert.ok(Math.min(...runs.map((run) => run.ms)) < 2000);
});

test('robustness: broken copies of every fixture are normalized without an error', async () => {
  let seed = 7;
  const next = (limit) => (seed = (seed * 1103515245 + 12345) % 2147483648) % limit;
  for (const framework of FRAMEWORKS) {
    for (const { file, source } of await modelsOf(framework)) {
      for (let round = 0; round < 12; round += 1) {
        const at = next(source.text.length);
        const broken = [source.text.slice(0, at), source.text.slice(0, at) + source.text.slice(at + 1 + next(10)), `${source.text.slice(0, at)}${'({[)]}`\'"'[next(9)]}${source.text.slice(at)}`][round % 3];
        const model = await js(broken, file);
        assert.deepEqual(schemaErrors('model.schema.json', model), [], `${file} cut at ${at}`);
      }
    }
  }
});

test('classifyFile tells test files from support files without parsing', () => {
  const classify = (relPath, text) => jsAdapter.classifyFile({ path: relPath, absPath: relPath, text, language: 'typescript', project: null });
  assert.equal(classify('a.spec.ts', "test.describe('x', () => {});"), 'test');
  assert.equal(classify('a.test.ts', "it.each`a\n${1}`('x', () => {});"), 'test');
  assert.equal(classify('helpers/login.ts', "export const login = () => page.goto('/');"), 'support');
  assert.equal(classify('helpers/notes.ts', "// describe('x') is used in the specs\nconst s = \"it('y')\";"), 'support');
  assert.equal(classify('types/a.d.ts', "declare function test(name: string): void;"), 'ignore');
  assert.deepEqual(['a.ts', 'a.mts', 'a.cts', 'A.TSX', 'a.js', 'a.jsx', 'a.mjs', 'a.cjs'].map(jsGrammarFor), ['typescript', 'typescript', 'typescript', 'tsx', 'javascript', 'javascript', 'javascript', 'javascript']);
});

test('shared model helpers: suppression comments, clipped text and the body hash', () => {
  const span = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 };
  assert.deepEqual(parseSuppression('// qa-core-review-disable-next-line QCR-W001, QCR-S001 -- slow page -- really', span), { span, scope: 'next-line', rules: ['QCR-W001', 'QCR-S001'], reason: 'slow page -- really' });
  assert.deepEqual(parseSuppression('/* qa-core-review-disable QCR-S001 -- legacy */', span), { span, scope: 'file', rules: ['QCR-S001'], reason: 'legacy' });
  assert.deepEqual(parseSuppression('# qa-core-review-disable-next-line QCR-A001', span), { span, scope: 'next-line', rules: ['QCR-A001'], reason: null });
  assert.deepEqual(parseSuppression('// qa-core-review-disable-next-line QCR-A001 --   ', span).reason, null);
  assert.equal(parseSuppression('// qa-core-review-disabled is not a thing', span), null);
  assert.equal(parseSuppression('// just a comment', span), null);
  assert.equal(clipText('  a\n   b  '), 'a b');
  assert.equal(clipText('x'.repeat(300)).length, 200);
  assert.ok(clipText('x'.repeat(300)).endsWith('...'));
  assert.equal(bodyHash(['a', '(', ')']), bodyHash(['a', '(', ')']));
  assert.notEqual(bodyHash(['a', '(', ')']), bodyHash(['b', '(', ')']));
});

test('a whole-file suppression after the first statement is not a suppression', async () => {
  const model = await js("import { it } from 'vitest';\n// qa-core-review-disable QCR-W001 -- too late\nit('a', () => {\n  // qa-core-review-disable-next-line QCR-W001 -- fine here\n  wait();\n});");
  assert.deepEqual(model.suppressions.map((s) => [s.scope, s.span.startLine]), [['next-line', 4]]);
});

// Assertions, try blocks and helpers (the second part of Milestone 4).

/** One assertion as a short line: kind, matcher, then only the flags that are set. */
const brief = (a) => [
  a.kind, a.matcher ?? '-', a.negated && 'not', a.soft && 'soft', !a.complete && 'incomplete', a.awaited !== 'not-needed' && `await:${a.awaited}`,
  a.guarded && 'guarded', !a.reachable && 'unreachable', a.viaHelper && `via:${a.viaHelper}`, a.statusCodes && `codes:${a.statusCodes}`,
].filter(Boolean).join(' ');
const operand = (e) => e && [e.kind, e.literal && `${e.literal.type}=${e.literal.value}`, e.isLocator && 'locator', e.isCount && 'count', e.isMock && 'mock'].filter(Boolean).join(' ');
/** The assertions of a test body, as short lines. */
const checks = async (body, options = {}) => {
  const { file = 'a.test.ts', head = '', ...rest } = options;
  return (await js(`${head}\ntest('t', async ({ page, request }) => {\n${body}\n});`, file, rest)).tests[0];
};
const PLAYWRIGHT = { file: 'a.spec.ts', head: "import { test, expect } from '@playwright/test';" };

test('assertions: every kind is read from its matcher, in each style', async () => {
  const t = await checks(`
    expect(a).toBe(1); expect(a).not.toEqual(b); expect(a).toBeTruthy(); expect(a).toBeNull(); expect(a).toBeGreaterThan(1);
    expect(a).toContain(1); expect(a).toBeInstanceOf(A); expect(() => f()).toThrow(); expect(a).toMatchSnapshot(); expect(spy).toHaveBeenCalledWith(1);
    expect(list).toHaveLength(2); expect(el).toBeVisible(); expect(a).toSatisfy(ok); expect(res.status()).toBe(404); expect([200, 201]).toContain(res.status);
    expect(order.status).toBe('NEW'); assert(a); assert.equal(a, 1); assert.notStrictEqual(a, 2); assert.throws(() => f()); assert.equal(res.statusCode, 500);
    a.should.equal(1); expect(a).to.be.true; expect(a).to.have.lengthOf(2).and.include(1); sinon.assert.calledOnce(spy); t.assert.ok(a);
    chai.expect(a).to.equal(1); chai.assert.isOk(a); await expect.element(el).toBeVisible(); expect.element(el).toBeVisible();
    console.assert(a); expect.extend({}); expect.any(Number); customCheck(a);`);
  assert.deepEqual(t.assertions.map(brief), [
    'equality toBe', 'equality toEqual not', 'truthiness toBeTruthy', 'nullness toBeNull', 'comparison toBeGreaterThan',
    'contains toContain', 'type toBeInstanceOf', 'throws toThrow', 'snapshot toMatchSnapshot', 'mock-call toHaveBeenCalledWith',
    'count toHaveLength', 'ui-state toBeVisible', 'other toSatisfy', 'status toBe codes:404', 'status toContain codes:200,201',
    'equality toBe', 'truthiness assert', 'equality equal', 'equality notStrictEqual not', 'throws throws', 'status equal codes:500',
    'equality equal', 'truthiness true', 'count lengthOf', 'mock-call calledOnce', 'truthiness ok',
    'equality equal', 'truthiness isOk', 'ui-state toBeVisible await:yes', 'ui-state toBeVisible await:no',
  ]);
  assert.deepEqual([...new Set(t.assertions.map((a) => a.library))], ['expect', 'node-assert', 'chai', 'sinon']);
  assert.deepEqual(t.assertions.slice(-4, -2).map((a) => a.library), ['chai', 'chai']);
  assert.equal(t.expectsException, true);
  assert.equal((await checks('expect(() => f()).not.toThrow(); assert.doesNotThrow(f);')).expectsException, false);
  assert.equal(t.assertions[0].text, 'expect(a).toBe(1)');
  assert.deepEqual(t.assertions[0].span, { startLine: 4, startColumn: 5, endLine: 4, endColumn: 22 });
});

test('assertions: operands know literals, locators, counts and mocks', async () => {
  const t = await checks(`
    const button = page.getByRole('button'); const rows = page.locator('tr'); const n = await rows.count(); const spy = vi.fn(); let late: Locator;
    expect(true).toBe(true); expect('a').toBe(\`a\`); expect(-1).toBe(null); expect(undefined).toEqual([]); expect({}).toEqual({ a: 1 });
    expect(button).toBeTruthy(); expect(rows.first()).toBeDefined(); expect(page.getByText('x').filter({ hasText: 'y' })).toBeTruthy(); expect(late).toBeTruthy();
    expect(rows.nth(1).textContent()).toBeTruthy(); expect(n).toBeGreaterThanOrEqual(0); expect(list.length).toBe(1); expect(set.size).toBe(1);
    expect(spy).toBe(spy); expect(spy.mock.calls.length).toBe(1); expect(jest.fn()).toBeDefined(); expect(total + /* cents */ tax).toBe( total+tax );`, PLAYWRIGHT);
  assert.deepEqual(t.assertions.map((a) => [operand(a.actual), operand(a.expected)]), [
    ['literal bool=true', 'literal bool=true'], ['literal string=a', 'literal string=a'], ['literal number=-1', 'literal null=null'],
    ['literal null=undefined', 'literal empty-collection=[]'], ['literal empty-collection={}', 'collection'],
    ['identifier locator', null], ['call locator', null], ['call locator', null], ['identifier locator', null],
    ['call', null], ['identifier count', 'literal number=0'], ['member count', 'literal number=1'], ['member count', 'literal number=1'],
    ['identifier mock', 'identifier mock'], ['member count mock', 'literal number=1'], ['call mock', null], ['other', 'other'],
  ]);
  const last = t.assertions.at(-1);
  assert.deepEqual([last.actual.text, last.actual.normalized, last.expected.normalized], ['total + /* cents */ tax', 'total+tax', 'total+tax']);
  // The same names in another test, or in a file that does not use Playwright, are not locators.
  const two = await js("import { test, expect } from '@playwright/test';\ntest('a', ({ page }) => { const x = page.locator('a'); expect(x).toBeTruthy(); });\ntest('b', () => { const x = 1; expect(x).toBeTruthy(); });", 'a.spec.ts');
  assert.deepEqual(two.tests.map((item) => item.assertions[0].actual.isLocator), [true, false]);
  assert.equal((await checks("expect(screen.getByText('x')).toBeTruthy(); expect($('a')).toBeTruthy();")).assertions.some((a) => a.actual.isLocator), false);
  assert.equal(operand((await checks("const item = cy.get('li').first(); expect(item).to.exist;", { file: 'a.cy.js' })).assertions[0].actual), 'identifier locator');
});

test('assertions: awaited is yes, no or not needed', async () => {
  const playwright = await checks(`
    await expect(page.locator('a')).toBeVisible(); expect(page.locator('a')).toBeVisible(); expect(page).toHaveURL('/'); expect(n).toBe(1);
    expect.poll(() => n).toBe(1); await expect.poll(() => n).toBe(1); expect(async () => {}).toPass();
    await Promise.all([expect(page).toHaveTitle('a')]); const pending = expect(page).toHaveTitle('a'); void run(expect(page).toHaveTitle('a'));
    await expect(page.locator('a')).toBeVisible().catch(() => {}); expect(page.locator('a')).toBeHidden().then(() => {});
    return expect(page.locator('a')).toBeVisible();`, PLAYWRIGHT);
  assert.deepEqual(playwright.assertions.map((a) => a.awaited), ['yes', 'no', 'no', 'not-needed', 'no', 'yes', 'no', 'yes', 'yes', 'yes', 'yes', 'no', 'yes']);
  assert.deepEqual([...new Set(playwright.assertions.map((a) => a.library))], ['playwright']);
  const jest = await checks("expect(el).toBeVisible(); expect(p).resolves.toBe(1); await expect(p).rejects.toThrow(); assert.rejects(p); it.each([1])('x', () => expect(p).resolves.toBe(1));");
  assert.deepEqual(jest.assertions.map((a) => a.awaited), ['not-needed', 'no', 'yes', 'no', 'yes']);
  const wdio = await checks("expect($('a')).toBeDisplayed(); await expect(browser).toHaveTitle('a'); expect(await $('a').getText()).toBe('b'); expect($('a')).toBeTruthy();", { file: 'a.e2e.ts', head: "import { expect } from '@wdio/globals';" });
  assert.deepEqual(wdio.assertions.map((a) => [a.library, a.awaited]), [['expect-webdriverio', 'no'], ['expect-webdriverio', 'yes'], ['expect-webdriverio', 'not-needed'], ['expect-webdriverio', 'not-needed']]);
});

test('assertions: guarded by a branch, a loop or a callback that may not run', async () => {
  const t = await checks(`
    expect(a).toBe(1);
    if (a) { expect(a).toBe(2); } else expect(a).toBe(3);
    for (const x of list) expect(x).toBe(4);
    list.forEach((x) => { expect(x).toBe(5); });
    a && expect(a).toBe(6); a ? expect(a).toBe(7) : null;
    try { run(); } catch (e) { expect(e).toBe(8); } finally { expect(a).toBe(9); }
    await test.step('s', async () => { expect(a).toBe(10); });
    await waitFor(() => expect(a).toBe(11)); p.then(() => expect(a).toBe(12)); p.catch(() => expect(a).toBe(13));
    emitter.on('done', () => { expect(a).toBe(14); }); const later = () => { expect(a).toBe(15); };
    function local() { expect(a).toBe(16); }
    if (!a) throw new Error('17'); if (!a) expect.fail('18'); list.forEach((x) => { if (!x) assert.fail('19'); });
    const stub = vi.fn(() => { throw new Error('a mock that throws is not a check'); });`);
  assert.deepEqual(t.assertions.map((a) => `${a.expected?.literal?.value ?? a.matcher}${a.guarded ? ' guarded' : ''}`), [
    '1', '2 guarded', '3 guarded', '4 guarded', '5 guarded', '6 guarded', '7 guarded', '8 guarded', '9', '10', '11', '12', '13 guarded', '14 guarded',
    'throw', 'expect.fail', 'assert.fail guarded',
  ]);
});

test('assertions: unreachable, unfinished, guards and the Cypress and helper cases', async () => {
  const flow = await checks("expect(a).toBe(1); if (a) { return; expect(a).toBe(2); } expect(a).toBe(3); expect.fail('x'); expect(a).toBe(4); cb(() => expect(a).toBe(5));");
  assert.deepEqual(flow.assertions.map((a) => a.reachable), [true, false, true, true, false, false]);
  const open = await checks('expect(a); expect(a).toBe; expect(a).not; await expect(a).resolves; expect(a).to.be; expect(a).to.be.ok; const e = expect(a); wrap(expect(a));');
  assert.deepEqual(open.assertions.map(brief), ['other - incomplete', 'equality toBe incomplete', 'other - not incomplete', 'other - incomplete await:yes', 'other - incomplete', 'truthiness ok']);
  const guards = await checks('expect.assertions(2); expect.hasAssertions();');
  assert.deepEqual([guards.assertions, guards.assertionGuards], [[], { expectedCount: true, hasAssertions: true }]);

  const cypress = await checks(`
    cy.get('a').should('be.visible').and('have.text', 'x').click();
    cy.get('a').should(($a) => { expect($a).to.have.length(1); });
    cy.get('a').each(($a) => { cy.wrap($a).should('not.exist'); });
    cy.contains('in the middle').click(); cy.get('a');
    cy.get('ul').contains('li', 'last');`, { file: 'a.cy.js' });
  assert.deepEqual(cypress.assertions.map((a) => `${a.library}: ${brief(a)}`), [
    'cypress-should: ui-state be.visible', 'cypress-should: ui-state have.text', 'chai: count length', 'cypress-should: ui-state not.exist not guarded', 'cypress: ui-state contains',
  ]);
  assert.deepEqual(cypress.assertions.slice(0, 2).map((a) => [a.actual.text, a.span.startColumn]), [["cy.get('a')", 17], ["cy.get('a')", 38]]);
  assert.equal((await checks("cy.contains('not last'); cy.get('a').click();", { file: 'a.cy.js' })).assertions.length, 0);
});

test('try blocks: what is protected and what the handler does', async () => {
  const t = await checks(`
    try { expect(a).toBe(1); expect(b).toBe(2); } catch (e) { console.log(e); }
    try { expect(a).toBe(1); } catch (e) { throw e; }
    try { run(); } catch (e) { expect.fail('no'); }
    try { run(); } catch (e) { expect(e.code).toBe(1); }
    try { expect(a).toBe(1); } catch (e) { done(e); }
    try { expect(a).toBe(1); } finally { close(); }
    await expect(p).resolves.toBe(1).catch(() => {});
    await page.click('a').catch(console.error);
    await load().then((x) => expect(x).toBe(1)).catch((e) => { throw e; });`);
  assert.deepEqual(t.tryBlocks.map((b) => [b.kind, b.assertionsInside, b.handlerRethrows, b.handlerFails, b.handlerAsserts].join(' ')), [
    'try-catch 2 false false false', 'try-catch 1 true false false', 'try-catch 0 false true false', 'try-catch 0 false false true', 'try-catch 1 false true false',
    'promise-catch 1 false false false', 'promise-catch 0 false false false', 'promise-catch 1 true false false',
  ]);
  assert.ok(t.tryBlocks.every((b) => b.catchesAssertionFailures && b.catches.join() === '*'));
  assert.deepEqual(t.tryBlocks[0].span, { startLine: 4, startColumn: 5, endLine: 4, endColumn: 80 });
});

test('helpers: found in the same file, in the project index and in the config, one level deep', async () => {
  const source = `
    import { expect } from 'vitest';
    function expectPaid(order) { expect(order.paid).toBe(true); }
    const expectOpen = (order) => assert.ok(order.open);
    class OrderPage { async expectTotal(t) { await expect(this.total).toHaveText(t); } open() { return this.page.goto('/'); } check = () => { expectPaid(1); }; }
    const helpers = { mustThrow(fn) { expect(fn).toThrow(); } };
    function wrapper(order) { expectPaid(order); }
    function plain(order) { return order.id; }
    test('t', () => { expectPaid(o); expectOpen(o); orderPage.expectTotal('1'); helpers.mustThrow(f); wrapper(o); plain(o); orderPage.open(); verifyOrder(o); cart.expectCount(1); });`;
  const names = (model) => model.tests[0].assertions.map((a) => a.viaHelper);
  assert.deepEqual(names(await js(source)), ['expectPaid', 'expectOpen', 'expectTotal', 'mustThrow']);
  assert.deepEqual(names(await js(source, 'a.test.ts', { config: { assertionHelpers: ['verifyOrder'] } })).at(-1), 'verifyOrder');

  const ctx = adapterContext();
  const parsed = await jsAdapter.parse({ path: 'tests/pages/cart.ts', absPath: '/virtual/cart.ts', language: 'typescript', project: null, text: "export class Cart { async expectCount(n) { await expect(this.items).toHaveCount(n); } }" }, ctx);
  const helpers = jsAdapter.collectHelpers(parsed);
  assert.deepEqual(helpers, [{ name: 'expectCount', owner: 'Cart', file: 'tests/pages/cart.ts', span: { startLine: 1, startColumn: 21, endLine: 1, endColumn: 86 } }]);
  assert.deepEqual(jsAdapter.collectHelpers({ ...parsed, tree: null }), []);
  const index = createHelperIndex(helpers, ['byHand']);
  assert.deepEqual([index.has('expectCount'), index.has('byHand'), index.has('other'), index.get('expectCount'), index.get('byHand'), index.get('other')], [true, true, false, helpers, [], []]);
  const viaIndex = (await js(source, 'a.test.ts', { helperIndex: index })).tests[0].assertions.at(-1);
  assert.deepEqual([brief(viaIndex), viaIndex.library, viaIndex.actual, viaIndex.text], ['other - via:expectCount', 'helper', null, 'cart.expectCount(1)']);

  // A custom Cypress command that asserts is a helper too.
  const commands = "Cypress.Commands.add('expectUser', (name) => { cy.get('.user').should('have.text', name); });\nCypress.Commands.add('login', () => { cy.get('a').click(); });\nCypress.Commands.add(dynamic, () => { expect(1).to.equal(1); });";
  const support = await jsAdapter.parse({ path: 'cypress/support/commands.js', absPath: '/virtual/commands.js', language: 'javascript', project: null, text: commands }, ctx);
  assert.deepEqual(jsAdapter.collectHelpers(support).map((helper) => [helper.name, helper.owner, helper.span.startLine]), [['expectUser', null, 1]]);
  const withCommand = await checks("cy.login(); cy.get('a').expectUser('Sam').click();", { file: 'a.cy.js', helperIndex: createHelperIndex(jsAdapter.collectHelpers(support)) });
  assert.deepEqual(withCommand.assertions.map(brief), ['other - via:expectUser']);

  // The Playwright fixture has a page object in a support file: its methods count in the spec that calls them.
  const spec = await modelOf('playwright', 'tests/assertions.spec.ts');
  const byHelper = Object.fromEntries(spec.tests.filter((item) => item.suitePath[0] === 'helpers').map((item) => [item.title, item.assertions.map((a) => a.viaHelper)]));
  assert.deepEqual(byHelper, {
    'a helper in this file': ['expectBadge'], 'a page object from a support file': ['expectItemCount', 'expectEmpty'], 'a function from a support file': ['expectLoggedIn'],
    'a helper that only calls another helper is not counted': [], 'no assertion at all': [],
  });
});

test('hooks keep their assertions, and the library follows the imports', async () => {
  const model = await js("const { expect, assert } = require('chai');\nbeforeEach(() => { expect(app.ready).to.equal(true); });\ndescribe('s', () => { afterEach(() => assert.isTrue(app.clean)); it('t', () => { expect(1).toBe(1); assert.ok(1); }); });", 'a.test.js');
  assert.deepEqual([model.fileHooks[0].assertions.map(brief), model.suites[0].hooks[0].assertions.map(brief)], [['equality equal'], ['truthiness isTrue']]);
  assert.deepEqual(model.tests[0].assertions.map((a) => a.library), ['chai', 'chai']);
  const local = await js("import { test, expect } from './fixtures';\ntest('t', async ({ page }) => { expect(page.locator('a')).toBeVisible(); });", 'a.spec.ts', { project: { dir: '.', adapterId: 'js', languages: ['typescript'], frameworks: ['playwright'], evidence: ['package.json'] } });
  assert.deepEqual([local.runner, local.tests[0].assertions[0].library, local.tests[0].assertions[0].awaited], ['playwright', 'playwright', 'no']);
  assert.equal((await checks('assert.isOk(1);', { file: 'a.cy.js' })).assertions[0].library, 'chai');
});
