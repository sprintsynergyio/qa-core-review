// The rules on Python files (SPEC.md Sections 10 and 18, Milestone 13): a fixture folder for
// every rule that applies, with the Python fix text and example on each finding, and the
// three acceptance criteria of the milestone from end to end.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { FIX_TEXT, builtinRules, examplesFor, fixFor, resolveConfig, runReview, termFor } from '../../dist/index.js';
import { ruleFixtureFolders, runRuleFixtures } from '../helpers/fixtures.mjs';

const folders = ruleFixtureFolders().filter((entry) => entry.name.startsWith('python-'));
const reports = new Map();
/** The report of one Python fixture folder, made once. */
async function reportOf(ruleId, name) {
  const key = `${ruleId}/${name}`;
  if (!reports.has(key)) reports.set(key, await runRuleFixtures(folders.find((entry) => entry.ruleId === ruleId && entry.name === name).dir));
  return reports.get(key);
}
const finding = async (ruleId, name, file, line) => (await reportOf(ruleId, name)).report.findings.find((entry) => entry.ruleId === ruleId && entry.location.file === file && entry.location.startLine === line);

test('Python has fixtures for every rule that applies, per framework where the vocabulary differs', () => {
  const byRule = {};
  for (const { ruleId, name } of folders) (byRule[ruleId] ??= []).push(name.replace('python-', ''));
  assert.deepEqual(byRule, {
    'QCR-A001': ['pytest', 'selenium', 'unittest'], 'QCR-A002': ['pytest', 'unittest'], 'QCR-A003': ['playwright', 'pytest', 'unittest'], 'QCR-A004': ['pytest', 'unittest'],
    'QCR-C001': ['playwright', 'pytest', 'selenium'], 'QCR-D001': ['pytest'], 'QCR-E001': ['playwright', 'pytest'], 'QCR-F002': ['pytest', 'unittest'],
    'QCR-M001': ['playwright', 'pytest', 'unittest'], 'QCR-N001': ['pytest', 'unittest'], 'QCR-P001': ['pytest'], 'QCR-S001': ['playwright', 'selenium'],
    'QCR-W001': ['playwright', 'selenium'], 'QCR-X002': ['pytest'],
  });
  // QCR-F001 has none: pytest and unittest have no way to focus a test. QCR-X001 is checked on broken files, not on fixtures.
  assert.deepEqual(builtinRules.map((rule) => rule.id).filter((id) => !byRule[id]), ['QCR-F001', 'QCR-X001']);
  // Every folder is a project of its own, with a manifest that names the framework.
  for (const { dir, name } of folders) assert.match(fs.readFileSync(path.join(dir, 'requirements.txt'), 'utf8'), name.endsWith('unittest') ? /standard library/ : /pytest==/);
});

test('every Python fix text is reached by a bad fixture, and the finding carries the Python fix and example', async () => {
  const seen = new Map();
  for (const { ruleId, name } of folders) {
    const { report, bad } = await reportOf(ruleId, name);
    assert.ok(report.files.every((file) => file.language === 'python' && file.parseStatus === 'ok'), `${ruleId}/${name}`);
    for (const entry of report.findings.filter((entry) => entry.location.file.startsWith('bad/') && entry.ruleId === ruleId)) {
      const key = Object.keys(FIX_TEXT).find((candidate) => (candidate === ruleId || candidate.startsWith(`${ruleId}/`)) && fixFor(candidate, 'python').fix === entry.fix && fixFor(candidate, 'python').goodExample === entry.goodExample);
      assert.ok(key, `${ruleId}/${name} ${entry.location.file}:${entry.location.startLine}: no fix text for "${entry.fix}"`);
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    assert.ok(bad.every((entry) => entry.expected.length > 0), name);
  }
  const python = Object.keys(FIX_TEXT).filter((key) => FIX_TEXT[key].examples.python);
  assert.deepEqual([...seen.keys()].sort(), [...python].sort());
  // The cases with no Python text are the ones a Python file cannot have.
  assert.deepEqual(Object.keys(FIX_TEXT).filter((key) => !FIX_TEXT[key].examples.python), ['QCR-A003/soft', 'QCR-E001/promise', 'QCR-F001', 'QCR-P001/inline', 'QCR-P001/visual', 'QCR-C001/timers', 'QCR-C001/global']);
  // A Python example is Python: no semicolon at a line end, no braces around a block, no `await expect` outside the async API.
  for (const key of python) {
    const { bad, good } = FIX_TEXT[key].examples.python;
    for (const line of `${bad}\n${good}`.split('\n')) assert.ok(!/;\s*$|\)\s*\{\s*$|^\s*\}\s*$|=>|\bconst\b/.test(line), `${key}: ${line}`);
  }
});

test('the fix is in Python words where the general one names things Python does not have', () => {
  assert.deepEqual(fixFor('QCR-E001', 'python'), {
    fix: 'Take the assertion out of the try block, or raise the error again in the except block. To go on after a failed check, use a soft assertion (pytest-check).',
    goodExample: 'expect(page.get_by_test_id("total")).to_have_text("$32.39")',
  });
  assert.match(fixFor('QCR-C001/spy', 'python').fix, /self\.addCleanup\(patcher\.stop\)/);
  assert.match(fixFor('QCR-C001/env', 'python').fix, /monkeypatch\.setenv/);
  assert.match(fixFor('QCR-D001', 'python').fix, /@pytest\.mark\.parametrize or subTest/);
  // A key with no Python fix of its own keeps the general one, and TypeScript is not touched.
  assert.equal(fixFor('QCR-A002', 'python').fix, FIX_TEXT['QCR-A002'].fix);
  assert.equal(fixFor('QCR-E001', 'typescript').fix, FIX_TEXT['QCR-E001'].fix);
  assert.deepEqual(examplesFor('QCR-C001', 'python').map((entry) => [entry.title, entry.example !== null]), [
    ['Fake timers that are never switched back', false], ['A spy or stub that is never restored', true], ['An environment variable that is never set back', true],
    ['A global that is never put back', false], ['A browser, context, page or client that is never closed', true], ['Test data that is never deleted (info)', true],
  ]);
  assert.deepEqual([termFor('catch block', 'python'), termFor('catch block', 'typescript'), termFor('catch block', 'java'), termFor('rescue block', 'python')], ['except block', 'catch block', 'catch block', 'rescue block']);
});

test('QCR-A003 on Python: the tuple assert, the two-argument assertTrue and the mock look-alike each have their message', async () => {
  const cases = [
    ['python-pytest', 'bad/test_tuple_assert.py', 7, 'A list or an object that is written out with items is always truthy, so this check always passes.', 'collection'],
    ['python-unittest', 'bad/test_assert_true.py', 12, 'This check looks only at the first value. The second one is taken as the failure message, so the two are never compared.', 'second-value'],
    ['python-pytest', 'bad/test_mock_lookalikes.py', 10, 'This is not a check on the mock: the assertion method does not exist or is never called, so nothing is checked.', 'mock'],
    ['python-pytest', 'bad/test_mock_lookalikes.py', 17, 'This is not a check on the mock: the assertion method does not exist or is never called, so nothing is checked.', 'mock'],
    ['python-unittest', 'bad/test_counts.py', 13, 'A count is never below zero, so this check always passes.', 'count'],
    ['python-unittest', 'bad/test_counts.py', 16, 'A count is never below zero, so this check always passes.', 'count'],
    ['python-playwright', 'bad/test_not_awaited.py', 8, 'This assertion is not awaited, so the test can end before it fails.', 'unawaited'],
    ['python-playwright', 'bad/test_always_true.py', 6, 'This checks only that a locator or element object exists, and it always does. It says nothing about the page.', 'locator'],
    ['python-playwright', 'bad/test_unfinished.py', 6, 'This assertion is never finished: no matcher is called, so nothing is checked.', 'incomplete'],
    ['python-pytest', 'bad/test_never_fails.py', 13, 'This assertion is never reached: the code before it always returns or throws.', 'unreachable'],
  ];
  for (const [name, file, line, message, key] of cases) {
    const found = await finding('QCR-A003', name, file, line);
    assert.deepEqual([found?.message, found?.fix, found?.goodExample, found?.severity], [message, fixFor(`QCR-A003/${key}`, 'python').fix, FIX_TEXT[`QCR-A003/${key}`].examples.python.good, 'error'], `${file}:${line}`);
  }
  // In a JS/TS file a mock matcher that is named and never called gets the same message, with the JS example.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcr-a003-'));
  try {
    fs.writeFileSync(path.join(dir, 'package.json'), '{ "devDependencies": { "vitest": "^2.1.0" } }');
    fs.writeFileSync(path.join(dir, 'mail.test.ts'), "import { expect, it, vi } from 'vitest';\n\nit('sends the mail', () => {\n  const send = vi.fn();\n  send('a');\n  expect(send).toHaveBeenCalled;\n  expect(send);\n});\n");
    const { report } = await runReview({ root: dir, config: resolveConfig({}).config, git: false });
    assert.deepEqual(report.findings.map((entry) => [entry.location.startLine, entry.message.split(':')[0], entry.goodExample]), [
      [6, 'This is not a check on the mock', 'expect(mailer.send).toHaveBeenCalled();'], [7, 'This assertion is never finished', FIX_TEXT['QCR-A003/incomplete'].examples.js.good],
    ]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Milestone 13: except Exception around an assertion is E001, with the Python word for the handler', async () => {
  const found = await finding('QCR-E001', 'python-playwright', 'bad/test_total.py', 6);
  assert.deepEqual([found.message, found.evidence, found.severity, found.fix], [
    'This except block catches the assertion failure and hides it.', 'expect(page.get_by_test_id("total")).to_have_text("$32.39")', 'error', fixFor('QCR-E001', 'python').fix,
  ]);
  // The async API: an awaited expect inside try, with a handler that only takes a screenshot.
  assert.equal((await finding('QCR-E001', 'python-playwright', 'bad/test_async_badge.py', 9)).message, 'This except block catches the assertion failure and hides it.');
  // Not reported: a handler that raises again, one that catches another error, and try with finally only.
  const { good } = await reportOf('QCR-E001', 'python-pytest');
  assert.deepEqual(good.map((entry) => [entry.file, entry.actual]), [['good/test_logging.py', []], ['good/test_suppress.py', []], ['good/test_totals.py', []]]);
});

test('Milestone 13: yield teardown, conftest helpers and monkeypatch are read as Section 9.2 says', async () => {
  // A fixture that quits its driver after the yield is clean. One that returns the driver is reported.
  const selenium = await reportOf('QCR-C001', 'python-selenium');
  assert.deepEqual([selenium.bad.find((entry) => entry.file === 'bad/test_fixture.py').actual, selenium.good.find((entry) => entry.file === 'good/test_fixture.py').actual], [['QCR-C001@7'], []]);
  assert.equal((await finding('QCR-C001', 'python-selenium', 'bad/test_fixture.py', 7)).fix, 'Close it after the yield of a fixture, in tearDown, or with a with block, so that it is closed when the test fails too.');
  // monkeypatch.setenv is put back by pytest. monkeypatch.setattr on the function under test is over-mocking.
  const pytest = await reportOf('QCR-C001', 'python-pytest');
  assert.deepEqual([pytest.bad.find((entry) => entry.file === 'bad/test_env.py').actual, pytest.good.find((entry) => entry.file === 'good/test_env.py').actual], [['QCR-C001@7'], []]);
  const stubbed = await finding('QCR-M001', 'python-pytest', 'bad/test_discount.py', 6);
  assert.deepEqual([stubbed.message, stubbed.severity], ['apply_discount is given a fixed reply and is then called and checked, so this assertion checks the mock.', 'error']);
  // A helper in conftest.py that asserts counts as the check of the test that calls it.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcr-conftest-'));
  try {
    fs.mkdirSync(path.join(dir, 'tests'));
    fs.writeFileSync(path.join(dir, 'requirements.txt'), 'pytest==8.3.4\n');
    fs.writeFileSync(path.join(dir, 'tests', 'conftest.py'), 'def assert_total(cart, expected):\n    assert cart.total() == expected\n\n\ndef show_total(cart):\n    print(cart.total())\n');
    fs.writeFileSync(path.join(dir, 'tests', 'test_cart.py'), 'from conftest import assert_total, show_total\nfrom shop.cart import Cart\n\n\ndef test_total():\n    assert_total(Cart(), 0)\n\n\ndef test_shows_the_total():\n    show_total(Cart())\n');
    const { report } = await runReview({ root: dir, config: resolveConfig({ rules: { 'QCR-N001': 'off' } }).config, git: false });
    assert.deepEqual(report.findings.map((entry) => `${entry.location.file}:${entry.location.startLine} ${entry.ruleId}`), ['tests/test_cart.py:9 QCR-A001']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('QCR-M001 and QCR-C001 on Python: each case has a bad fixture, and every C001 bad file has a fixed twin', async () => {
  const messages = async (name) => (await reportOf('QCR-M001', name)).report.findings.filter((entry) => entry.location.file.startsWith('bad/')).map((entry) => `${entry.location.file.slice(4)}:${entry.location.startLine} ${entry.severity} ${entry.message}`);
  assert.deepEqual(await messages('python-pytest'), [
    'test_cart.py:8 error get_total is given a fixed reply and is then called and checked, so this assertion checks the mock.',
    'test_cart.py:11 error The code under test, shop.cart.Cart, is replaced by a mock, so the tests check the mock.',
    'test_checkout_flow.py:7 warn Every import of this file is mocked (shop.orders, shop.payments), so no real code runs in these tests.',
    'test_discount.py:6 error apply_discount is given a fixed reply and is then called and checked, so this assertion checks the mock.',
    'test_orders.py:7 warn The only assertion of this test checks a call on a mock. No real result is checked.',
    'test_orders.py:13 warn All 2 assertions of this test check calls on mocks. No real result is checked.',
  ]);
  assert.deepEqual(await messages('python-unittest'), [
    // `from shop import cart` and `patch.object(cart, "get_total", ...)`: the target is named as the file calls it.
    'test_cart.py:10 error cart.get_total is given a fixed reply and is then called and checked, so this assertion checks the mock.',
    // A patch on the class is a mock of every test in it.
    'test_notify.py:10 error notify is given a fixed reply and is then called and checked, so this assertion checks the mock.',
    // A patcher started in setUp: the test checks only that the mock was called.
    'test_orders.py:15 warn The only assertion of this test checks a call on a mock. No real result is checked.',
  ]);
  assert.deepEqual((await messages('python-playwright')).map((line) => line.split(', so')[0]), [
    'test_async_inventory.py:11 warn Every network request is answered by a fake (**)', 'test_cart_page.py:5 warn Every network request is answered by a fake (**/*)', 'test_orders_page.py:5 warn Every network request is answered by a fake (**/*)',
  ]);
  for (const name of ['python-playwright', 'python-pytest', 'python-selenium']) {
    const { bad, good } = await reportOf('QCR-C001', name);
    assert.deepEqual(good.map((entry) => entry.file.replace('good/', '')), bad.map((entry) => entry.file.replace('bad/', '')), `${name}: one good twin per bad file`);
  }
});
