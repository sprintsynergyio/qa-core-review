// The Python adapter (SPEC.md Sections 9.2 and 17): golden models, framework detection,
// vocabulary coverage, capabilities and robustness. The first half covers the structure of a
// test file: suites, tests, hooks and fixtures, marks, parametrize, imports and suppressions.
// The second half covers what a body checks (assertions, try blocks and helpers) and what it
// does (waits, selectors, requests, mocks and resources), and the lexical fallback.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { CAPABILITIES, PYTHON_VOCAB_SURFACE, builtinRules, createHelperIndex, createRegistry, createTreeSitterService, pythonAdapter, readAsset, resolveConfig, runReview, toLf } from '../../dist/index.js';
import { adapterContext, capabilityFilled, fixtureRoot, frameworkFolders, normalizeProject, normalizeText } from '../helpers/adapter-suite.mjs';
import { BIG_FILES } from '../helpers/big-files.mjs';
import { expectGolden } from '../helpers/golden.mjs';
import { repoRoot, schemaErrors } from '../helpers/schema.mjs';

const FRAMEWORKS = ['playwright-python', 'pytest', 'selenium', 'unittest'];
const models = new Map();
/** Every fixture file of one framework folder, normalized once and kept for the other tests. */
async function modelsOf(framework) {
  if (!models.has(framework)) models.set(framework, await normalizeProject(pythonAdapter, fixtureRoot('adapters', 'python', framework)));
  return models.get(framework);
}
const modelOf = async (framework, file) => (await modelsOf(framework)).find((entry) => entry.file === file).model;
const py = (text, relPath = 'tests/test_a.py', options) => normalizeText(pythonAdapter, relPath, text, options);
const skipOf = (t) => (t.skip ? `${t.skip.unconditional ? 'always' : 'sometimes'}: ${t.skip.reason}` : null);
const casesOf = (t) => t.parameterized && `${t.parameterized.source}:${t.parameterized.cases}`;
const summary = (model) => model.tests.map((t) => [t.fullTitle, t.modifiers.join(' '), skipOf(t), casesOf(t)]);
const hooksOf = (hooks) => hooks.map((hook) => [hook.kind, hook.scope, hook.span.startLine, hook.span.endLine]);

test('there is a fixture folder for each of the four frameworks, and the adapter is registered', () => {
  assert.deepEqual(frameworkFolders('python'), FRAMEWORKS);
  assert.equal(createRegistry().get('python'), pythonAdapter);
  assert.deepEqual(createRegistry().forPath('tests/Test_Cart.PY'), [pythonAdapter]);
  assert.deepEqual([pythonAdapter.grammars, pythonAdapter.commentSyntax, pythonAdapter.tier], [['python'], { line: ['#'] }, 1]);
});

for (const framework of FRAMEWORKS) {
  test(`${framework}: every fixture matches its golden model and the model schema`, async () => {
    const results = await modelsOf(framework);
    assert.ok(results.length > 0);
    for (const { file, model } of results) {
      assert.deepEqual(schemaErrors('model.schema.json', model), [], file);
      expectGolden(model, path.join(fixtureRoot('adapters', 'python', framework), `${file}.model.json`));
      assert.equal(model.role, file.includes('conftest') || file.includes('/helpers/') ? 'support' : 'test', file);
      assert.equal(model.parseStatus, file.includes('broken') ? 'partial' : 'ok', file);
      assert.deepEqual([model.language, model.adapter, model.tier, model.languageHint], ['python', 'python', 1, null], file);
    }
  });
}

test('framework detection is right for every fixture file', async () => {
  const detected = {};
  for (const framework of FRAMEWORKS) {
    for (const { file, source, model } of await modelsOf(framework)) {
      detected[`${framework}/${file}`] = [model.runner, model.libraries, pythonAdapter.detectFrameworks(source, null).confidence];
    }
  }
  assert.deepEqual(detected, {
    'playwright-python/tests/test_async_login.py': ['pytest', ['playwright-python'], 'high'],
    'playwright-python/tests/test_checkout.py': ['pytest', ['playwright-python'], 'high'],
    'playwright-python/tests/test_matchers.py': ['pytest', ['playwright-python'], 'medium'], // it imports Playwright, and pytest is the project's runner
    'playwright-python/tests/test_menu.py': ['pytest', ['playwright-python'], 'medium'], // no import: the project's pytest, and the `page` fixture
    'playwright-python/tests/test_routes.py': ['pytest', ['playwright-python'], 'high'],
    'pytest/tests/conftest.py': ['pytest', [], 'high'],
    'pytest/tests/helpers/pages.py': ['pytest', [], 'medium'], // a support file: the runner of its project
    'pytest/tests/test_assertions.py': ['pytest', [], 'high'],
    'pytest/tests/test_assertpy.py': ['pytest', [], 'medium'],
    'pytest/tests/test_broken.py': ['pytest', [], 'high'],
    'pytest/tests/test_cart.py': ['pytest', [], 'high'],
    'pytest/tests/test_checkout.py': ['pytest', [], 'high'],
    'pytest/tests/test_matcher_libraries.py': ['pytest', [], 'medium'],
    'pytest/tests/test_orders.py': ['pytest', [], 'high'], // `from pytest import fixture, mark`
    'selenium/tests/test_elements.py': ['pytest', ['selenium'], 'medium'], // plain test functions with assert
    'selenium/tests/test_login.py': ['unittest', ['selenium'], 'high'], // a TestCase class, and no pytest in the project
    'selenium/tests/test_search.py': ['pytest', ['selenium'], 'high'], // the file imports pytest itself
    'selenium/tests/test_waits.py': ['unittest', ['selenium'], 'high'],
    'unittest/tests/test_assertions.py': ['unittest', [], 'high'],
    'unittest/tests/test_cart.py': ['unittest', [], 'high'],
    'unittest/tests/test_checkout.py': ['unittest', [], 'high'],
    'unittest/tests/test_orders.py': ['unittest', [], 'high'],
  });
});

test('the detection fixture project: each file gets its runner, its role and its tests', async () => {
  const results = await normalizeProject(pythonAdapter, fixtureRoot('projects', 'python-basic'));
  assert.deepEqual(results.map(({ file, model }) => [file, model.runner, model.libraries, model.role, model.tests.length]), [
    ['tests/conftest.py', 'pytest', [], 'support', 0],
    ['tests/test_cart.py', 'pytest', [], 'test', 2],
    ['tests/test_login_ui.py', 'pytest', ['selenium'], 'test', 1],
  ]);
});

test('detection: the file, then the project, and a config override beats both', async () => {
  const project = (frameworks, evidence = ['pyproject.toml']) => ({ dir: '.', adapterId: 'python', languages: ['python'], frameworks, evidence });
  const guess = async (text, options) => {
    const model = await py(text, 'tests/test_a.py', options);
    return [model.runner, model.libraries];
  };
  const testCase = 'import unittest\n\nclass CartTests(unittest.TestCase):\n    def test_a(self):\n        self.assertTrue(True)\n';
  const plain = 'def test_a():\n    assert total() == 1\n';
  // pytest runs unittest classes too: in a pytest project, unittest is a library of the file.
  assert.deepEqual(await guess(testCase), ['unittest', []]);
  assert.deepEqual(await guess(testCase, { project: project(['unittest']) }), ['unittest', []]);
  assert.deepEqual(await guess(testCase, { project: project(['pytest']) }), ['pytest', ['unittest']]);
  assert.deepEqual(await guess(`import pytest\n${testCase}`), ['pytest', ['unittest']]);
  // A base class that only ends in TestCase, with no import of unittest.
  assert.deepEqual(await guess('from rest_framework.test import APITestCase\n\nclass A(APITestCase):\n    def test_a(self):\n        pass\n'), ['unittest', []]);
  // Plain functions with assert: only pytest runs those, whatever the project says.
  assert.deepEqual(await guess(plain), ['pytest', []]);
  assert.deepEqual(await guess(plain, { project: project(['unittest']) }), ['pytest', []]);
  assert.deepEqual(await guess('def test_a():\n    pass\n', { project: project(['unittest']) }), ['unittest', []]);
  assert.deepEqual(await guess('def test_a():\n    pass\n'), ['unknown', []]);
  assert.deepEqual(await guess('x = pytest.approx(1)\n'), ['pytest', []]);
  // Libraries come from imports. The `page` fixture counts only when the project has Playwright.
  assert.deepEqual(await guess('import playwright.sync_api as pw, selenium\nimport pytest\n'), ['pytest', ['playwright-python', 'selenium']]);
  assert.deepEqual(await guess('def test_a(page):\n    assert page\n', { project: project(['pytest', 'playwright-python']) }), ['pytest', ['playwright-python']]);
  assert.deepEqual(await guess('def test_a(page):\n    assert page\n', { project: project(['pytest']) }), ['pytest', []]);
  // A marker inside a string or a comment is not a use of the framework.
  assert.deepEqual(await guess('# import pytest\nnote = "pytest.skip() and class A(unittest.TestCase):"\n'), ['unknown', []]);
  assert.deepEqual(await guess(plain, { project: project(['unittest', 'selenium'], ['config: projects[0]', 'requirements.txt']) }), ['unittest', []]);
  assert.equal((await py(plain, 'tests/test_a.py', { config: { framework: 'unittest' } })).runner, 'unittest');
});

test('pytest: full titles, marks, skips inside the body and parametrize', async () => {
  const model = await modelOf('pytest', 'tests/test_cart.py');
  assert.deepEqual(summary(model), [
    ['test_new_cart_is_empty', '', null, null],
    ['test_total_grows_with_quantity', '', null, 'parametrize:3'],
    // Two parametrize decorators: 2 times 3 cases.
    ['test_price_exists_in_every_region', '', null, 'parametrize:6'],
    // The cases come from a function call, so their number is not known.
    ['test_every_sku_can_be_added', '', null, 'parametrize:null'],
    ['test_coupon_lowers_the_total', 'skip', 'always: the coupon service is being replaced', null],
    ['test_gift_wrap', 'skip', 'always: null', null],
    ['test_receipt_is_printed', '', 'sometimes: the receipt printer driver is POSIX only', null],
    ['test_total_is_rounded_to_cents', 'xfail', null, null],
    // pytest.skip() under an `if` skips sometimes. On its own it skips always.
    ['test_stock_is_checked', '', 'sometimes: the stock service is down', null],
    ['test_loyalty_points', '', 'always: needs the staging database', null],
    ['test_export_to_spreadsheet', '', 'sometimes: null', null],
    ['test_async_checkout', '', null, null],
    ['test_placeholder', '', null, null],
    ['test_todo_later', '', null, null],
    ['test_remove_item', '', null, null],
    ['TestCartDiscounts > test_welcome_discount', '', null, null],
    ['TestCartDiscounts > test_unknown_coupon_is_rejected', '', null, null],
    ['TestCartDiscounts > TestStacking > test_two_coupons_do_not_stack', '', null, null],
    // parametrize on the class covers each of its tests, times the test's own.
    ['TestCurrencies > test_symbol', '', null, 'parametrize:2'],
    ['TestCurrencies > test_format', '', null, 'parametrize:6'],
    ['TestWishlist > test_add_to_wishlist', '', null, null],
  ]);
  // Suites are classes. A skip or xfail on the class, by decorator or by `pytestmark`, is kept on the suite.
  const suites = (list) => list.map((suite) => [suite.title, suite.modifiers, suite.hooks.map((hook) => hook.kind), suite.testIds.length, suites(suite.suites)]);
  assert.deepEqual(suites(model.suites), [
    ['TestCartDiscounts', [], ['beforeAll', 'afterAll', 'beforeEach', 'afterEach'], 2, [['TestStacking', [], [], 1, []]]],
    ['TestCurrencies', [], [], 2, []],
    ['TestWishlist', ['skip', 'xfail'], [], 1, []],
  ]);
  // A docstring, `pass` and `...` are not statements. A nested function and a comment do not change the count of the body.
  assert.deepEqual(model.tests.filter((t) => ['test_new_cart_is_empty', 'test_placeholder', 'test_todo_later', 'test_remove_item'].includes(t.title)).map((t) => t.statementCount), [3, 0, 0, 5]);
  assert.deepEqual(model.tests.map((t) => t.suitePath).filter((suitePath) => suitePath.length === 2), [['TestCartDiscounts', 'TestStacking']]);
});

test('pytest: module marks, module hooks, helper libraries and tests under an if', async () => {
  const model = await modelOf('pytest', 'tests/test_orders.py');
  assert.deepEqual(summary(model), [
    // `pytestmark = [mark.usefixtures(...), mark.xfail(...)]` covers every test of the module.
    ['test_order_is_created', 'xfail', null, null],
    ['test_order_can_be_refunded', 'skip xfail', 'always: the refund flow moves to another service', null],
    ['test_invalid_order_is_rejected', 'xfail', null, 'parametrize:null'], // pytest-cases: the cases are in another module
    ['test_status_is_known', 'xfail', null, 'parametrize:4'],
    ['test_order_line', 'xfail', null, 'parametrize:2'], // @parameterized([...])
    ['TestOrderNumbers > test_format', '', null, 'parametrize:3'], // @parameterized.expand([...])
    ['test_export_uses_posix_paths', 'xfail', null, null],
    ['test_export_uses_windows_paths', 'xfail', null, null],
  ]);
  assert.deepEqual(model.suites.map((suite) => [suite.title, suite.modifiers]), [['TestOrderNumbers', ['xfail']]]);
  assert.deepEqual(hooksOf(model.fileHooks), [
    ['beforeAll', 'file', 26, 27], ['afterAll', 'file', 30, 31], ['beforeEach', 'file', 34, 35], ['afterEach', 'file', 38, 39],
    // A module fixture, and what runs after its yield. The teardown ends with a comment line and a call.
    ['beforeAll', 'file', 42, 48], ['fixture-teardown', 'file', 46, 48],
    // `with ... as page: yield page`: the with block cleans up, so there is no teardown code.
    ['beforeEach', 'file', 51, 54],
  ]);
});

test('unittest: TestCase classes of any name, their hooks, decorators, subTest loops and skips', async () => {
  const cart = await modelOf('unittest', 'tests/test_cart.py');
  assert.deepEqual(summary(cart), [
    ['CartTests > test_new_cart_is_empty', '', null, null],
    ['CartTests > test_add_item', '', null, null],
    ['CartTests > test_coupon', 'skip', 'always: the coupon service is being replaced', null],
    ['CartTests > test_receipt', '', 'sometimes: the receipt printer driver is POSIX only', null],
    ['CartTests > test_barcode', '', 'sometimes: needs the Linux barcode reader', null],
    ['CartTests > test_rounding', 'xfail', null, null],
    ['CartTests > test_prices_for_every_quantity', '', null, 'loop:4'],
    ['CartTests > test_every_known_sku', '', null, 'loop:null'],
    ['CartTests > test_loyalty_points', '', 'always: needs the staging database', null],
    ['CartTests > test_stock', '', 'sometimes: the stock service is down', null],
    ['CartTests > test_gift_wrap', '', 'always: gift wrap is not released', null],
    ['CheckoutFlow > test_checkout_needs_an_item', '', null, null],
    ['WishlistTests > test_add', '', null, null],
  ]);
  assert.deepEqual(cart.suites.map((suite) => [suite.title, suite.modifiers, suite.hooks.map((hook) => `${hook.kind}:${hook.scope}`), suite.testIds.length]), [
    ['CartTests', [], ['beforeAll:suite', 'afterAll:suite', 'beforeEach:suite', 'afterEach:suite'], 11],
    ['BaseFlow', [], ['beforeEach:suite'], 0],
    ['CheckoutFlow', [], [], 1], // it extends BaseFlow, a TestCase class of the same file
    ['WishlistTests', ['skip'], [], 1],
  ]);
  assert.deepEqual(hooksOf(cart.fileHooks), [['beforeAll', 'file', 8, 9], ['afterAll', 'file', 12, 13]]);

  const orders = await modelOf('unittest', 'tests/test_orders.py');
  assert.deepEqual(summary(orders), [
    ['OrderClientTests > test_order_is_created', '', null, null],
    ['OrderClientTests > test_unknown_sku_is_rejected', '', null, null],
    ['OrderHistory > test_history_starts_empty', '', null, null],
    // `from unittest import skip, expectedFailure`: the bare names are known.
    ['OrderNumbers > test_format', 'skip', 'always: the number format changes in the next release', null],
    ['OrderNumbers > test_numbers_are_unique', 'xfail', null, null],
    ['OrderApiTests > test_list_needs_a_login', '', null, null],
  ]);
  assert.deepEqual(orders.suites.map((suite) => [suite.title, suite.hooks.map((hook) => hook.kind)]), [
    ['OrderClientTests', ['beforeEach', 'afterEach']], ['OrderHistory', []], ['OrderNumbers', []], ['OrderApiTests', []],
  ]);
});

test('fixtures: the fixture is a hook that runs before, and the code after its yield is a teardown hook', async () => {
  const conftest = await modelOf('pytest', 'tests/conftest.py');
  // In conftest.py the fixtures serve every test file, so their scope is global.
  assert.deepEqual(hooksOf(conftest.fileHooks), [
    ['beforeAll', 'global', 8, 13], ['fixture-teardown', 'global', 13, 13], // scope="session"
    ['beforeAll', 'global', 16, 18], // scope="package", with return: nothing runs after
    ['beforeEach', 'global', 21, 28], ['fixture-teardown', 'global', 28, 28], // try: yield / finally: the finally block
    ['beforeEach', 'global', 31, 33],
  ]);
  assert.deepEqual([conftest.role, conftest.tests, conftest.suites], ['support', [], []]);

  const model = await py([
    'import pytest', 'import pytest_asyncio', 'from pytest import fixture as fx', '',
    '@pytest.fixture(scope="class")', 'def a():', '    x = make()', '    if x.ready:', '        yield x', '        x.stop()', '    x.close()', '    log()', '',
    '@pytest_asyncio.fixture(scope="function")', 'async def b():', '    try:', '        with open_db() as db:', '            yield db', '            db.rollback()', '    except Exception:', '        raise', '    finally:', '        cleanup()', '',
    '@fx', 'def c():', '    def inner():', '        yield 1', '    return list(inner())', '',
    '@pytest.fixture()', 'def test_data():', '    return [1, 2]', '',
    'class TestA:', '    @pytest.fixture(autouse=True, scope="module")', '    def d(self):', '        self.x = 1', '        yield', '        self.x = None', '',
    '    def test_a(self, test_data):', '        assert self.x == 1', '',
  ].join('\n'));
  assert.deepEqual(hooksOf(model.fileHooks), [
    // After the yield inside the if: the rest of the if block, then the rest of the function.
    ['beforeAll', 'file', 5, 12], ['fixture-teardown', 'file', 10, 12],
    // After the yield inside with inside try: the rest of the with block, then the finally block.
    ['beforeEach', 'file', 14, 23], ['fixture-teardown', 'file', 19, 23],
    // The yield of a nested generator is not the fixture's.
    ['beforeEach', 'file', 25, 29],
    // A fixture is never a test, whatever its name.
    ['beforeEach', 'file', 31, 33],
  ]);
  assert.deepEqual(hooksOf(model.suites[0].hooks), [['beforeAll', 'suite', 36, 40], ['fixture-teardown', 'suite', 40, 40]]);
  assert.deepEqual(model.tests.map((t) => t.fullTitle), ['TestA > test_a']);
});

test('spans are 1-based and hold the decorators, the body span is the block, and the hash ignores comments and docstrings', async () => {
  const model = await modelOf('pytest', 'tests/test_cart.py');
  const byTitle = (title) => model.tests.find((t) => t.title === title);
  assert.deepEqual([byTitle('test_new_cart_is_empty').span, byTitle('test_new_cart_is_empty').bodySpan], [
    { startLine: 11, startColumn: 1, endLine: 15, endColumn: 33 }, { startLine: 12, startColumn: 5, endLine: 15, endColumn: 33 },
  ]);
  // The span starts at the first decorator.
  assert.deepEqual(byTitle('test_total_grows_with_quantity').span, { startLine: 18, startColumn: 1, endLine: 22, endColumn: 51 });
  assert.deepEqual(model.suites[0].span.startLine, 108);
  assert.deepEqual(model.suites[2].span.startLine, 156); // the @pytest.mark.skip above the class

  const hash = async (body) => (await py(`def test_a():\n${body}`)).tests[0].bodyHash;
  const base = await hash('    cart = Cart()\n    assert cart.total() == 0\n');
  assert.match(base, /^[0-9a-f]{40}$/);
  assert.equal(await hash('    """A docstring."""\n    cart = Cart()  # a comment\n\n    # another\n    assert cart.total()   ==   0\n'), base);
  assert.notEqual(await hash('    cart = Cart()\n    assert cart.total() == 1\n'), base);
  // A string that is not the docstring is part of the body.
  assert.notEqual(await hash('    cart = Cart()\n    """not a docstring"""\n    assert cart.total() == 0\n'), base);
  // Indentation is the only difference between these two bodies, and it changes what they do.
  assert.notEqual(await hash('    if a:\n        b()\n    c()\n'), await hash('    if a:\n        b()\n        c()\n'));
  assert.equal(await hash('    if a:\n        b()\n    c()\n'), await hash('    if a:\n            b()\n    c()\n'));
});

test('two tests with the same full title get different ids, and imports and suppressions are read', async () => {
  const twice = await py('def test_a():\n    assert one()\n\ndef test_a():\n    assert two()\n\nclass TestA:\n    def test_a(self):\n        pass\n');
  assert.deepEqual(twice.tests.map((t) => t.fullTitle), ['test_a', 'test_a', 'TestA > test_a']);
  assert.equal(new Set(twice.tests.map((t) => t.id)).size, 3);

  const model = await modelOf('pytest', 'tests/test_orders.py');
  assert.deepEqual(model.imports.map((entry) => [entry.source, entry.names, entry.typeOnly, entry.framework, entry.span.startLine]), [
    ['sys', ['*'], false, false, 3],
    ['typing', ['*'], false, false, 4],
    ['pytest_cases', ['*'], false, true, 6],
    ['parameterized', ['parameterized'], false, true, 7],
    ['pytest', ['fixture', 'mark'], false, true, 8],
    ['.', ['conftest'], false, false, 10],
    ['.helpers.pages', ['CartPage'], false, false, 11],
    ['shop.orders', ['Order'], true, false, 14], // under `if typing.TYPE_CHECKING:`
    ['orjson', ['*'], false, false, 17], // under try
    ['json', ['*'], false, false, 19], // under except
  ]);
  // The whole-file comment is the first line. The next-line comment sits inside a fixture.
  assert.deepEqual(model.suppressions.map((s) => [s.scope, s.rules, s.reason, s.span.startLine]), [
    ['file', ['QCR-S001'], 'the order API has no page, so no selector rule applies', 1],
    ['next-line', ['QCR-W001'], 'the delete is asynchronous on the server', 47],
  ]);

  const forms = await py([
    '"""Docstring."""', '# qa-core-review-disable QCR-A001 -- after the docstring is still the top of the file', 'import os, sys as system, playwright.sync_api as pw', 'from typing import TYPE_CHECKING',
    'from ..pages.login import *', 'from selenium.webdriver.common.by import (', '    By,  # the locator strategies', '    Keys as K,', ')', 'if TYPE_CHECKING:', '    import decimal', 'else:', '    import fractions',
    '# qa-core-review-disable QCR-W001 -- too late: this is after the first statement', 'def helper():', '    import late', '',
  ].join('\n'), 'tests/test_forms.py');
  assert.deepEqual(forms.imports.map((entry) => [entry.source, entry.names, entry.typeOnly, entry.framework]), [
    ['os', ['*'], false, false], ['sys', ['*'], false, false], ['playwright.sync_api', ['*'], false, true], ['typing', ['TYPE_CHECKING'], false, false],
    ['..pages.login', ['*'], false, false], ['selenium.webdriver.common.by', ['By', 'Keys'], false, true],
    ['decimal', ['*'], true, false], ['fractions', ['*'], false, false], // only the if branch is type-only
  ]);
  assert.deepEqual(forms.suppressions.map((s) => [s.scope, s.rules]), [['file', ['QCR-A001']]]);
});

test('names are followed through imports: aliases of modules and of single names', async () => {
  const model = await py([
    'import pytest as pt', 'import unittest as ut', 'from pytest import mark as m, skip as bail, param', 'from unittest import TestCase as Base, skipIf', 'from parameterized import parameterized as cases', '',
    '@pt.mark.skip(reason="a")', 'def test_a():', '    pass', '',
    '@m.skipif(True, reason="b")', '@m.parametrize("n", (1, 2))', 'def test_b(n):', '    pass', '',
    'def test_c():', '    bail("c")', '',
    'class Cart(Base):', '    @skipIf(True, "d")', '    def test_d(self):', '        pass', '',
    '    @cases.expand([(1,), (2,), (3,)])', '    def test_e(self, n):', '        raise ut.SkipTest', '',
    'class Other(ut.TestCase):', '    pytestmark = pt.mark.skip', '    def test_f(self):', '        pass', '',
    '@pt.mark.parametrize(argnames="n", argvalues=[1, 2, 3, 4])', 'def test_g(n):', '    pass', '',
  ].join('\n'));
  assert.deepEqual(summary(model), [
    ['test_a', 'skip', 'always: a', null], ['test_b', '', 'sometimes: b', 'parametrize:2'], ['test_c', '', 'always: c', null],
    ['Cart > test_d', '', 'sometimes: d', null], ['Cart > test_e', '', 'always: null', 'parametrize:3'], ['Other > test_f', '', null, null], ['test_g', '', null, 'parametrize:4'],
  ]);
  assert.deepEqual(model.suites.map((suite) => [suite.title, suite.modifiers]), [['Cart', []], ['Other', ['skip']]]);
});

test('skip reasons: plain, raw, joined and f-strings, and escapes are decoded', async () => {
  const reason = async (literal) => (await py(`import pytest\n\n@pytest.mark.skip(reason=${literal})\ndef test_a():\n    pass\n`)).tests[0].skip.reason;
  assert.equal(await reason('"plain"'), 'plain');
  assert.equal(await reason("'it''s ' \"joined\""), 'its joined');
  assert.equal(await reason('"tab\\there \\u20ac \\x41 \\U0001F6D2 \\\\ \\" \\q"'), `tab\there \u20ac A ${String.fromCodePoint(0x1f6d2)} \\ " \\q`);
  assert.equal(await reason('r"C:\\new\\table"'), 'C:\\new\\table');
  assert.equal(await reason('"""three\nlines"""'), 'three\nlines');
  assert.equal(await reason('f"bug {ticket} is open"'), 'bug {ticket} is open');
  assert.equal(await reason('"line one \\\ncontinued"'), 'line one continued');
  // A reason that is not a string literal is not known.
  assert.equal(await reason('REASON'), null);
  assert.equal(await reason('"a" + suffix'), null);
});

test('only real declarations are tests: no false positives from look-alike code', async () => {
  const model = await py([
    'import pytest', '', 'test_data = [1, 2, 3]', 'testing = lambda: 1', '',
    'def helper_test():', '    assert True', '', 'def tester():', '    def test_inner():', '        assert True', '    return test_inner', '',
    'class Cart:', '    def test_method_of_a_plain_class(self):', '        assert True', '',
    'class CartPage(BasePage):', '    def test_connection(self):', '        return True', '',
    'class TestReal:', '    test_attribute = 1', '    def setup(self):', '        pass', '    def not_a_test(self):', '        pass', '    def test_real(self):', '        assert True',
    '    class Helper:', '        def test_in_a_nested_plain_class(self):', '            pass', '',
    'def setUp():', '    pass', '', 'def test_real_function():', '    assert True', '',
  ].join('\n'));
  // `tester` is a test: pytest collects every function whose name starts with "test", with or without the underscore.
  assert.deepEqual(model.tests.map((t) => t.fullTitle), ['tester', 'TestReal > test_real', 'test_real_function']);
  // `setUp` at module level and `setup` in a class are not hook names.
  assert.deepEqual([model.fileHooks, model.suites.map((suite) => [suite.title, suite.hooks, suite.suites])], [[], [['TestReal', [], []]]]);
  // Marks that do not change how a test runs are ignored, and so is a skip inside a nested function.
  const marks = await py('import pytest\n\n@pytest.mark.slow\n@pytest.mark.usefixtures("db")\n@custom\n@pytest.mark.parametrize\ndef test_a():\n    def later():\n        pytest.skip("no")\n    register(later)\n');
  assert.deepEqual(summary(marks), [['test_a', '', null, 'parametrize:null']]);
});

test('every vocabulary entry appears in at least one fixture', () => {
  const sources = [];
  for (const framework of FRAMEWORKS) {
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
      if (entry.isDirectory()) walk(path.join(dir, entry.name));
      else if (entry.name.endsWith('.py')) sources.push(fs.readFileSync(path.join(dir, entry.name), 'utf8'));
    });
    walk(fixtureRoot('adapters', 'python', framework));
  }
  const all = sources.join('\n');
  // An entry that starts or ends with a letter must not be part of a longer word: `Mock(` is not found in `MagicMock(`.
  const missing = PYTHON_VOCAB_SURFACE.filter((entry) => !new RegExp(`${/^\w/.test(entry) ? '(?<![\\w])' : ''}${entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${/\w$/.test(entry) ? '(?![\\w])' : ''}`).test(all));
  assert.deepEqual(missing, []);
  assert.equal(new Set(PYTHON_VOCAB_SURFACE).size, PYTHON_VOCAB_SURFACE.length);
  assert.ok(PYTHON_VOCAB_SURFACE.length >= 370, String(PYTHON_VOCAB_SURFACE.length));
});

test('every capability the adapter declares is filled in at least one golden', async () => {
  const all = [];
  for (const framework of FRAMEWORKS) all.push(...(await modelsOf(framework)).map((entry) => entry.model));
  // Every capability of the model, as for JS/TS.
  assert.deepEqual([...pythonAdapter.capabilities].sort(), [...CAPABILITIES].sort());
  for (const capability of pythonAdapter.capabilities) {
    assert.ok(all.some((model) => capabilityFilled(capability, model)), `no golden fills "${capability}"`);
    assert.ok(all.every((model) => model.capabilities.includes(capability)));
  }
});

test('robustness: a syntax error keeps the tests around it, and the file is marked partial', async () => {
  const model = await modelOf('pytest', 'tests/test_broken.py');
  assert.equal(model.parseStatus, 'partial');
  assert.deepEqual(model.tests.map((t) => t.title), ['test_before', 'test_broken', 'test_after']);
  const mixed = await py('def test_a():\n    assert 1\n\nclass TestB:\n  def test_b(self):\n        x = (\n\n    def test_c(self):\n      assert 3\n\tdef test_tab(self):\n\t\tpass\n');
  assert.deepEqual(schemaErrors('model.schema.json', mixed), []);
  assert.ok(mixed.tests.some((t) => t.title === 'test_a'));
});

test('robustness: an empty file, a file with no tests, and a file that is not code', async () => {
  const empty = await py('');
  // A file named like a test file keeps the role 'test' with no test in it, so the review can say that none was found.
  assert.deepEqual([empty.role, empty.parseStatus, empty.tests.length, empty.runner], ['test', 'ok', 0, 'unknown']);
  assert.equal((await py('', 'tests/cart_test.py')).role, 'test');
  assert.equal((await py('', 'tests/helpers/util.py')).role, 'support');
  assert.equal((await py('', 'tests/__init__.py')).role, 'support');
  assert.equal((await py('def login(page):\n    page.goto("/")\n', 'tests/helpers/login.py')).role, 'support');
  // conftest.py is a support file even with a test function in it. A file with tests is a test file whatever its name.
  assert.equal((await py('def test_a():\n    assert True\n', 'tests/conftest.py')).role, 'support');
  assert.equal((await py('def test_a():\n    assert True\n', 'checks/smoke.py')).role, 'test');
  const garbage = await py('<<<<<<< HEAD\n}}}} ))) ((( === @@@ ### \n>>>>>>> branch\n ]]] {{{ ;;; ??? \n');
  assert.deepEqual([garbage.parseStatus, garbage.capabilities, garbage.tests, garbage.role], ['failed', [], [], 'test']);
  assert.deepEqual(schemaErrors('model.schema.json', garbage), []);
  for (const text of ['def', 'class', '@', 'def test_a(', '@pytest.mark.skip\n', 'class TestA:\n', 'pytestmark =', 'import', 'from . import', 'def test_a():\n    yield', '@pytest.fixture\ndef f():\n    yield\n']) {
    assert.deepEqual(schemaErrors('model.schema.json', await py(text)), [], text);
  }
});

test('robustness: with a missing grammar the lexical scanner still finds tests, skips, assertions and fixed sleeps', async () => {
  const parser = createTreeSitterService({ readAsset: (name) => (name.endsWith('python.wasm') ? (() => { throw new Error('gone'); })() : readAsset(name)) });
  const model = await py([
    '# qa-core-review-disable QCR-W001 -- the scanner reads comments too', 'import pytest', '', 'def helper():', '    def test_nested():', '        assert False', '',
    '@pytest.mark.skip(reason="later")', 'def test_skipped():', '    assert total() == 1', '', '@pytest.mark.skipif(True, reason="x")', '@pytest.mark.xfail', 'async def test_sleeps(page):',
    '    """A docstring with assert in it."""', '    time.sleep(2.5)', '    await asyncio.sleep(1)', '    page.wait_for_timeout(300)', '    time.sleep(DELAY)', '    note = "assert nothing, time.sleep(9)"  # assert in a comment', '', '    expect(page).to_have_title("x")', '',
    'class CartPage:', '    def test_connection(self):', '        assert True', '', 'class TestCart(Base):', '    def test_empty(self):', '        pass', '', '    @unittest.skip("no")', '    def test_total(self):', '        self.assertEqual(1, 1)',
    '        with pytest.raises(ValueError):', '            go()', '        send.assert_called_once()', '', 'class OrderTests(unittest.TestCase):', '  def test_two_spaces(self):', '    pytest.fail("x")', '',
  ].join('\n'), 'tests/test_a.py', { parser });
  assert.deepEqual([model.parseStatus, model.capabilities, model.role, model.runner], ['partial', ['tests', 'modifiers', 'assertions', 'waits'], 'test', 'pytest']);
  assert.deepEqual(model.tests.map((t) => [t.fullTitle, t.modifiers, t.skip?.unconditional ?? null, t.span.startLine, t.span.endLine, t.statementCount, t.assertions.map((a) => a.span.startLine), t.waits.map((w) => [w.span.startLine, w.ms])]), [
    // The span starts at the first decorator. Only an unconditional skip is read.
    ['test_skipped', ['skip'], true, 8, 10, 1, [10], []],
    // time.sleep takes seconds, wait_for_timeout milliseconds. Strings and comments are not searched.
    ['test_sleeps', ['xfail'], null, 12, 22, 6, [22], [[16, 2500], [17, 1000], [18, 300], [19, null]]],
    // A method of a class that is no test class is no test. Neither is a function inside a function.
    ['TestCart > test_empty', [], null, 29, 30, 0, [], []],
    ['TestCart > test_total', ['skip'], true, 32, 37, 4, [34, 35, 37], []],
    ['OrderTests > test_two_spaces', [], null, 40, 41, 1, [41], []],
  ]);
  assert.deepEqual([model.tests[0].assertions[0], model.suppressions.map((s) => s.rules), model.suites, model.imports], [
    { span: { startLine: 10, startColumn: 5, endLine: 10, endColumn: 24 }, text: 'assert total() == 1', kind: 'other', library: 'unknown', actual: null, expected: null, matcher: null, negated: false, soft: false, complete: true, awaited: 'not-needed', guarded: false, reachable: true, viaHelper: null },
    [['QCR-W001']], [], [],
  ]);
  // CRLF line ends and a byte order mark are taken out when a file is read (toLf), so they change nothing here either.
  const crlf = await py(toLf(`${String.fromCharCode(0xfeff)}def test_a():\r\n    time.sleep(1)\r\n    assert 1\r\n`), 'tests/test_a.py', { parser });
  assert.deepEqual([crlf.tests.map((t) => t.title), crlf.tests[0].waits.map((w) => w.ms), crlf.tests[0].assertions.map((a) => [a.text, a.span.startLine, a.span.endColumn])], [['test_a'], [1000], [['assert 1', 3, 13]]]);
  // With no test found the scanner has nothing to offer, and the file stays failed. conftest.py stays a support file.
  const none = await py('x = 1\n', 'tests/test_b.py', { parser });
  assert.deepEqual([none.parseStatus, none.capabilities, none.role, none.tests], ['failed', [], 'test', []]);
  assert.deepEqual((({ role, parseStatus, tests }) => [role, parseStatus, tests.length])(await py('def test_a():\n    assert 1\n', 'tests/conftest.py', { parser })), ['support', 'partial', 1]);
  assert.deepEqual(schemaErrors('model.schema.json', model), []);
  assert.equal((await pythonAdapter.parse({ path: 'a.py', absPath: '/a.py', language: 'python', project: null, text: 'x' }, { ...adapterContext(), parser })).tree, null);
});

test('robustness: CRLF, a byte order mark and non-ASCII names', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcr-py-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const text = `class TestCaf${String.fromCharCode(0xe9)}:\n    def test_a${String.fromCharCode(0xf1)}ade_art${String.fromCharCode(0xed)}culo(self):\n        """A${String.fromCharCode(0xf1)}ade."""\n        assert total == "${String.fromCodePoint(0x1f6d2)}"\n`;
  fs.writeFileSync(path.join(dir, 'test_lf.py'), text);
  fs.writeFileSync(path.join(dir, 'test_crlf.py'), String.fromCharCode(0xfeff) + text.replace(/\n/g, '\r\n'));
  const [crlf, lf] = await normalizeProject(pythonAdapter, dir);
  assert.deepEqual([crlf.file, lf.file], ['test_crlf.py', 'test_lf.py']);
  assert.deepEqual({ ...crlf.model, path: '', tests: crlf.model.tests.map((x) => ({ ...x, id: '' })), suites: [] }, { ...lf.model, path: '', tests: lf.model.tests.map((x) => ({ ...x, id: '' })), suites: [] });
  assert.equal(lf.model.tests[0].fullTitle, `TestCaf${String.fromCharCode(0xe9)} > test_a${String.fromCharCode(0xf1)}ade_art${String.fromCharCode(0xed)}culo`);
  assert.deepEqual([lf.model.tests[0].span, lf.model.tests[0].statementCount], [{ startLine: 2, startColumn: 5, endLine: 4, endColumn: 29 }, 1]);
});

test('robustness: a 1,000-line file is normalized in under 2 seconds from a cold start', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcr-py-timing-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, BIG_FILES.python.name);
  fs.writeFileSync(file, BIG_FILES.python.text);
  assert.ok(BIG_FILES.python.text.split('\n').length >= 1000);
  const helper = path.join(repoRoot, 'tests', 'helpers', 'normalize-once.mjs');
  const runs = [1, 2].map(() => JSON.parse(spawnSync(process.execPath, [helper, 'python', file], { encoding: 'utf8', windowsHide: true, shell: false }).stdout));
  t.diagnostic(`python: ${runs.map((run) => `${Math.round(run.ms)} ms`).join(', ')}`);
  assert.deepEqual([runs[0].tests, runs[0].parseStatus], [200, 'ok']);
  assert.ok(Math.min(...runs.map((run) => run.ms)) < 2000);
});

test('robustness: broken copies of every fixture are normalized without an error', async () => {
  let seed = 11;
  const next = (limit) => (seed = (seed * 1103515245 + 12345) % 2147483648) % limit;
  for (const framework of FRAMEWORKS) {
    for (const { file, source } of await modelsOf(framework)) {
      for (let round = 0; round < 12; round += 1) {
        const at = next(source.text.length);
        const broken = [source.text.slice(0, at), source.text.slice(0, at) + source.text.slice(at + 1 + next(10)), `${source.text.slice(0, at)}${'([{:)]}"\'@\n\t'[next(12)]}${source.text.slice(at)}`][round % 3];
        const model = await py(broken, file);
        assert.deepEqual(schemaErrors('model.schema.json', model), [], `${file} cut at ${at}`);
      }
    }
  }
});

test('classifyFile tells test files from support files without parsing', () => {
  const classify = (relPath, text) => pythonAdapter.classifyFile({ path: relPath, absPath: relPath, text, language: 'python', project: null });
  assert.equal(classify('tests/test_a.py', 'def test_a():\n    pass\n'), 'test');
  assert.equal(classify('tests/test_a.py', 'class TestCart:\n    async def test_a(self):\n        pass\n'), 'test');
  assert.equal(classify('tests/checks.py', 'class Cart(unittest.TestCase):\n    pass\n'), 'test');
  assert.equal(classify('tests/helpers/login.py', 'def login(page):\n    page.goto("/")\n'), 'support');
  assert.equal(classify('tests/helpers/notes.py', '# def test_a(): is how tests start\nnote = """\ndef test_b():\n"""\n'), 'support');
  assert.equal(classify('tests/conftest.py', 'def test_a():\n    pass\n'), 'support');
  assert.equal(classify('tests/__init__.py', ''), 'support');
});

// What a body checks.

const HEADER = 'import pytest\nimport unittest\nfrom unittest import mock\nfrom unittest.mock import MagicMock, Mock, patch\n';
/** The model of one test function with this body. `header` holds the imports, `params` the parameters. */
const testWith = async (lines, { header = HEADER, params = 'cart, response', relPath, ...options } = {}) =>
  (await py(`${header}\n\ndef test_a(${params}):\n${lines.map((line) => `    ${line}`).join('\n')}\n`, relPath, options)).tests[0];
const operandOf = (expr) => (expr ? `${expr.text} <${[expr.kind, expr.literal?.type, expr.isLocator && 'locator', expr.isCount && 'count', expr.isMock && 'mock'].filter(Boolean).join(' ')}>` : null);
/** One row for each assertion: kind, library, matcher, then the flags that are not the default. */
const rows = (t) => t.assertions.map((a) => [a.kind, a.library, a.matcher, ...[a.negated && 'not', !a.complete && 'incomplete', a.guarded && 'guarded', !a.reachable && 'unreachable', a.soft && 'soft',
  a.awaited !== 'not-needed' && `awaited:${a.awaited}`, a.viaHelper && `via:${a.viaHelper}`, a.operator, a.statusCodes && `codes:${a.statusCodes.join(',')}`].filter(Boolean)]);
const operands = (t) => t.assertions.map((a) => [operandOf(a.actual), operandOf(a.expected)]);

test('assert statements: the kind comes from the expression, and the value under test is the actual side', async () => {
  const t = await testWith([
    'assert cart.total() == 42', 'assert 42 == cart.total()', 'assert cart.total() != 0, "a message"', 'assert cart.owner is None', 'assert cart.id is not None', 'assert cart is other',
    'assert "backpack" in cart.items', 'assert sku not in cart.items', 'assert response.status_code in (200, 201)', 'assert cart.total() > 0', 'assert 0 < cart.total() <= 500', 'assert 10 >= len(cart.items)',
    'assert cart.items', 'assert not cart.locked', 'assert not (cart.total() == 1)', 'assert isinstance(cart, Cart)', 'assert not issubclass(Cart, dict)', 'assert cart.is_open and cart.items',
    'assert all(item.price > 0 for item in cart.items)', 'assert (cart.total(), 42)', 'assert (cart.total() == 42)', 'assert cart.total() == snapshot', 'assert snapshot(name="a") == cart.total()',
    'assert response.status_code == 200', 'assert 404 == response.status', 'assert send.called', 'assert send.call_count == 2', 'assert -1 == 1.5', 'assert [] == {}', 'assert f"{cart}" == "x" "y"',
  ], { params: 'cart, response, other, sku, snapshot, send' });
  assert.deepEqual(rows(t), [
    ['equality', 'pytest-assert', '=='], ['equality', 'pytest-assert', '=='], ['equality', 'pytest-assert', '!=', 'not'], ['nullness', 'pytest-assert', 'is'], ['nullness', 'pytest-assert', 'is not', 'not'],
    ['equality', 'pytest-assert', 'is'],
    ['contains', 'pytest-assert', 'in'], ['contains', 'pytest-assert', 'not in', 'not'], ['status', 'pytest-assert', 'in', 'codes:200,201'], ['comparison', 'pytest-assert', '>', '>'],
    // `0 < x`: the value under test is x, so the operator is turned around.
    ['comparison', 'pytest-assert', '<', '>'], ['comparison', 'pytest-assert', '>=', '<='],
    ['truthiness', 'pytest-assert', 'assert'], ['truthiness', 'pytest-assert', 'assert', 'not'], ['equality', 'pytest-assert', '==', 'not'], ['type', 'pytest-assert', 'isinstance'],
    ['type', 'pytest-assert', 'issubclass', 'not'], ['truthiness', 'pytest-assert', 'assert'],
    ['truthiness', 'pytest-assert', 'assert'], ['truthiness', 'pytest-assert', 'assert'], ['equality', 'pytest-assert', '=='], ['snapshot', 'pytest-assert', '=='], ['snapshot', 'pytest-assert', '=='],
    ['status', 'pytest-assert', '==', 'codes:200'], ['status', 'pytest-assert', '==', 'codes:404'], ['mock-call', 'pytest-assert', 'assert'], ['mock-call', 'pytest-assert', '=='],
    ['equality', 'pytest-assert', '=='], ['equality', 'pytest-assert', '=='], ['equality', 'pytest-assert', '=='],
  ]);
  const sides = operands(t);
  assert.deepEqual([sides[0], sides[1], sides[3], sides[6], sides[7], sides[8], sides[10], sides[11]], [
    ['cart.total() <call>', '42 <literal number>'], ['cart.total() <call>', '42 <literal number>'], ['cart.owner <member>', null],
    // `x in items` checks the items. `status in (200, 201)` checks the status.
    ['cart.items <member>', '"backpack" <literal string>'], ['cart.items <member>', 'sku <identifier>'], ['response.status_code <member>', '(200, 201) <collection>'],
    ['cart.total() <call>', '0 <literal number>'], ['len(cart.items) <call count>', '10 <literal number>'],
  ]);
  // A tuple is always true: the model keeps it as a collection with items, which QCR-A003 reads. Parentheses around one value are not a tuple.
  assert.deepEqual([sides[19], sides[20]], [['(cart.total(), 42) <collection>', null], ['cart.total() <call>', '42 <literal number>']]);
  assert.deepEqual([sides[25], sides[26], sides[27], sides[28], sides[29]], [
    ['send.called <member>', null], ['send.call_count <member count>', '2 <literal number>'], ['-1 <literal number>', '1.5 <literal number>'],
    ['[] <literal empty-collection>', '{} <literal empty-collection>'], ['f"{cart}" <other>', '"x" "y" <literal string>'],
  ]);
  assert.deepEqual([t.assertions[0].text, t.assertions[0].span, t.assertions[0].actual.normalized, t.assertions[2].text], [
    'assert cart.total() == 42', { startLine: 8, startColumn: 5, endLine: 8, endColumn: 30 }, 'cart.total()', 'assert cart.total() != 0, "a message"',
  ]);
  assert.deepEqual([t.expectsException, t.tryBlocks], [false, []]);
});

test('unittest: self.assert* methods, with the operands in the right order', async () => {
  const t = await testWith([
    'self.assertEqual(self.cart.total(), 42)', 'self.assertIn("backpack", self.cart.items)', 'self.assertNotIn(sku, self.cart.items)', 'self.assertGreaterEqual(len(self.cart.items), 0)',
    'self.assertTrue(self.cart.is_open)', 'self.assertTrue(self.cart.is_open, "open")', 'self.assertTrue(self.cart.is_open, msg="open")', 'self.assertTrue(self.cart.total(), 42)',
    'self.assertFalse(self.cart.total(), f"total {x}")', 'self.assertEqual(response.status_code, 200)', 'self.assertEqual(201, response.status_code)', 'self.assertContains(response, "backpack")',
    'self.assertRaises(ValueError, self.cart.add, None)', 'self.assertRaises(ValueError)', 'self.assertion_count', 'self.assert_valid(self.cart)', 'other.assertEqual(1, 2)', 'self.fail("never")',
  ], { params: 'self, response, sku, other, x' });
  assert.deepEqual(rows(t), [
    ['equality', 'unittest', 'assertEqual'], ['contains', 'unittest', 'assertIn'], ['contains', 'unittest', 'assertNotIn', 'not'], ['comparison', 'unittest', 'assertGreaterEqual', '>='],
    ['truthiness', 'unittest', 'assertTrue'], ['truthiness', 'unittest', 'assertTrue'], ['truthiness', 'unittest', 'assertTrue'], ['truthiness', 'unittest', 'assertTrue'],
    ['truthiness', 'unittest', 'assertFalse', 'not'], ['status', 'unittest', 'assertEqual', 'codes:200'], ['status', 'unittest', 'assertEqual', 'codes:201'],
    // Any other self.assert* method is a check: Django's assertContains.
    ['other', 'unittest', 'assertContains'],
    ['throws', 'unittest', 'assertRaises'], ['throws', 'unittest', 'assertRaises', 'incomplete'], ['other', 'unittest', 'assert_valid'], ['fail-call', 'unittest', 'self.fail'],
  ]);
  const sides = operands(t);
  assert.deepEqual([sides[1], sides[3], sides[12]], [
    ['self.cart.items <member>', '"backpack" <literal string>'], ['len(self.cart.items) <call count>', '0 <literal number>'], [null, 'ValueError <identifier>'],
  ]);
  // A second argument of assertTrue that is not a message is kept as `expected`: `self.assertTrue(a, b)` checks only `a`. A string, an f-string and `msg=` are messages.
  assert.deepEqual([sides[4][1], sides[5][1], sides[6][1], sides[7][1], sides[8][1]], [null, null, null, '42 <literal number>', null]);
  assert.equal(t.expectsException, true);
});

test('pytest: raises, warns and fail, and a raise in the flow of the test', async () => {
  const t = await testWith([
    'with pytest.raises(ValueError):', '    cart.add(None)', 'with pytest.raises(KeyError) as error, open("f") as handle:', '    cart.remove("x")', 'pytest.raises(TypeError, cart.add, 1, 2)', 'pytest.raises(ValueError)',
    'error = pytest.raises(ValueError)', 'with pytest.warns(UserWarning):', '    cart.legacy()', 'pytest.fail("never")', 'pytest.approx(1.0)', 'pytest.param(1)',
    'if cart.locked:', '    raise RuntimeError("locked")', 'callback = lambda: pytest.fail("in a callback")', 'raise unittest.SkipTest("later")',
  ]);
  assert.deepEqual(rows(t), [
    ['throws', 'pytest', 'pytest.raises'], ['throws', 'pytest', 'pytest.raises'], ['throws', 'pytest', 'pytest.raises'],
    // As a bare statement with no function to call, pytest.raises does nothing.
    ['throws', 'pytest', 'pytest.raises', 'incomplete'], ['throws', 'pytest', 'pytest.raises'], ['throws', 'pytest', 'pytest.warns'],
    ['fail-call', 'pytest', 'pytest.fail'],
    // A raise in the test's own flow fails the test. `if broken: raise` is a check in itself, so it is not guarded. A raised skip is no check.
    ['fail-call', 'raise', 'raise', 'unreachable'], ['fail-call', 'pytest', 'pytest.fail', 'guarded', 'unreachable'],
  ]);
  assert.deepEqual(t.assertions.slice(0, 3).map((a) => operandOf(a.expected)), ['ValueError <identifier>', 'KeyError <identifier>', 'TypeError <identifier>']);
  assert.equal(t.expectsException, true);
  const through = await py('from pytest import raises, fail\nimport pytest as pt\n\ndef test_a():\n    with raises(ValueError):\n        go()\n    pt.fail("x")\n    fail("y")\n');
  assert.deepEqual(rows(through.tests[0]), [['throws', 'pytest', 'pytest.raises'], ['fail-call', 'pytest', 'pytest.fail'], ['fail-call', 'pytest', 'pytest.fail', 'unreachable']]);
});

test('Playwright: expect is awaited in the async API, not needed in the sync API, and unfinished without a matcher', async () => {
  const body = ['expect(page.locator("#a")).to_be_visible()', 'await expect(page.locator("#a")).to_have_text("x")', 'expect(page.locator("#a")).not_to_be_hidden()', 'expect(page).to_have_title("x")',
    'expect(page.locator("li")).to_have_count(3)', 'expect(response).to_be_ok()', 'expect(page.locator("#a")).to_be_fancy()', 'expect(page.locator("#a"))', 'expect(page.locator("#a")).to_be_visible',
    'later = expect(page.locator("#a"))', 'await asyncio.gather(expect(page.locator("#a")).to_be_visible(), expect(page.locator("#b")).to_be_hidden())'];
  const kinds = ['ui-state', 'ui-state', 'ui-state', 'ui-state', 'count', 'status', 'other', 'other', 'ui-state', 'ui-state', 'ui-state'];
  const flags = (t) => t.assertions.map((a) => [a.awaited, a.negated, a.complete]);
  const sync = await testWith(body, { header: 'from playwright.sync_api import expect', params: 'page, response' });
  assert.deepEqual([sync.assertions.map((a) => a.kind), sync.assertions.map((a) => a.library)], [kinds, kinds.map(() => 'playwright')]);
  assert.deepEqual(sync.assertions.map((a) => a.matcher), ['to_be_visible', 'to_have_text', 'not_to_be_hidden', 'to_have_title', 'to_have_count', 'to_be_ok', 'to_be_fancy', null, 'to_be_visible', 'to_be_visible', 'to_be_hidden']);
  assert.deepEqual(flags(sync), [
    ['not-needed', false, true], ['not-needed', false, true], ['not-needed', true, true], ['not-needed', false, true], ['not-needed', false, true], ['not-needed', false, true], ['not-needed', false, true],
    // `expect(x)` with no matcher, and a matcher that is named and not called. `later = expect(x)` may be finished later, so it is not reported.
    ['not-needed', false, false], ['not-needed', false, false], ['not-needed', false, true], ['not-needed', false, true],
  ]);
  assert.deepEqual(operands(sync).slice(0, 2), [['page.locator("#a") <call locator>', null], ['page.locator("#a") <call locator>', '"x" <literal string>']]);

  const asyncApi = await py(`from playwright.async_api import expect\n\nasync def test_a(page, response):\n${body.map((line) => `    ${line}`).join('\n')}\n`);
  assert.deepEqual(asyncApi.tests[0].assertions.map((a) => a.awaited), ['no', 'yes', 'no', 'no', 'no', 'no', 'no', 'no', 'no', 'yes', 'yes']);
  // With no import of either API (the `page` fixture of pytest-playwright), an `async def` test has to await.
  const project = { dir: '.', adapterId: 'python', languages: ['python'], frameworks: ['pytest', 'playwright-python'], evidence: ['requirements.txt'] };
  const fixture = async (keyword) => (await py(`${keyword} test_a(page):\n    expect(page.locator("#a")).to_be_visible()\n`, 'tests/test_a.py', { project })).tests[0].assertions.map((a) => [a.library, a.awaited]);
  assert.deepEqual([await fixture('def'), await fixture('async def')], [[['playwright', 'not-needed']], [['playwright', 'no']]]);
  // A bare `expect` in a file that does not use Playwright is not known, so nothing is claimed about it.
  assert.deepEqual((await py('def test_a(x):\n    expect(x).to_be_visible()\n')).tests[0].assertions, []);
});

test('mocks: real assert methods, look-alikes that check nothing, and how a name is known to be a mock', async () => {
  const t = await testWith([
    'send = Mock()', 'self.mailer = MagicMock()', 'with patch("shop.mail.send") as patched, mock.patch.object(Cart, "pay") as pay:', '    cart.checkout()',
    'send.assert_called_once_with(cart)', 'self.mailer.send.assert_not_called()', 'patched.assert_called()', 'pay.assert_awaited_once()', 'cart.notify.assert_called_once()',
    'send.called_once_with(cart)', 'send.assert_called_once', 'send.assert_called_once_wiht(cart)', 'self.mailer.assert_sent()', 'cart.assert_valid()', 'x = send.called_once_with(cart)',
    'mock_charge.assert_called()', 'refund_mock.assert_any_call(1)', 'assert send.called_once_with(cart)', 'assert self.mailer.assert_called_once',
  ], { params: 'self, cart, mock_charge, refund_mock' });
  assert.deepEqual(rows(t), [
    ['mock-call', 'unittest.mock', 'assert_called_once_with'], ['mock-call', 'unittest.mock', 'assert_not_called', 'not'], ['mock-call', 'unittest.mock', 'assert_called'],
    ['mock-call', 'unittest.mock', 'assert_awaited_once'],
    // A real assert method is a mock check on any object: `cart.notify` may be a mock made elsewhere.
    ['mock-call', 'unittest.mock', 'assert_called_once'],
    // Look-alikes: a Mock makes up any attribute, so these return a new Mock and check nothing. They are kept as unfinished mock checks.
    ['mock-call', 'unittest.mock', 'called_once_with', 'incomplete'], ['mock-call', 'unittest.mock', 'assert_called_once', 'incomplete'], ['mock-call', 'unittest.mock', 'assert_called_once_wiht', 'incomplete'],
    ['mock-call', 'unittest.mock', 'assert_sent', 'incomplete'],
    // On an object that is not known to be a mock, a method named assert_something is an assertion by its name.
    ['other', 'assert-function', 'assert_valid'],
    ['mock-call', 'unittest.mock', 'assert_called'], ['mock-call', 'unittest.mock', 'assert_any_call'],
    // The same inside an `assert`: the made-up Mock is truthy, so the assert always passes.
    ['mock-call', 'unittest.mock', 'called_once_with', 'incomplete'], ['mock-call', 'unittest.mock', 'assert_called_once', 'incomplete'],
  ]);
  assert.deepEqual(operands(t).slice(0, 5), [
    ['send <identifier mock>', 'cart <identifier>'], ['self.mailer.send <member mock>', null], ['patched <identifier mock>', null], ['pay <identifier mock>', null], ['cart.notify <member mock>', null],
  ]);

  // `@patch` decorators fill the first parameters, the lowest decorator first. `new=` fills none. The `mocker` fixture makes mocks too.
  const model = await py([
    HEADER, '@patch("a.one")', '@patch("a.two", new=fake)', '@mock.patch.object(Cart, "three")', 'def test_a(three, one, cart, mocker):', '    spy = mocker.spy(Cart, "total")', '    stub = mocker.patch("a.four")',
    '    three.assert_valid()', '    one.assert_valid()', '    cart.assert_valid()', '    spy.assert_valid()', '    stub.assert_valid()', '',
    'class TestA:', '    @patch("a.one")', '    def test_b(self, one, cart):', '        one.assert_valid()', '        cart.assert_valid()', '',
  ].join('\n'));
  assert.deepEqual(model.tests.map((x) => x.assertions.map((a) => a.library)), [
    ['unittest.mock', 'unittest.mock', 'assert-function', 'unittest.mock', 'unittest.mock'], ['unittest.mock', 'assert-function'],
  ]);
  // A name made a mock at module level is known in every test. A name made one inside a test is known only there.
  const scoped = await py(`${HEADER}\nshared = Mock()\n\ndef test_a():\n    local = Mock()\n    shared.assert_x()\n    local.assert_x()\n\ndef test_b(local):\n    shared.assert_x()\n    local.assert_x()\n`);
  assert.deepEqual(scoped.tests.map((x) => x.assertions.map((a) => a.library)), [['unittest.mock', 'unittest.mock'], ['unittest.mock', 'assert-function']]);
});

test('soft checks, snapshots, PyHamcrest, assertpy, HTTP status checks and assert functions', async () => {
  const soft = await testWith([
    'check.equal(cart.total(), 0)', 'check.is_in("EUR", cart.currencies)', 'check.between(cart.total(), 0, 10)', 'pytest_check.check.less(1, 2)', 'with check:', '    assert cart.items == []',
    'with check, open("f"):', '    assert cart.owner is None', 'assert cart.is_open',
  ], { header: 'import pytest_check\nfrom pytest_check import check' });
  assert.deepEqual(rows(soft), [
    ['equality', 'pytest-check', 'equal', 'soft'], ['contains', 'pytest-check', 'is_in', 'soft'], ['other', 'pytest-check', 'between', 'soft'], ['comparison', 'pytest-check', 'less', 'soft', '<'],
    // A plain assert under `with check:` does not stop the test either.
    ['equality', 'pytest-assert', '==', 'soft'], ['nullness', 'pytest-assert', 'is', 'soft'], ['truthiness', 'pytest-assert', 'assert'],
  ]);
  assert.deepEqual(operands(soft)[1], ['cart.currencies <member>', '"EUR" <literal string>']);

  const hamcrest = ['assert_that(cart.total(), equal_to(1))', 'assert_that(cart.total(), is_(not_(equal_to(1))))', 'assert_that(cart.total(), is_not(1))', 'assert_that(cart.items, has_length(2))',
    'assert_that(cart.total(), greater_than(0))', 'assert_that(cart.items, only_contains("a"))', 'assert_that(calling(cart.add), raises(ValueError))', 'assert_that(cart.is_open)'];
  const expected = [
    ['equality', 'hamcrest', 'equal_to'], ['equality', 'hamcrest', 'equal_to', 'not'], ['equality', 'hamcrest', 'equal_to', 'not'], ['count', 'hamcrest', 'has_length'],
    ['comparison', 'hamcrest', 'greater_than', '>'], ['other', 'hamcrest', 'only_contains'], ['throws', 'hamcrest', 'raises'], ['truthiness', 'hamcrest', 'assert_that'],
  ];
  // The same with a star import: `assert_that` is PyHamcrest unless the file imports assertpy.
  for (const header of ['from hamcrest import assert_that, equal_to', 'from hamcrest import *', 'import hamcrest']) {
    const t = await testWith(header === 'import hamcrest' ? hamcrest.map((line) => line.replace('assert_that(', 'hamcrest.assert_that(')) : hamcrest, { header });
    assert.deepEqual(rows(t), expected, header);
    assert.deepEqual([operands(t)[1], operands(t)[2], operands(t)[6]], [['cart.total() <call>', '1 <literal number>'], ['cart.total() <call>', '1 <literal number>'], [null, 'ValueError <identifier>']]);
  }
  const assertpy = await testWith([
    'assert_that(cart.total()).is_equal_to(1)', 'assert_that(cart.items).is_not_empty().contains("a").is_close_to(1, 2)', 'assert_that(cart.add).raises(ValueError).when_called_with(None)',
    'assert_that(cart.total())', 'result = assert_that(cart.total())', 'assert_that(cart).described_as("cart").is_not_none()',
  ], { header: 'from assertpy import *' });
  assert.deepEqual(rows(assertpy), [
    ['equality', 'assertpy', 'is_equal_to'], ['count', 'assertpy', 'is_not_empty', 'not'], ['contains', 'assertpy', 'contains'], ['other', 'assertpy', 'is_close_to'], ['throws', 'assertpy', 'raises'],
    ['other', 'assertpy', null, 'incomplete'], ['nullness', 'assertpy', 'is_not_none', 'not'],
  ]);
  // Two checks on one chain start at their own method, so they do not share a position.
  assert.deepEqual(assertpy.assertions.slice(1, 4).map((a) => a.span.startColumn), [29, 44, 58]);

  const rest = await testWith([
    'response.raise_for_status()', 'snapshot.assert_match(cart.to_text(), "cart.txt")', 'np.testing.assert_allclose(cart.total(), 1.0)', 'assert_frame_equal(left, right)',
    'make().assert_ready()', 'assertion = build_assertion()', 'cart.assert_called = True',
  ], { params: 'cart, response, snapshot, left, right' });
  assert.deepEqual(rows(rest), [
    ['status', 'http-client', 'raise_for_status'], ['snapshot', 'snapshot', 'assert_match'], ['other', 'assert-function', 'assert_allclose'], ['other', 'assert-function', 'assert_frame_equal'],
  ]);
});

test('assertions: guarded by a branch, a loop or a callback, and unreachable after a return, a raise or a fail', async () => {
  const guards = await testWith([
    'assert a', 'if a:', '    assert b', 'elif b:', '    assert c', 'else:', '    assert d', 'for item in items:', '    assert item', 'else:', '    assert a', 'while a:', '    assert b',
    'match a:', '    case 1:', '        assert b', 'a and check_it(b)', 'check_it(a) or check_it(b)', 'value = check_it(a) if a else check_it(b)', 'results = [check_it(item) for item in items]',
    'callback = lambda: check_it(a)', 'with open("f") as handle:', '    assert handle', 'try:', '    assert a', 'finally:', '    assert b', 'if a:', '    pytest.fail("x")', 'for item in items:', '    pytest.fail("y")',
    'for n in [1, 2, 3]:', '    assert n', 'for n in ():', '    assert n', 'for n in (1, 2):', '    assert n', 'else:', '    assert a',
  ], { header: `${HEADER}\ndef check_it(x):\n    assert x\n`, params: 'a, b, c, d, items' });
  assert.deepEqual(guards.assertions.map((a) => [a.span.startLine, a.guarded]), [
    [11, false], [13, true], [15, true], [17, true], [19, true], [21, true], [23, true], [26, true],
    // The right side of `and`/`or`, both arms of `x if c else y`, the body of a comprehension, and a lambda.
    [27, true], [28, false], [28, true], [29, true], [29, true], [30, true], [31, true],
    // A with block and try/finally always run their body.
    [33, false], [35, false], [37, false],
    // `if broken: pytest.fail()` is a check in itself. In a loop it may never run.
    [39, false], [41, true],
    // A loop over a list that is written out with items always runs. An empty one never does, and the else of a loop is skipped by a break.
    [43, false], [45, true], [47, false], [49, true],
  ]);
  assert.ok(guards.assertions.every((a) => a.reachable));

  const reach = await testWith([
    'assert a', 'if a:', '    return', '    assert b', 'assert c', 'for item in items:', '    continue', '    assert item', 'while a:', '    break', '    assert a', 'if b:', '    pytest.fail("x")', '    assert b',
    'def later():', '    return', 'raise ValueError("stop")', 'assert d',
  ], { params: 'a, b, c, d, items' });
  assert.deepEqual(reach.assertions.map((a) => [a.span.startLine, a.kind, a.reachable]), [
    [8, 'truthiness', true], [11, 'truthiness', false], [12, 'truthiness', true], [15, 'truthiness', false], [18, 'truthiness', false], [20, 'fail-call', true], [21, 'truthiness', false],
    // The return of a nested function ends that function, not the test.
    [24, 'fail-call', true], [25, 'truthiness', false],
  ]);
});

test('try blocks: what is caught, which clause decides, and what the handler does', async () => {
  const t = await testWith([
    'try:', '    assert a', 'except Exception:', '    pass',
    'try:', '    assert a', '    assert b', 'except:', '    log("x")',
    'try:', '    assert a', 'except (KeyError, builtins.AssertionError) as error:', '    raise',
    'try:', '    assert a', 'except ValueError:', '    pass',
    'try:', '    assert a', 'except KeyError:', '    raise', 'except BaseException:', '    pass', 'except Exception:', '    pytest.fail("no")',
    'try:', '    assert a', 'except AssertionError as error:', '    assert "x" in str(error)',
    'try:', '    assert a', 'except Exception as error:', '    self.fail(str(error))',
    'try:', '    go()', 'except Exception:', '    pass', 'else:', '    assert a', 'finally:', '    assert b',
    'try:', '    assert a', 'finally:', '    close()',
    'try:', '    check.equal(a, 1)', 'except Exception:', '    pass',
    'with contextlib.suppress(AssertionError, KeyError):', '    assert a',
    'with suppress(ValueError):', '    assert a',
    'with pytest.raises(Exception):', '    assert a',
    'with self.assertRaises((ValueError, TypeError)) as raised:', '    go()',
    'try:', '    try:', '        assert a', '    except KeyError:', '        pass', 'except* Exception:', '    pass',
  ], { header: `${HEADER}import builtins\nimport contextlib\nfrom contextlib import suppress\nfrom pytest_check import check\n`, params: 'self, a, b' });
  const line = (n) => n + 11;
  assert.deepEqual(t.tryBlocks.map((b) => [b.span.startLine, b.kind, b.assertionsInside, b.catches, b.catchesAssertionFailures, [b.handlerRethrows && 'rethrows', b.handlerFails && 'fails', b.handlerAsserts && 'asserts'].filter(Boolean)]), [
    [line(1), 'try-catch', 1, ['Exception'], true, []],
    [line(5), 'try-catch', 2, ['*'], true, []],
    [line(10), 'try-catch', 1, ['KeyError', 'builtins.AssertionError'], true, ['rethrows']],
    // ValueError does not catch a failed assertion.
    [line(14), 'try-catch', 1, ['ValueError'], false, []],
    // Python runs the first clause that matches: `except BaseException: pass` hides the failure, whatever the other clauses do.
    [line(18), 'try-catch', 1, ['KeyError', 'BaseException', 'Exception'], true, []],
    [line(26), 'try-catch', 1, ['AssertionError'], true, ['asserts']],
    [line(30), 'try-catch', 1, ['Exception'], true, ['fails']],
    // What sits in `else:` and `finally:` is not protected by the except.
    [line(34), 'try-catch', 0, ['Exception'], true, []],
    // A soft check does not raise, so the handler cannot hide it.
    [line(46), 'try-catch', 0, ['Exception'], true, []],
    [line(50), 'try-catch', 1, ['AssertionError', 'KeyError'], true, []],
    [line(52), 'try-catch', 1, ['ValueError'], false, []],
    // A block that expects an exception. `pytest.raises(Exception)` is satisfied by a failed assertion inside it.
    [line(54), 'expected-exception-block', 1, ['Exception'], true, []],
    [line(56), 'expected-exception-block', 0, ['ValueError', 'TypeError'], false, []],
    // The inner block is recorded first, when its try is read. The outer block counts the assertion too.
    [line(59), 'try-catch', 1, ['KeyError'], false, []],
    [line(58), 'try-catch', 1, ['Exception'], true, []],
  ]);
  // try/finally with no except is not a try block. Assertions in a handler are guarded.
  assert.equal(t.tryBlocks.some((b) => b.span.startLine === line(42)), false);
  assert.deepEqual(t.assertions.filter((a) => a.guarded).map((a) => a.span.startLine), [line(25), line(29), line(33)]);
  assert.deepEqual(schemaErrors('model.schema.json', await py('def test_a():\n    try:\n        assert 1\n    except')), []);
});

test('helpers: found in the same file, in conftest.py through the index, and in the config, one level deep', async () => {
  const source = [
    'import pytest', '', 'def check_total(cart, n):', '    assert cart.total() == n', '', 'def expect_error(cart):', '    with pytest.raises(ValueError):', '        cart.add(None)', '',
    'def must_be_open(cart):', '    if not cart.is_open:', '        raise AssertionError("closed")', '', 'def load(cart):', '    if cart is None:', '        raise ValueError("no cart")', '    return cart', '',
    'def wraps_a_helper(cart):', '    check_total(cart, 1)', '', 'class CartPage:', '    def should_be_empty(self):', '        assert self.items == []', '    def open(self):', '        return self', '',
    'def test_a(cart, page):', '    check_total(cart, 1)', '    expect_error(cart)', '    must_be_open(cart)', '    load(cart)', '    wraps_a_helper(cart)', '    page.should_be_empty()', '    page.open()',
    '    assert_cart_total(cart, 1)', '    verify_cart(cart)', '    def inner():', '        assert cart', '    inner()', '', 'def test_b(cart):', '    test_a(cart, None)', '',
  ].join('\n');
  const helpers = pythonAdapter.collectHelpers(await pythonAdapter.parse({ path: 'tests/test_a.py', absPath: '/x', language: 'python', project: null, text: source }, adapterContext()));
  // A function that only raises an error of its own is no helper. One that raises AssertionError is. Test functions are left out.
  assert.deepEqual(helpers.map((helper) => [helper.name, helper.owner, helper.file, helper.span.startLine]), [
    ['check_total', null, 'tests/test_a.py', 3], ['expect_error', null, 'tests/test_a.py', 6], ['must_be_open', null, 'tests/test_a.py', 10], ['should_be_empty', 'CartPage', 'tests/test_a.py', 23], ['inner', null, 'tests/test_a.py', 38],
  ]);
  const via = (model) => model.tests.map((t) => t.assertions.map((a) => a.viaHelper ?? a.library));
  // `assert_cart_total` is not defined in this file. It counts by its name. `verify_cart` does not.
  assert.deepEqual(via(await py(source)), [['check_total', 'expect_error', 'must_be_open', 'should_be_empty', 'assert-function', 'inner'], []]);
  // With conftest.py in the index and a helper named in the config, both are counted as helpers.
  const helperIndex = createHelperIndex([{ name: 'assert_cart_total', owner: null, file: 'tests/conftest.py', span: { startLine: 1, startColumn: 1, endLine: 2, endColumn: 1 } }]);
  assert.deepEqual(via(await py(source, 'tests/test_a.py', { helperIndex, config: { assertionHelpers: ['verify_cart'] } }))[0], ['check_total', 'expect_error', 'must_be_open', 'should_be_empty', 'assert_cart_total', 'verify_cart', 'inner']);
  // The real path: the fixture project has `assert_cart_total` in conftest.py and a test that imports and calls it.
  const model = await modelOf('pytest', 'tests/test_assertions.py');
  assert.deepEqual(rows(model.tests.find((t) => t.title === 'test_helpers')), [['other', 'helper', null, 'via:assert_cart_total'], ['other', 'helper', null, 'via:assert_empty'], ['other', 'assert-function', 'assert_allclose']]);
});

test('support files: where the helpers of a file may come from', async () => {
  const guesses = async (relPath, text, project = null) => pythonAdapter.supportFiles(await pythonAdapter.parse({ path: relPath, absPath: '/x', language: 'python', project, text }, adapterContext()));
  assert.deepEqual(await guesses('tests/api/test_a.py', 'import pytest\nfrom . import checks\nfrom .pages.cart import CartPage\nfrom ..helpers import *\nfrom tests.support import login\nimport shop.cart\n'), [
    'tests/api/__init__.py', 'tests/api/checks.py', 'tests/api/checks/__init__.py', 'tests/api/pages/cart.py', 'tests/api/pages/cart/__init__.py', 'tests/api/pages/cart/CartPage.py', 'tests/api/pages/cart/CartPage/__init__.py',
    'tests/helpers.py', 'tests/helpers/__init__.py', 'tests/support.py', 'tests/support/__init__.py', 'tests/support/login.py', 'tests/support/login/__init__.py', 'shop/cart.py', 'shop/cart/__init__.py',
    // conftest.py of the folder and of every folder above it.
    'tests/api/conftest.py', 'tests/conftest.py', 'conftest.py',
  ]);
  // In a project folder, absolute imports are tried from the project and from the root, and conftest.py stops at the project.
  const project = { dir: 'services/shop', adapterId: 'python', languages: ['python'], frameworks: ['pytest'], evidence: ['pyproject.toml'] };
  assert.deepEqual(await guesses('services/shop/tests/test_a.py', 'from support import login\nfrom ...outside import x\n', project), [
    'services/shop/support.py', 'services/shop/support/__init__.py', 'services/shop/support/login.py', 'services/shop/support/login/__init__.py', 'support.py', 'support/__init__.py', 'support/login.py', 'support/login/__init__.py',
    'services/outside.py', 'services/outside/__init__.py', 'services/outside/x.py', 'services/outside/x/__init__.py', 'services/shop/tests/conftest.py', 'services/shop/conftest.py',
  ]);
  assert.deepEqual(await guesses('test_a.py', 'from .. import above\n'), ['conftest.py']);
  const parser = createTreeSitterService({ readAsset: (name) => (name.endsWith('python.wasm') ? (() => { throw new Error('gone'); })() : readAsset(name)) });
  const unparsed = await pythonAdapter.parse({ path: 'a.py', absPath: '/a.py', language: 'python', project: null, text: 'x' }, { ...adapterContext(), parser });
  assert.deepEqual([pythonAdapter.supportFiles(unparsed), pythonAdapter.collectHelpers(unparsed)], [[], []]);
});

test('hooks keep their assertions, and the two halves of a fixture each keep their own', async () => {
  const model = await py([
    'import pytest', '', '@pytest.fixture', 'def cart(api):', '    created = api.post("/carts")', '    assert created.status_code == 201', '    yield created.json()', '    deleted = api.delete("/carts/1")',
    '    assert deleted.status_code == 204', '', 'def setup_function(function):', '    assert function', '', 'class TestA:', '    def setup_method(self):', '        self.assertTrue(True)',
    '    async def test_a(self, cart):', '        assert cart', '',
  ].join('\n'));
  assert.deepEqual(model.fileHooks.map((hook) => [hook.kind, hook.assertions.map((a) => [a.span.startLine, a.kind, a.statusCodes])]), [
    ['beforeEach', [[6, 'status', [201]]]], ['fixture-teardown', [[9, 'status', [204]]]], ['beforeEach', [[12, 'truthiness', undefined]]],
  ]);
  assert.deepEqual(model.suites[0].hooks.map((hook) => hook.assertions.map((a) => a.library)), [['unittest']]);
  const unittestSetUp = await modelOf('unittest', 'tests/test_assertions.py');
  assert.deepEqual(unittestSetUp.suites[0].hooks[0].assertions.map((a) => [a.matcher, operandOf(a.actual)]), [['assertEqual', 'len(self.cart.items) <call count>']]);
});

test('the rules read the Python model: a swallowed failure is QCR-E001, an unawaited async expect is QCR-A003, and the rules on waits, selectors, mocks and cleanup run', async () => {
  const review = async (framework) => {
    const { report } = await runReview({ root: fixtureRoot('adapters', 'python', framework), config: resolveConfig({ rules: { 'QCR-N001': 'off', 'QCR-D001': 'off' } }).config, git: false, rules: builtinRules });
    return report.findings.map((finding) => `${finding.location.file}:${finding.location.startLine} ${finding.ruleId} ${finding.message}`);
  };
  const pytest = await review('pytest');
  // `except Exception`, `except BaseException`, a bare `except` and `suppress(AssertionError)` around an assertion. The handled ones are not reported.
  assert.deepEqual(pytest.filter((line) => line.includes('QCR-E001')).map((line) => line.split(' ').slice(0, 2).join(' ')), [
    'tests/test_assertions.py:177 QCR-E001', 'tests/test_assertions.py:181 QCR-E001', 'tests/test_assertions.py:185 QCR-E001', 'tests/test_assertions.py:189 QCR-E001',
  ]);
  // A tuple assert, a count that is at least 0, an unfinished pytest.raises, an unreachable assert and the mock look-alikes are all found by the rule as it is.
  const cannotFail = pytest.filter((line) => line.includes('QCR-A003') && line.includes('test_assertions.py')).map((line) => Number(line.split(':')[1].split(' ')[0]));
  assert.deepEqual(cannotFail, [47, 48, 69, 82, 150, 151, 152, 153, 154, 155, 156, 157, 158]);
  const playwright = await review('playwright-python');
  assert.ok(playwright.includes('tests/test_async_login.py:32 QCR-A003 This assertion is not awaited, so the test can end before it fails.'), playwright.join('\n'));
  assert.deepEqual(playwright.filter((line) => line.includes('QCR-A003') && line.includes('test_matchers.py')).map((line) => Number(line.split(':')[1].split(' ')[0])), [56, 57, 58, 59, 60, 61]);
  // The rules that need what a body does: a hard wait, a brittle selector, a driver and a patch that are never released. No rule is skipped any more.
  const selenium = await review('selenium');
  for (const line of [
    'tests/test_login.py:34 QCR-W001 Hard wait of 2000 ms.', "tests/test_search.py:24 QCR-S001 XPath depends on layout: (//div[@class='inventory_item_name'])[1].", 'tests/test_waits.py:45 QCR-C001 This driver is started and never quit.',
  ]) assert.ok(selenium.includes(line), `${line}\n${selenium.join('\n')}`);
  assert.deepEqual(selenium.filter((line) => line.includes('QCR-C001')).length, 1); // the drivers closed in tearDown, in finally, by addCleanup and by a fixture teardown are not reported
  const unittest = await review('unittest');
  assert.deepEqual(unittest.filter((line) => line.includes('QCR-C001')), ['tests/test_checkout.py:35 QCR-C001 This patch is never undone.', 'tests/test_checkout.py:36 QCR-C001 This environment variable is changed and never set back.']);
  const body = (lines) => lines.filter((line) => /QCR-(W001|S001|M001|C001)/.test(line)).map((line) => line.split(' ').slice(0, 2).join(' ').replace('tests/test_', '').replace('QCR-', ''));
  assert.deepEqual(body(pytest), [
    // Requests that create data and never delete it (info), fixed sleeps, and the test that takes eight things and gives none back.
    'cart.py:67 C001', 'checkout.py:25 C001', 'checkout.py:26 W001', 'checkout.py:27 W001', 'checkout.py:28 W001', 'checkout.py:33 C001', 'checkout.py:34 W001', 'checkout.py:66 C001',
    'checkout.py:133 C001', 'checkout.py:134 C001', 'checkout.py:135 C001', 'checkout.py:136 C001', 'checkout.py:137 C001', 'checkout.py:138 C001', 'checkout.py:140 C001', 'checkout.py:141 C001',
    // Over-mocking: the function under test has a fixed reply and is then checked, the class under test is patched, the module under test is patched.
    // `@patch("shop.checkout.tax_rate", return_value=0)` stubs a dependency and is not reported.
    'checkout.py:173 M001', 'checkout.py:176 M001', 'checkout.py:187 M001',
  ]);
  assert.ok(pytest.includes('tests/test_checkout.py:173 QCR-M001 charge is given a fixed reply and is then called and checked, so this assertion checks the mock.'));
  assert.deepEqual(body(playwright), [
    'checkout.py:33 W001', 'checkout.py:40 S001',
    // A route that answers every request, before a check on the page.
    'routes.py:18 M001', 'routes.py:31 W001', 'routes.py:54 S001', 'routes.py:55 S001', 'routes.py:56 S001',
    // A browser, a context and a page started by hand and never closed. The ones closed in `finally`, by `with` or by a fixture are not reported.
    'routes.py:67 C001', 'routes.py:68 C001', 'routes.py:69 C001', 'routes.py:70 C001', 'routes.py:101 C001',
  ]);
  const { report } = await runReview({ root: fixtureRoot('adapters', 'python', 'selenium'), config: resolveConfig({}).config, git: false, rules: builtinRules });
  assert.deepEqual(report.files.flatMap((entry) => entry.rulesSkipped), []);
});

// What a body does.

const BODY_HEADER = `${HEADER}import asyncio\nimport os\nimport time\nfrom time import sleep as nap\nfrom selenium import webdriver\nfrom selenium.webdriver.common.by import By\nfrom selenium.webdriver.support.ui import WebDriverWait\n`;
const selectorRows = (list) => list.map((s) => [s.api, s.strategy, s.value, ...(s.positional ? [`${s.positional.kind}:${s.positional.index}:${s.positional.baseStrategy}`] : [])]);
const mockRows = (list) => list.map((m) => [m.kind, m.target, m.targetsSubject, [m.passthrough && 'passthrough', m.stubbedReturn && 'stubbed', m.fulfillsAllNetwork && 'all-network'].filter(Boolean).join(' ')]);
const resourceRows = (list) => list.map((r) => [r.span.startLine, r.kind, r.acquiredIn, r.autoManaged ? 'auto' : r.released ? 'released' : 'leak']);

test('waits: fixed sleeps in milliseconds, implicit waits, condition waits and fake time', async () => {
  const t = await testWith([
    'time.sleep(2)', 'time.sleep(0.25)', 'time.sleep(1_000)', 'time.sleep(DELAY)', 'nap(3)', 'await asyncio.sleep(1.5)', 'page.wait_for_timeout(500)', 'driver.implicitly_wait(10)',
    'page.wait_for_selector("#a")', 'page.locator("#a").wait_for()', 'page.wait_for_load_state()', 'WebDriverWait(driver, 5).until(ready)', 'wait = WebDriverWait(driver, 5)', 'wait.until_not(busy)',
    'self.wait.until(ready)', 'loop.run_until_complete(job)', 'retry.until(ready)', 'freeze_time("2026-01-01")', 'sleep(4)', 'thread.sleep(5)',
  ], { header: `${BODY_HEADER}from freezegun import freeze_time\n`, params: 'self, page, driver' });
  assert.deepEqual(t.waits.map((w) => [w.kind, w.ms, w.text]), [
    ['fixed-sleep', 2000, 'time.sleep(2)'], ['fixed-sleep', 250, 'time.sleep(0.25)'], ['fixed-sleep', 1000000, 'time.sleep(1_000)'], ['fixed-sleep', null, 'time.sleep(DELAY)'],
    // `from time import sleep as nap`: the name is followed through the import.
    ['fixed-sleep', 3000, 'nap(3)'], ['fixed-sleep', 1500, 'asyncio.sleep(1.5)'], ['fixed-sleep', 500, 'page.wait_for_timeout(500)'], ['implicit-wait-config', 10000, 'driver.implicitly_wait(10)'],
    ['condition', null, 'page.wait_for_selector("#a")'], ['condition', null, 'page.locator("#a").wait_for()'], ['condition', null, 'page.wait_for_load_state()'],
    ['condition', null, 'WebDriverWait(driver, 5).until(ready)'], ['condition', null, 'wait.until_not(busy)'], ['condition', null, 'self.wait.until(ready)'],
    ['fake-timer', null, 'freeze_time("2026-01-01")'],
    // A bare `sleep` that is not imported from time, `thread.sleep`, `retry.until` and `run_until_complete` are not known.
  ]);
  assert.deepEqual(t.waits[0].span, { startLine: 16, startColumn: 5, endLine: 16, endColumn: 18 });
});

test('selectors: Playwright calls, page actions with a selector, Selenium By strategies and picks by position', async () => {
  const t = await testWith([
    'page.locator("#buy").click()', 'page.locator(".price")', 'page.locator("//div[@id=\'a\']")', 'page.locator("[data-testid=\'buy\']")', 'page.locator("[data-automation=\'buy\']")', 'page.locator(f"#row-{n}")', 'page.locator(SELECTOR)',
    'page.get_by_role("button", name="Buy")', 'page.get_by_test_id("buy")', 'page.get_by_label("Name")', 'page.get_by_text("Buy")', 'page.get_by_placeholder("Name")', 'page.query_selector_all("li")',
    'page.frame_locator("#ads").locator("a")', 'page.click("#buy")', 'page.fill("#name", "Ada")', 'page.fill("#name")', 'self.login_page.click("text=Login")', 'button.click("#not-a-selector")', 'page.click(SELECTOR)',
    'page.locator("li").nth(2)', 'page.locator("li").first', 'page.get_by_role("row").last.click()', 'page.locator("ul").locator("li").nth(n)',
    'driver.find_element(By.ID, "name")', 'driver.find_element(By.CSS_SELECTOR, "#name")', 'driver.find_element(By.CSS_SELECTOR, ".a > .b")', 'driver.find_elements(By.XPATH, "//li")[0]', 'driver.find_elements(By.CLASS_NAME, "row")[3]',
    'driver.find_element(by=By.NAME, value="q")', 'located((By.LINK_TEXT, "Home"))', 'driver.find_element(By.ID, name)', 'driver.find_element_by_xpath("//a")', 'driver.find_elements_by_class_name("row")', 'By.ID', 'x = (By.UNKNOWN, "a")',
  ], { header: BODY_HEADER, params: 'self, page, driver, button, n, name', config: { testIdAttribute: 'data-automation' } });
  assert.deepEqual(selectorRows(t.selectors), [
    ['locator', 'id', '#buy'], ['locator', 'class', '.price'], ['locator', 'xpath', "//div[@id='a']"], ['locator', 'test-id', "[data-testid='buy']"],
    // The test id attribute of the config counts too.
    ['locator', 'test-id', "[data-automation='buy']"],
    // A selector that is not written out: the call is known, the value is not.
    ['locator', 'other', null], ['locator', 'other', null],
    ['get_by_role', 'role', 'button'], ['get_by_test_id', 'test-id', 'buy'], ['get_by_label', 'label', 'Name'], ['get_by_text', 'text', 'Buy'], ['get_by_placeholder', 'other', 'Name'], ['query_selector_all', 'css', 'li'],
    ['frame_locator', 'id', '#ads'], ['locator', 'css', 'a'],
    // On a page the first argument of click and fill is a selector. On a locator it is not, and fill needs two arguments.
    ['click', 'id', '#buy'], ['fill', 'id', '#name'], ['click', 'text', 'text=Login'],
    ['locator', 'css', 'li', 'nth:2:css'], ['locator', 'css', 'li', 'first:null:css'], ['get_by_role', 'role', 'row', 'last:null:role'], ['locator', 'css', 'ul'], ['locator', 'css', 'li', 'nth:null:css'],
    // Selenium: the strategy comes from the By constant. For CSS it is read from the selector.
    ['By.ID', 'id', 'name'], ['By.CSS_SELECTOR', 'id', '#name'], ['By.CSS_SELECTOR', 'css', '.a > .b'], ['By.XPATH', 'xpath', '//li', 'first:0:xpath'], ['By.CLASS_NAME', 'class', 'row', 'nth:3:class'],
    ['By.LINK_TEXT', 'link-text', 'Home'], ['By.ID', 'id', null], ['find_element_by_xpath', 'xpath', '//a'], ['find_elements_by_class_name', 'class', 'row'],
  ]);
  assert.deepEqual([t.selectors[0].text, t.selectors[23].text, t.selectors[28].text], ['page.locator("#buy")', 'driver.find_element(By.ID, "name")', '(By.LINK_TEXT, "Home")']);
});

test('steps and data: navigation, actions, HTTP requests by verb, and SQL by its first word', async () => {
  const t = await testWith([
    'page.goto("/cart")', 'page.locator("#buy").click()', 'page.get_by_label("Name").fill("Ada")', 'self.checkout_page.reload()', 'driver.get("https://www.saucedemo.com")', 'driver.find_element(By.ID, "q").send_keys("x")',
    'cart.click()', 'items.clear()', 'cache.get("key")', 'requests.post(URL, json={})', 'httpx.get(URL)', 'self.client.put("/a", {})', 'api_session.delete(URL)', 'page.request.patch(URL)', 'settings.get("x")',
    'cursor.execute("INSERT INTO orders VALUES (1)")', 'cursor.execute("  select 1")', 'cursor.execute(QUERY)', 'cursor.execute("VACUUM")', 'pool.submit(job)',
  ], { header: `${BODY_HEADER}import httpx\nimport requests\n`, params: 'self, page, driver, cart, items, cache, api_session, settings, cursor, pool' });
  assert.deepEqual(t.steps.map((s) => [s.kind, s.text]), [
    ['navigate', 'page.goto("/cart")'], ['action', 'page.locator("#buy").click()'], ['action', 'page.get_by_label("Name").fill("Ada")'], ['navigate', 'self.checkout_page.reload()'],
    ['navigate', 'driver.get("https://www.saucedemo.com")'], ['action', 'driver.find_element(By.ID, "q").send_keys("x")'],
    // `cart.click()` and `items.clear()` are on objects that are not known to be a page or an element.
    ['request', 'requests.post(URL, json={})'], ['request', 'httpx.get(URL)'], ['request', 'self.client.put("/a", {})'], ['request', 'api_session.delete(URL)'], ['request', 'page.request.patch(URL)'],
  ]);
  assert.deepEqual(t.data.map((d) => [d.op, d.via]), [['create', 'http'], ['read', 'http'], ['update', 'http'], ['delete', 'http'], ['update', 'http'], ['create', 'db'], ['read', 'db']]);
});

test('mocks: patch in every form, named mocks, monkeypatch, network fakes, and which ones replace the module under test', async () => {
  const header = `${HEADER}import responses\nimport respx\nfrom shop.cart import Cart, get_total\nfrom shop import cart as cart_module\n`;
  const model = await py([
    header, '@patch("shop.cart.get_total", return_value=42)', '@patch("shop.cart.tax_rate", return_value=0)', '@patch("shop.mail.send")', '@mock.patch.object(Cart, "total", return_value=1)', '@patch("shop.cart.Cart")',
    'def test_a(cart_class, total, send, tax_rate, mock_total, mocker, monkeypatch, page, requests_mock):',
    '    with patch("shop.cart.audit", wraps=real_audit) as audit, patch.object(cart_module, "charge") as charge:', '        pass',
    '    with patch("shop.cart"), patch("shop"), patch("shop.orders"):', '        pass',
    '    spy = mocker.spy(Cart, "total")', '    fake = mocker.patch("shop.cart.rates", {"EUR": 1})', '    later = mocker.patch("shop.cart.stock")', '    later.return_value = 3', '    send.side_effect = OSError',
    '    callback = Mock()', '    reply = MagicMock(return_value=1)', '    Mock()', '    monkeypatch.setattr("shop.cart.get_total", lambda items: 42)', '    monkeypatch.setattr(cart_module, "charge", real_charge)',
    '    monkeypatch.setattr(Cart, "tax", Mock(return_value=0))', '    monkeypatch.setattr("shop.cart.LIMIT", 5)', '    monkeypatch.setitem(settings, "a", 1)',
    '    page.route("**/*", lambda route: route.fulfill(json={}))', '    page.route("**/api", lambda route: route.continue_())', '    page.route("**/img", handler)', '    page.route(PATTERN, answer)',
    '    responses.add(responses.GET, "https://api.example.test/a", json={})', '    respx.post("https://api.example.test/b")', '    requests_mock.get("**/*", json={})', '    router.route("/x", view)', '    tax_rate.return_value = 7', '',
    'def answer(route):', '    route.fulfill(status=204)', '',
  ].join('\n'), 'tests/test_cart.py');
  assert.deepEqual(model.subject, { module: 'shop.cart', via: 'filename' });
  assert.deepEqual(mockRows(model.tests[0].mocks), [
    // The decorators come first. `get_total` is imported by this test from the module under test, so the patch replaces what is tested.
    // A patched function is named the way the file calls it: `get_total`, and `cart_module.tax_rate` after `from shop import cart as cart_module`.
    ['function', 'get_total', true, 'stubbed'],
    // `tax_rate` is in the same module, and the test does not import it: it may be something the module imports. Not known, so null.
    // `send.side_effect = OSError` in the body gives the third patch a fixed reply: the decorators fill the parameters from the bottom up.
    ['function', 'cart_module.tax_rate', null, 'stubbed'], ['function', 'shop.mail.send', false, 'stubbed'], ['function', 'Cart.total', true, 'stubbed'], ['class', 'shop.cart.Cart', true, ''],
    // `wraps=` keeps the real behavior. A spy does too.
    ['function', 'cart_module.audit', null, 'passthrough'], ['function', 'cart_module.charge', true, ''],
    // The module under test itself, a package the file imports from, and a dotted name that is not known to be a module.
    ['module', 'shop.cart', true, ''], ['module', 'shop', false, ''], ['function', 'shop.orders', false, ''], ['function', 'Cart.total', true, 'passthrough'],
    // A second argument, `return_value=`, or `.return_value = ...` later: a fixed reply.
    ['function', 'cart_module.rates', null, 'stubbed'], ['function', 'cart_module.stock', null, 'stubbed'],
    // A mock with a name of its own. One that is not stored is not kept.
    ['function', 'callback', false, ''], ['function', 'reply', false, 'stubbed'],
    // monkeypatch: a lambda, a literal or a mock with a reply is a canned value. A real function is not.
    // A name in capitals only is a constant, not a class.
    ['function', 'get_total', true, 'stubbed'], ['function', 'cart_module.charge', true, ''], ['function', 'Cart.tax', true, 'stubbed'], ['function', 'cart_module.LIMIT', null, 'stubbed'],
    // Network: a route that answers every request, one that lets the call through, one whose handler is not known, and one whose handler is a function of this file.
    ['network', '**/*', false, 'stubbed all-network'], ['network', '**/api', false, 'passthrough'], ['network', '**/img', false, ''], ['network', 'PATTERN', false, 'stubbed'],
    ['network', 'https://api.example.test/a', false, 'stubbed'], ['network', 'https://api.example.test/b', false, 'stubbed'], ['network', '**/*', false, 'stubbed all-network'],
  ]);
  // `@patch` on a class and a patcher started in setUp are mocks of the file. With no module under test, nothing is claimed about the target.
  const file = await py([
    HEADER, '@patch("shop.mail.send")', 'class CartTests(unittest.TestCase):', '    def setUp(self):', '        self.charge = patch("shop.pay.charge", return_value=True).start()', '        self.addCleanup(patch.stopall)',
    '    def test_a(self, send):', '        self.assertTrue(pay())', '',
  ].join('\n'), 'tests/test_misc.py');
  assert.deepEqual([file.subject, mockRows(file.fileMocks), file.tests[0].mocks], [null, [['function', 'shop.mail.send', null, ''], ['function', 'shop.pay.charge', null, 'stubbed']], []]);
});

test('subject: the import that has the name of the test file, or the subjectMap of the config', async () => {
  const subject = async (relPath, imports, config) => (await py(`${imports}\n\ndef test_a():\n    assert True\n`, relPath, config ? { config } : undefined)).subject;
  assert.deepEqual(await subject('tests/test_cart.py', 'from shop.cart import Cart'), { module: 'shop.cart', via: 'filename' });
  assert.deepEqual(await subject('tests/cart_test.py', 'import shop.cart'), { module: 'shop.cart', via: 'filename' });
  assert.deepEqual(await subject('tests/test_cart.py', 'from shop import cart'), { module: 'shop.cart', via: 'filename' });
  assert.deepEqual(await subject('tests/test_cart.py', 'from . import cart'), { module: '.cart', via: 'filename' });
  assert.deepEqual(await subject('tests/test_Cart.py', 'import cart as c'), { module: 'cart', via: 'filename' });
  // No import with the name of the file, an import under TYPE_CHECKING, or a framework import: not known.
  assert.equal(await subject('tests/test_cart.py', 'from shop.orders import Order'), null);
  assert.equal(await subject('tests/test_cart.py', 'from typing import TYPE_CHECKING\nif TYPE_CHECKING:\n    from shop.cart import Cart'), null);
  assert.equal(await subject('tests/test_pytest.py', 'import pytest'), null);
  assert.equal(await subject('tests/test_assertpy.py', 'from assertpy import assert_that'), null);
  assert.equal(await subject('tests/test_.py', 'import shop'), null);
  const config = { rules: { 'QCR-M001': { subjectMap: { 'tests/api/**': 'shop.api.views' } } } };
  assert.deepEqual(await subject('tests/api/test_orders.py', 'from shop.api import views\nfrom shop import orders', config), { module: 'shop.api.views', via: 'subjectMap' });
  // The module is imported as a whole, so no name is imported from it. A patched name that the file calls there itself is part of what it tests.
  const mapped = await py('from unittest.mock import patch\nfrom shop.api import views\n\n@patch("shop.api.views.list_orders")\n@patch("shop.api.views.fetch")\n@patch("shop.db.query")\ndef test_a(query, fetch, listed):\n    assert views.list_orders()\n', 'tests/api/test_orders.py', { config });
  assert.deepEqual(mockRows(mapped.tests[0].mocks), [['function', 'views.list_orders', true, ''], ['function', 'views.fetch', null, ''], ['function', 'shop.db.query', false, '']]);
});

test('resources: what a body takes, and whether it is released there, in a hook that covers it, or by pytest', async () => {
  const t = await testWith([
    'driver = webdriver.Chrome()', 'other = webdriver.Firefox()', 'other.quit()', 'log = open("a.log")', 'with open("b.log") as handle, webdriver.Edge() as edge:', '    pass',
    'os.environ["A"] = "1"', 'os.environ["B"] = "1"', 'del os.environ["B"]', 'os.environ["C"] = "1"', 'os.environ["C"] = old', 'os.environ["D"] = "1"', 'os.environ.pop("D")', 'os.environ[key] = "1"',
    'monkeypatch.setenv("E", "1")', 'patcher = patch("a.b")', 'patcher.start()', 'started = patch("a.c").start()', 'held = patch("a.d")', 'held.start()', 'held.stop()', 'patch("a.e").start()',
    'playwright = sync_playwright().start()', 'browser = playwright.chromium.launch()', 'made = browser.new_context()', 'tab = made.new_page()', 'own = context.new_page()', 'server.start()', 'mock_server.start()',
    'request.addfinalizer(log.close)', 'thread.join()',
  ], { header: `${BODY_HEADER}from playwright.sync_api import sync_playwright\n`, params: 'page, context, tmp_path, monkeypatch, mocker, capsys, request, mock_server, key, old' });
  const line = (n) => n + 15;
  assert.deepEqual(resourceRows(t.resources), [
    // The fixtures of pytest and its plugins clean up after themselves.
    [15, 'page', 'test', 'auto'], [15, 'context', 'test', 'auto'], [15, 'file', 'test', 'auto'], [15, 'patch', 'test', 'auto'], [15, 'patch', 'test', 'auto'], [15, 'global', 'test', 'auto'],
    [line(1), 'driver', 'test', 'leak'], [line(2), 'driver', 'test', 'released'],
    // `request.addfinalizer(log.close)` further down closes the file. A `with` block closes what it opens.
    [line(4), 'file', 'test', 'released'], [line(5), 'file', 'test', 'released'], [line(5), 'driver', 'test', 'released'],
    // The environment: put back by `del`, by a second write, or by `pop`. A key that is not written out is not tracked.
    [line(7), 'env', 'test', 'leak'], [line(8), 'env', 'test', 'released'], [line(10), 'env', 'test', 'released'], [line(12), 'env', 'test', 'released'], [line(15), 'env', 'test', 'auto'],
    // A patcher started by hand needs a stop. A mock that only has a method named start is no patcher.
    [line(17), 'patch', 'test', 'leak'], [line(18), 'patch', 'test', 'leak'], [line(20), 'patch', 'test', 'released'], [line(22), 'patch', 'test', 'leak'],
    [line(23), 'browser', 'test', 'leak'], [line(24), 'browser', 'test', 'leak'], [line(25), 'context', 'test', 'leak'], [line(26), 'page', 'test', 'leak'],
    // A page made from the `context` fixture is closed with it.
    [line(27), 'page', 'test', 'auto'],
  ]);

  // Hooks: tearDown covers its class, teardown_module the file, and the code after a yield its fixture.
  const model = await py([
    BODY_HEADER, 'def setup_module(module):', '    module.driver = webdriver.Chrome()', '', 'def teardown_module(module):', '    module.driver.quit()', '', '@pytest.fixture', 'def firefox():', '    browser = webdriver.Firefox()', '    yield browser',
    '    browser.quit()', '', '@pytest.fixture', 'def edge():', '    browser = webdriver.Edge()', '    return browser', '',
    'class A(unittest.TestCase):', '    def setUp(self):', '        self.driver = webdriver.Chrome()', '        self.other = webdriver.Safari()', '        self.addCleanup(self.other.quit)', '    def tearDown(self):', '        self.driver.quit()',
    '    def test_a(self):', '        self.assertTrue(self.driver.title)', '',
    'class B(unittest.TestCase):', '    def setUp(self):', '        self.driver = webdriver.Chrome()', '    def test_b(self):', '        self.driver.quit()', '',
    'shared = webdriver.Remote()', 'patch("a.b").start()', '', 'def make_driver():', '    return webdriver.Chrome()', '',
  ].join('\n'));
  const at = (n) => n + 12;
  assert.deepEqual(resourceRows(model.fileResources), [
    [at(2), 'driver', 'hook', 'released'], [at(9), 'driver', 'hook', 'released'],
    // A fixture that returns its driver has no teardown, so nothing closes it. The tearDown of class A does not cover class B.
    [at(15), 'driver', 'hook', 'leak'], [at(20), 'driver', 'hook', 'released'], [at(21), 'driver', 'hook', 'released'], [at(30), 'driver', 'hook', 'leak'],
    // At the top of the file. A helper function is not read: what it makes belongs to whoever calls it.
    [at(34), 'driver', 'file', 'leak'], [at(35), 'patch', 'file', 'leak'],
  ]);
  const hooks = [...model.fileHooks, ...model.suites.flatMap((suite) => suite.hooks)];
  assert.deepEqual(hooks.map((hook) => [hook.kind, hook.releases]), [
    ['beforeAll', []], ['afterAll', ['var:module.driver']], ['beforeEach', []], ['fixture-teardown', ['var:browser']], ['beforeEach', []],
    // `self.addCleanup(self.other.quit)` counts as a release where it is registered.
    ['beforeEach', ['var:self.other']], ['afterEach', ['var:self.driver']], ['beforeEach', []],
  ]);
  // Hooks keep their own waits, selectors and data.
  const hook = (await modelOf('selenium', 'tests/test_login.py')).suites[0].hooks[0];
  assert.deepEqual([hook.waits.map((w) => [w.kind, w.ms]), (await modelOf('playwright-python', 'tests/test_checkout.py')).fileHooks[0].selectors.length], [[['implicit-wait-config', 10000]], 3]);
  const teardown = (await modelOf('pytest', 'tests/conftest.py')).fileHooks.filter((entry) => entry.kind === 'fixture-teardown');
  assert.deepEqual(teardown.map((entry) => [entry.releases, entry.data.map((d) => d.op)]), [[['var:session'], []], [[], ['delete']]]);
});
