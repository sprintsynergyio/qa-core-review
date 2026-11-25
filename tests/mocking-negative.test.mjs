// QCR-M001 over-mocking and QCR-N001 missing-negative-case (SPEC.md Sections 10.12 and 10.11),
// the hook data that QCR-C001 reads, and the support matrix script. The fixture folders are
// checked in tests/rules.test.mjs.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ConfigError, FIX_TEXT, builtinRules, examplesFor, pythonAdapter, resolveConfig } from '../dist/index.js';
import { reviewFiles } from './helpers/temp-project.mjs';

const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const VITEST = { vitest: '^2.1.0' };
const JEST = { jest: '^29.7.0' };
const only = (lines, rule) => lines.filter((line) => line.includes(` ${rule} `));
const keyOf = (finding) => Object.keys(FIX_TEXT).find((key) => key.startsWith(finding.ruleId) && FIX_TEXT[key].fix === finding.fix);

test('QCR-M001: the module under test is found for ./x, ../src/x and subjectMap, and a mock that keeps the real module is fine', async () => {
  const body = "it('returns the total', () => { expect(getTotal([{ price: 40 }, { price: 2 }])).toBe(42); });\n";
  const { lines, findings } = await reviewFiles({
    'src/cart.test.ts': `import { expect, it, vi } from 'vitest';\nimport { getTotal } from './cart';\nvi.mock('./cart', () => ({ getTotal: vi.fn(() => 42) }));\n${body}`,
    'tests/cart.test.ts': `import { expect, it, vi } from 'vitest';\nimport { getTotal } from '../src/cart';\nvi.mock('../src/cart');\n${body}`,
    'tests/cart.spec.js': `const { getTotal } = require('../src/cart.js');\njest.mock('../src/cart');\n${body}`,
    // The real module is kept, so nothing is replaced: importActual, requireActual, importOriginal.
    'tests/kept/cart.test.ts': `import { expect, it, vi } from 'vitest';\nimport { getTotal } from '../../src/cart';\nvi.mock('../../src/cart', async () => ({ ...(await vi.importActual('../../src/cart')), round: (n) => n }));\n${body}`,
    'tests/kept/orders.test.js': `import { getTotal } from '../../src/orders';\njest.mock('../../src/orders', () => ({ ...jest.requireActual('../../src/orders'), nextId: () => 7 }));\n${body}`,
    'tests/kept/tax.test.ts': `import { expect, it, vi } from 'vitest';\nimport { getTotal } from '../../src/tax';\nvi.mock('../../src/tax', async (importOriginal) => ({ ...(await importOriginal()), rate: () => 0 }));\n${body}`,
    // A dependency is mocked, not the module under test.
    'tests/deps/cart.test.ts': `import { expect, it, vi } from 'vitest';\nimport { getTotal } from '../../src/cart';\nimport { taxRate } from '../../src/tax';\nvi.mock('../../src/tax');\n${body}`,
    // The file name matches no import, so the module under test is not known: cases 1 and 2 stay quiet.
    'tests/unknown/totals.test.ts': `import { expect, it, vi } from 'vitest';\nimport { getTotal } from '../../src/cart';\nimport { taxRate } from '../../src/tax';\nvi.mock('../../src/cart');\nit('stubs and calls', () => { const total = vi.fn().mockReturnValue(42); expect(total()).toBe(42); expect(taxRate()).toBe(0); });\n`,
    // subjectMap names the module for the files of a folder.
    'tests/mapped/totals.test.ts': `import { expect, it, vi } from 'vitest';\nimport { getTotal } from '../../src/cart';\nimport { taxRate } from '../../src/tax';\nvi.mock('../../src/cart');\nit('stubs and calls', () => { const total = vi.fn().mockReturnValue(42); expect(total()).toBe(42); expect(taxRate()).toBe(0); });\n`,
  }, { dependencies: { ...VITEST, ...JEST }, config: { rules: { 'QCR-M001': { subjectMap: { 'tests/mapped/**': '../../src/cart' } } } } });
  assert.deepEqual(only(lines, 'M001'), [
    'src/cart.test.ts:3 M001 error: The code under test, ./cart, is replaced by a mock, so the tests check the mock.',
    'tests/cart.spec.js:2 M001 error: The code under test, ../src/cart, is replaced by a mock, so the tests check the mock.',
    'tests/cart.test.ts:3 M001 error: The code under test, ../src/cart, is replaced by a mock, so the tests check the mock.',
    'tests/mapped/totals.test.ts:4 M001 error: The code under test, ../../src/cart, is replaced by a mock, so the tests check the mock.',
    'tests/mapped/totals.test.ts:5 M001 error: total is given a fixed reply and is then called and checked, so this assertion checks the mock.',
  ]);
  const first = findings.find((finding) => finding.ruleId === 'QCR-M001');
  assert.deepEqual([first.testId, first.evidence, first.fix, first.goodExample], [null, "vi.mock('./cart', () => ({ getTotal: vi.fn(() => 42) }))", FIX_TEXT['QCR-M001/subject'].fix, FIX_TEXT['QCR-M001/subject'].examples.js.good]);
  // subjectMap is a map from a glob to a module name.
  assert.throws(() => resolveConfig({ rules: { 'QCR-M001': { subjectMap: ['tests/**'] } } }), (error) => error instanceof ConfigError && error.problems[0].pointer === '/rules/QCR-M001/subjectMap');
});

test('QCR-M001: a stubbed function that is called and checked, and tests that check only calls on mocks', async () => {
  const { lines, findings, report } = await reviewFiles({
    'tests/user.test.ts': `
import { afterEach, expect, it, vi } from 'vitest';
import { UserService, api } from '../src/user';
import { send } from '../src/mailer';
vi.mock('../src/mailer');
afterEach(() => { vi.restoreAllMocks(); });
it('checks a named mock', async () => { const getUser = vi.fn().mockResolvedValue({ id: 7 }); expect(await getUser(7)).toEqual({ id: 7 }); });
it('checks a mock with an implementation', () => { const total = vi.fn(() => 42); expect(total()).toBe(42); });
it('checks a stubbed method', () => { vi.spyOn(api, 'getUser').mockReturnValue({ id: 1 }); expect(api.getUser(1)).toEqual({ id: 1 }); });
it('checks a replaced property', () => { api.find = vi.fn(() => []); expect(api.find('sam')).toHaveLength(0); });
it('stubs later', () => { const load = vi.fn(); load.mockReturnValue(3); expect(load()).toBe(3); });
it('uses a mock as a dependency', async () => {
  const http = { get: vi.fn().mockResolvedValue({ id: 7 }) };
  const getUser = vi.fn(async () => ({ id: 8 }));
  expect(await new UserService(http, getUser).getUser(7)).toEqual({ id: 7 });
  expect(getUser).toHaveBeenCalledWith(7);
  expect(getUser.mock.calls[0][0]).toBe(7);
});
it('a spy that calls through', () => { vi.spyOn(api, 'getUser'); expect(api.getUser(1)).toEqual({ id: 1, name: 'Sam' }); });
it('checks only calls', async () => { await new UserService().welcome(7); expect(send).toHaveBeenCalledTimes(1); expect(send).toHaveBeenCalledWith(7); });
it('checks a call and a result', async () => { expect(await new UserService().welcome(7)).toBe(true); expect(send).toHaveBeenCalledTimes(1); });
it('watches a plain callback', async () => { const done = vi.fn(); await new UserService().welcome(7, done); expect(done).toHaveBeenCalledWith(7); });
`,
    // No mock stands in for real code here: a callback and a spy that calls through only watch.
    'tests/debounce.test.ts': `
import { expect, it, vi } from 'vitest';
import { debounce } from '../src/debounce';
it('calls once', () => { const save = vi.fn(); debounce(save, 300)(); expect(save).toHaveBeenCalledTimes(1); });
it('logs once', () => { const log = vi.spyOn(console, 'log'); debounce(() => {}, 300)(); expect(log).toHaveBeenCalledTimes(1); log.mockRestore(); });
`,
  }, { dependencies: VITEST });
  assert.deepEqual(only(lines, 'M001'), [
    'tests/user.test.ts:6 M001 error: getUser is given a fixed reply and is then called and checked, so this assertion checks the mock.',
    'tests/user.test.ts:7 M001 error: total is given a fixed reply and is then called and checked, so this assertion checks the mock.',
    'tests/user.test.ts:8 M001 error: api.getUser is given a fixed reply and is then called and checked, so this assertion checks the mock.',
    'tests/user.test.ts:9 M001 error: api.find is given a fixed reply and is then called and checked, so this assertion checks the mock.',
    'tests/user.test.ts:10 M001 error: load is given a fixed reply and is then called and checked, so this assertion checks the mock.',
    'tests/user.test.ts:19 M001 warn: All 2 assertions of this test check calls on mocks. No real result is checked.',
  ]);
  const m001 = findings.filter((finding) => finding.ruleId === 'QCR-M001');
  assert.deepEqual([keyOf(m001[0]), m001[0].evidence, keyOf(m001[5]), m001[5].evidence], ['QCR-M001/stubbed', 'expect(await getUser(7)).toEqual({ id: 7 })', 'QCR-M001/calls-only', 'expect(send).toHaveBeenCalledTimes(1)']);
  // An error fails the test. A warn asks for a review.
  const verdict = (title) => report.files.flatMap((file) => file.tests).find((entry) => entry.title === title).verdict;
  assert.deepEqual([verdict('checks a named mock'), verdict('checks only calls'), verdict('watches a plain callback')], ['fail', 'review', 'pass']);
  assert.equal(examplesFor('QCR-M001', 'typescript').length, 5);
});

test('QCR-M001: every import mocked, and every network request faked', async () => {
  const { lines, findings } = await reviewFiles({
    'tests/flow.test.ts': `
import { expect, it } from '@jest/globals';
import type { Order } from '../src/types';
import { placeOrder } from '../src/orders';
import { charge } from '../src/payments';
jest.mock('../src/orders');
jest.mock('../src/payments');
it('places an order', async () => { const order: Order = { id: 7 }; expect(await placeOrder(order)).toBeUndefined(); });
`,
    // One module stays real, or one mock keeps the real module: not everything is mocked.
    'tests/partial.test.ts': `
import { placeOrder } from '../src/orders';
import { charge } from '../src/payments';
import { send } from '../src/mailer';
jest.mock('../src/payments');
jest.mock('../src/mailer', () => ({ ...jest.requireActual('../src/mailer'), send: jest.fn() }));
it('places an order', async () => { expect(await placeOrder({ id: 7 })).toEqual({ id: 7, paid: true }); });
`,
    'e2e/cart.spec.ts': `
import { expect, test } from '@playwright/test';
test('fakes everything', async ({ page }) => {
  await page.route('**/*', (route) => route.fulfill({ json: { items: [] } }));
  await page.goto('/cart.html');
  await expect(page.getByTestId('cart-list')).toBeVisible();
});
test('fakes one endpoint', async ({ page }) => {
  await page.route('**/api/cart', (route) => route.fulfill({ json: { items: [] } }));
  await expect(page.getByTestId('cart-list')).toBeVisible();
});
test('lets requests go on', async ({ page }) => {
  await page.route('**/*', (route) => route.continue());
  await expect(page.getByTestId('cart-list')).toBeVisible();
});
test('fakes everything and checks no page', async ({ page }) => {
  const seen = [];
  await page.route('**', (route) => { seen.push(route.request().url()); return route.fulfill({ body: '' }); });
  await page.goto('/cart.html');
  expect(seen).toHaveLength(1);
});
`,
    'cypress/e2e/cart.cy.js': `
it('fakes everything', () => { cy.intercept('**', { fixture: 'cart.json' }); cy.visit('/cart.html'); cy.get('[data-test="cart-list"]').should('be.visible'); });
it('fakes one call and waits for an error', () => { cy.intercept('GET', '/api/cart', { items: [] }); cy.visit('/cart.html'); cy.get('[data-test="error"]').should('not.exist'); });
`,
  }, { dependencies: { ...JEST, '@playwright/test': '^1.49.0', cypress: '^13.15.0' } });
  assert.deepEqual(only(lines, 'M001'), [
    'cypress/e2e/cart.cy.js:1 M001 warn: Every network request is answered by a fake (**), so the checks on the page check the fake data.',
    'e2e/cart.spec.ts:3 M001 warn: Every network request is answered by a fake (**/*), so the checks on the page check the fake data.',
    'tests/flow.test.ts:5 M001 warn: Every import of this file is mocked (../src/orders, ../src/payments), so no real code runs in these tests.',
  ]);
  assert.deepEqual(findings.filter((finding) => finding.ruleId === 'QCR-M001').map((finding) => [keyOf(finding), finding.testId === null]), [['QCR-M001/network', false], ['QCR-M001/network', false], ['QCR-M001/everything', true]]);
});

test('QCR-N001: once per group with happy paths only, never on a group with an error case, with 2 or 3 suggestions', async () => {
  const ok = (title, value) => `  it('${title}', () => { expect(run('${title}')).toBe(${value}); });\n`;
  const { lines, findings, report } = await reviewFiles({
    'tests/discount.test.ts': `
import { describe, expect, it } from 'vitest';
describe('applyDiscount', () => {
${ok('applies 10% off', 90)}${ok('applies 20% off', 80)}${ok('applies no code', 100)}});
describe('checkout', () => {
${ok('shows the form', 1)}${ok('shows the total', 2)}});
describe('Login', () => {
  describe('with a password', () => {
${ok('lets a user in', 1)}${ok('lets an admin in', 2)}  });
  describe('with a token', () => {
${ok('lets a user in', 3)}${ok('keeps a locked user out', 4)}  });
});
describe('one test is no group', () => {
${ok('works', 1)}});
// A group with an error case, found in four ways.
describe('by a word in a title', () => {
${ok('adds an item', 1)}${ok('rejectsUnknownCode', 2)}});
describe('by a snake case title', () => {
${ok('adds_an_item', 1)}${ok('user_not_found', 2)}});
describe('by an expected exception', () => {
${ok('adds an item', 1)}  it('knows three currencies', () => { expect(() => format(1, 'XXX')).toThrow(); });
});
describe('by a status code', () => {
${ok('lists the orders', 1)}  it('reads an order that is not there', async () => { expect((await api.get('/orders/9')).status).toBe(404); });
});
describe('by the text of an assertion', () => {
${ok('shows the form', 1)}  it('needs a first name', () => { expect(submit({})).toEqual({ message: 'First Name is required' }); });
});
describe('validation errors', () => {
${ok('shows a message', 1)}${ok('keeps the form open', 2)}});
`,
    // Tests in no suite are one group, named by the file.
    'tests/search.spec.ts': `
import { expect, test } from '@playwright/test';
test('finds a backpack', async ({ page }) => { await expect(page.getByTestId('item')).toHaveCount(1); });
test('finds two shirts', async ({ page }) => { await expect(page.getByTestId('item')).toHaveCount(2); });
`,
  }, { dependencies: { ...VITEST, '@playwright/test': '^1.49.0' } });
  assert.deepEqual(only(lines, 'N001'), [
    'tests/discount.test.ts:2 N001 info: All 3 tests of "applyDiscount" are happy paths. Cases to think about: applyDiscount with an unknown code; applyDiscount with an expired code; applyDiscount with a negative amount.',
    'tests/discount.test.ts:7 N001 info: All 2 tests of "checkout" are happy paths. Cases to think about: checkout with an empty cart; checkout with a missing postal code; checkout with a payment that is declined.',
    // "admin" has "min" inside it. It is not an error word.
    'tests/discount.test.ts:12 N001 info: All 2 tests of "with a password" are happy paths. Cases to think about: with a password with a wrong password; with a password with a locked user; with a password with an expired session.',
    'tests/search.spec.ts:2 N001 info: All 2 tests of this file are happy paths. Cases to think about: search with a search with no results; search with an empty search text; search with a very long search text.',
  ]);
  const n001 = findings.filter((finding) => finding.ruleId === 'QCR-N001');
  for (const finding of n001) {
    const suggestions = finding.message.split('Cases to think about: ')[1].split('; ');
    assert.ok(suggestions.length >= 2 && suggestions.length <= 3, finding.message);
    assert.deepEqual([finding.severity, finding.confidence, finding.testId, finding.fix, finding.goodExample], ['info', 'low', null, FIX_TEXT['QCR-N001'].fix, FIX_TEXT['QCR-N001'].examples.js.good]);
  }
  assert.deepEqual(n001.map((finding) => finding.evidence), ['applyDiscount', 'checkout', 'with a password', 'search']);
  // Info with low confidence never changes a verdict.
  assert.ok(report.files.flatMap((file) => file.tests).every((entry) => entry.verdict === 'pass'));

  // A title the rule does not know gets the three general cases.
  const other = await reviewFiles({ 'tests/widget.test.js': "it('renders', () => { expect(render()).toBe(1); });\nit('renders twice', () => { expect(render()).toBe(1); });\n" }, { dependencies: JEST });
  assert.deepEqual(only(other.lines, 'N001'), ['tests/widget.test.js:1 N001 info: All 2 tests of this file are happy paths. Cases to think about: widget with empty input; widget with invalid input; widget with a server error.']);
});

test('QCR-C001 reads what a hook deletes: an after hook around the test counts, one in another suite does not', async () => {
  const create = (id) => `async ({ request }) => { const made = await request.post('/orders', { data: { id: ${id} } }); expect(made.status()).toBe(201); }`;
  const { lines } = await reviewFiles({
    'cleaned.spec.ts': `
import { expect, test } from '@playwright/test';
test.afterEach(async ({ request }) => { await request.delete('/orders/all'); });
test('creates', ${create(1)});
test.describe('inside a suite', () => { test('creates too', ${create(2)}); });
`,
    'other-suite.spec.ts': `
import { expect, test } from '@playwright/test';
test.describe('A', () => {
  test.afterEach(async ({ request }) => { await request.delete('/orders/all'); });
  test('creates', ${create(3)});
});
test.describe('B', () => {
  test.afterEach(async ({ page }) => { await page.close(); });
  test('creates', ${create(4)});
});
`,
  }, { dependencies: { '@playwright/test': '^1.49.0' } });
  assert.deepEqual(only(lines, 'C001'), ['other-suite.spec.ts:8 C001 info: This test creates data over HTTP and never deletes it.']);
});

test('the support matrix in docs/rules.md is made from the code and checked by lint', () => {
  const script = path.join(repo, 'scripts/gen-support-matrix.mjs');
  const run = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
  const fresh = run('--check');
  assert.deepEqual([fresh.status, fresh.stdout.trim()], [0, `support matrix ok (${builtinRules.length} rules)`]);
  const docs = fs.readFileSync(path.join(repo, 'docs/rules.md'), 'utf8');
  const matrix = docs.slice(docs.indexOf('<!-- support-matrix:start -->'), docs.indexOf('<!-- support-matrix:end -->')).split('\n').filter((line) => line.startsWith('| [QCR-'));
  assert.deepEqual(matrix.map((line) => line.slice(3, 11)), builtinRules.map((rule) => rule.id));
  // JS/TS fills every capability. Python says yes where its adapter fills what the rule needs. Java is not built yet.
  const python = (rule) => (rule.requires.every((need) => pythonAdapter.capabilities.includes(need)) ? 'yes' : 'no');
  assert.deepEqual(matrix.map((line) => line.split(' | ').slice(-3).join(' | ')), builtinRules.map((rule) => `yes | ${python(rule)} | planned |`));
  // The top table has every rule too, with the qa-core-verify column.
  for (const rule of builtinRules) assert.match(docs, new RegExp(`\\| \\[${rule.id}\\]\\(#${rule.id.toLowerCase()}\\) \\| ${rule.name} \\| .* \\| (QCV-W\\d{3}.*|none|locator checks) \\|`));

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcr-matrix-'));
  try {
    const stale = path.join(dir, 'rules.md');
    fs.writeFileSync(stale, '# Rules\n\n<!-- support-matrix:start -->\n| old |\n<!-- support-matrix:end -->\n');
    const behind = run('--check', '--file', stale);
    assert.equal(behind.status, 1);
    assert.match(behind.stderr, /is behind the code\. Run: npm run build && node scripts\/gen-support-matrix\.mjs/);
    assert.match(fs.readFileSync(stale, 'utf8'), /\| old \|/);
    assert.deepEqual([run('--file', stale).status, run('--check', '--file', stale).status], [0, 0]);
    fs.writeFileSync(stale, '# Rules\n');
    assert.equal(run('--check', '--file', stale).status, 2);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
