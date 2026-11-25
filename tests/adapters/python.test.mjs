// The Python adapter (SPEC.md Sections 9.2 and 17): golden models, framework detection,
// vocabulary coverage, capabilities and robustness. This file covers the structure of a test
// file: suites, tests, hooks and fixtures, marks, parametrize, imports and suppressions.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { PYTHON_VOCAB_SURFACE, createRegistry, createTreeSitterService, pythonAdapter, readAsset } from '../../dist/index.js';
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
    'playwright-python/tests/test_menu.py': ['pytest', ['playwright-python'], 'medium'], // no import: the project's pytest, and the `page` fixture
    'pytest/tests/conftest.py': ['pytest', [], 'high'],
    'pytest/tests/helpers/pages.py': ['pytest', [], 'medium'], // a support file: the runner of its project
    'pytest/tests/test_broken.py': ['pytest', [], 'high'],
    'pytest/tests/test_cart.py': ['pytest', [], 'high'],
    'pytest/tests/test_orders.py': ['pytest', [], 'high'], // `from pytest import fixture, mark`
    'selenium/tests/test_login.py': ['unittest', ['selenium'], 'high'], // a TestCase class, and no pytest in the project
    'selenium/tests/test_search.py': ['pytest', ['selenium'], 'high'], // the file imports pytest itself
    'unittest/tests/test_cart.py': ['unittest', [], 'high'],
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
  const missing = PYTHON_VOCAB_SURFACE.filter((entry) => !new RegExp(`(?<![\\w])${entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w])`).test(all));
  assert.deepEqual(missing, []);
  assert.equal(new Set(PYTHON_VOCAB_SURFACE).size, PYTHON_VOCAB_SURFACE.length);
  assert.ok(PYTHON_VOCAB_SURFACE.length >= 50, String(PYTHON_VOCAB_SURFACE.length));
});

test('every capability the adapter declares is filled in at least one golden', async () => {
  const all = [];
  for (const framework of FRAMEWORKS) all.push(...(await modelsOf(framework)).map((entry) => entry.model));
  // The structure of a file. The capabilities for what a body checks and does are not declared yet, so no rule that needs them runs.
  assert.deepEqual(pythonAdapter.capabilities, ['tests', 'suites', 'hooks', 'modifiers', 'parameterized', 'body-hash']);
  for (const capability of pythonAdapter.capabilities) {
    assert.ok(all.some((model) => capabilityFilled(capability, model)), `no golden fills "${capability}"`);
    assert.ok(all.every((model) => model.capabilities.includes(capability)));
  }
  // Nothing is filled in that the adapter does not declare.
  for (const model of all) {
    assert.deepEqual([model.subject, model.fileMocks, model.fileResources], [null, [], []], model.path);
    for (const t of model.tests) assert.deepEqual([t.assertions, t.waits, t.selectors, t.tryBlocks, t.mocks, t.resources, t.data, t.steps], [[], [], [], [], [], [], [], []], t.fullTitle);
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

test('robustness: with a missing grammar the file is listed as failed, with nothing claimed about it', async () => {
  const parser = createTreeSitterService({ readAsset: (name) => (name.endsWith('python.wasm') ? (() => { throw new Error('gone'); })() : readAsset(name)) });
  const model = await py('import pytest\n\ndef test_a():\n    assert True\n', 'tests/test_a.py', { parser });
  assert.deepEqual([model.parseStatus, model.capabilities, model.role, model.tests, model.runner], ['failed', [], 'test', [], 'pytest']);
  assert.equal((await py('x = 1\n', 'tests/conftest.py', { parser })).role, 'support');
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
