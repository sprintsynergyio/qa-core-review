// QCR-E001 swallowed-error, QCR-F001 focused-test and QCR-F002 skipped-test (SPEC.md Sections
// 10.8 and 10.9), on small projects written by the test. The fixture folders are checked in
// tests/rules.test.mjs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { FIX_TEXT, examplesFor, resolveConfig, runReview } from '../dist/index.js';

/** Reviews one file in a temp project and returns its findings as 'rule line level: message'. */
async function findings(file, source, { dependencies = { '@playwright/test': '^1.49.0' }, config = {}, rules = /QCR-[EF]00/ } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcr-ef-'));
  try {
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ devDependencies: dependencies }));
    fs.writeFileSync(path.join(dir, file), source.replace(/^\n/, ''));
    // QCR-N001 reports any small group of happy-path tests. It has its own tests, so it is switched off here.
    const { report } = await runReview({ root: dir, config: resolveConfig({ ...config, rules: { 'QCR-N001': 'off', ...config.rules } }).config, git: false });
    const mine = report.findings.filter((finding) => rules.test(finding.ruleId));
    return Object.assign(mine.map((finding) => `${finding.ruleId.slice(4)} ${finding.location.startLine} ${finding.severity}: ${finding.message}`), { all: mine, report });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('QCR-E001: a try block with and without rethrow, promise handlers, and soft assertions', async () => {
  const found = await findings('total.spec.ts', `
import { expect, test } from '@playwright/test';
test('hides the failure', async ({ page }) => {
  try { await expect(page.getByTestId('total')).toHaveText('$32.39'); } catch (e) { console.log('total did not match', e); }
  try { await expect(page.getByTestId('tax')).toHaveText('$2.40'); } catch {}
  await expect(page.getByTestId('promo')).toBeVisible().catch(() => {});
  await expect(page.getByTestId('fee')).toBeHidden().catch(console.error);
});
test('does not hide it', async ({ page }) => {
  try { await expect(page.getByTestId('total')).toHaveText('$32.39'); } catch (e) { throw e; }
  try { await expect(page.getByTestId('total')).toHaveText('$32.39'); } catch (e) { throw new Error('total', { cause: e }); }
  try { await expect(page.getByTestId('total')).toHaveText('$32.39'); } finally { await page.close(); }
  try { await expect(page.getByTestId('total')).toHaveText('$32.39'); } catch (e) { expect.fail('the total is wrong'); }
  try { await page.goto('/missing'); } catch (e) { expect(String(e)).toContain('404'); }
  try { await page.getByRole('button', { name: 'Accept' }).click(); } catch {}
  await expect(page.getByTestId('promo')).toBeVisible().catch((e) => { throw e; });
  await page.getByRole('button', { name: 'Dismiss' }).click().catch(() => {});
});
test('soft assertions', async ({ page }) => {
  await expect.soft(page.getByTestId('total')).toHaveText('$32.39');
  try { await expect.soft(page.getByTestId('tax')).toHaveText('$2.40'); } catch {}
  await expect(page.getByTestId('cart')).toBeVisible();
});
`);
  assert.deepEqual([...found], [
    'E001 3 error: This catch block catches the assertion failure and hides it.',
    'E001 4 error: This catch block catches the assertion failure and hides it.',
    'E001 5 error: This .catch() handler catches the assertion failure and hides it.',
    'E001 6 error: This .catch() handler catches the assertion failure and hides it.',
  ]);
  // The evidence is the check whose failure is lost. Each kind of handler has its own fix and example.
  const [block, , promise] = found.all;
  assert.deepEqual([block.evidence, block.location.startColumn, block.fix, block.goodExample], [
    "expect(page.getByTestId('total')).toHaveText('$32.39')", 3, FIX_TEXT['QCR-E001'].fix, FIX_TEXT['QCR-E001'].examples.js.good,
  ]);
  assert.deepEqual([promise.evidence, promise.fix, promise.goodExample], ["expect(page.getByTestId('promo')).toBeVisible()", FIX_TEXT['QCR-E001/promise'].fix, FIX_TEXT['QCR-E001/promise'].examples.js.good]);
  assert.equal(found.report.files[0].tests.find((entry) => entry.title === 'hides the failure').verdict, 'fail');
  assert.deepEqual(examplesFor('QCR-E001', 'typescript').map((entry) => entry.title), ['A catch block that hides a failed assertion', 'A .catch() handler that hides a failed assertion']);
});

test('QCR-F001: focused tests and suites in every runner', async () => {
  assert.deepEqual([...await findings('cart.spec.ts', `
import { expect, test } from '@playwright/test';
test.only('adds item to cart', async ({ page }) => { await expect(page).toHaveTitle('Swag Labs'); });
test.describe.only('Checkout', () => {
  test('shows the form', async ({ page }) => { await expect(page).toHaveTitle('Swag Labs'); });
});
test('shows only two items', async ({ page }) => { await expect(page).toHaveTitle('Swag Labs'); });
`)], [
    'F001 2 error: This test is focused, so the runner skips every other test.',
    'F001 3 error: This suite is focused, so the runner skips every test outside it.',
  ]);
  const jest = await findings('cart.test.js', `
fit('adds', () => { expect(1 + 1).toBe(2); });
fdescribe('Cart', () => { it('starts empty', () => { expect([]).toHaveLength(0); }); });
it.only('removes', () => { expect(2 - 1).toBe(1); });
`, { dependencies: { jest: '^29.7.0' } });
  assert.deepEqual(jest.map((line) => line.slice(0, 12)), ['F001 1 error', 'F001 2 error', 'F001 3 error']);
  // A suite finding belongs to no test. A focused test fails its own verdict.
  assert.deepEqual(jest.all.map((finding) => [finding.evidence, finding.testId === null]), [['adds', false], ['Cart', true], ['removes', false]]);
  assert.deepEqual([jest.all[0].fix, jest.all[0].goodExample], [FIX_TEXT['QCR-F001'].fix, FIX_TEXT['QCR-F001'].examples.js.good]);

  const mocha = await findings('cart.test.js', `
const { expect } = require('chai');
describe.only('Cart', () => { it.only('starts empty', () => { expect([]).to.have.length(0); }); });
`, { dependencies: { mocha: '^10.7.0', chai: '^4.5.0' } });
  const cypress = await findings('cart.cy.js', `
describe('Cart', () => { it.only('opens', () => { cy.visit('/cart.html'); cy.get('[data-test="cart-list"]').should('be.visible'); }); });
`, { dependencies: { cypress: '^13.15.0' } });
  const node = await findings('cart.test.mjs', `
import { test } from 'node:test';
import assert from 'node:assert/strict';
test('adds', { only: true }, () => { assert.equal(1 + 1, 2); });
`, { dependencies: {} });
  assert.deepEqual([mocha.map((line) => line.slice(0, 12)), cypress.map((line) => line.slice(0, 12)), node.map((line) => line.slice(0, 12))], [['F001 2 error', 'F001 2 error'], ['F001 1 error'], ['F001 3 error']]);
});

test('QCR-F002: skips with no condition, to-dos and fixme are reported; a skip on a condition is not', async () => {
  const found = await findings('login.spec.ts', `
import { expect, test } from '@playwright/test';
test.skip(process.platform === 'win32', 'File picker is not supported on Windows CI');
test.skip('rejects an empty password', async ({ page }) => { await expect(page).toHaveTitle('Swag Labs'); });
test.fixme('rejects a locked user', async ({ page }) => { await expect(page).toHaveTitle('Swag Labs'); });
test('uploads', async ({ page }) => { test.skip(); await expect(page).toHaveTitle('Swag Labs'); });
test('uploads on Chromium', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'The file picker needs Chromium');
  await expect(page).toHaveTitle('Swag Labs');
});
test('downloads', async ({ page, isMobile }) => { test.fixme(isMobile, 'Tracked in SHOP-142'); await expect(page).toHaveTitle('Swag Labs'); });
test('prints', async ({ page }) => { if (process.env.CI) test.skip(); await expect(page).toHaveTitle('Swag Labs'); });
test.describe.skip('Checkout', () => { test('pays', async ({ page }) => { await page.goto('/pay'); }); });
test.describe('Print', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Chromium only');
  test('prints a receipt', async ({ page }) => { await expect(page).toHaveTitle('Swag Labs'); });
});
test.fail('rounds the tax up', async ({ page }) => { await expect(page).toHaveTitle('Swag Labs'); });
`, { rules: /QCR-(F00|A001)/ });
  assert.deepEqual([...found], [
    'F002 3 warn: This test is skipped, and no reason is given.',
    'F002 4 warn: This test is marked fixme, so it does not run.',
    'F002 5 warn: This test is skipped, and no reason is given.',
    'F002 12 warn: This suite is skipped, so none of its tests run.',
    'F002 17 info: Expected failure: make sure this is tracked.',
  ]);
  // A group skip with a callback declares no test, and a skipped test with no assertion is reported once.
  assert.deepEqual(found.report.files[0].tests.map((entry) => entry.title).filter((title) => title.startsWith('(')), []);
  assert.deepEqual([found.all[0].fix, found.all[0].goodExample, found.all[4].fix, found.all[4].goodExample], [
    FIX_TEXT['QCR-F002'].fix, FIX_TEXT['QCR-F002'].examples.js.good, FIX_TEXT['QCR-F002/expected-failure'].fix, FIX_TEXT['QCR-F002/expected-failure'].examples.js.good,
  ]);
  // Info never changes a verdict: the expected failure still passes.
  assert.equal(found.report.files[0].tests.find((entry) => entry.title === 'rounds the tax up').verdict, 'pass');

  // The reason of a skip is part of the message (node:test options).
  assert.deepEqual([...await findings('orders.test.mjs', `
import { describe, it, test } from 'node:test';
import assert from 'node:assert/strict';
test('loads order 7', { skip: 'The orders API is down until SHOP-142 is fixed.' }, () => { assert.equal(1, 1); });
test('loads order 8', { skip: true }, () => { assert.equal(1, 1); });
test('loads order 9', { todo: 'write this after the API change' }, () => { assert.equal(1, 1); });
it.todo('loads order 10');
describe.skip('refunds', () => { it('refunds order 7', () => { assert.equal(1, 1); }); });
test('loads order 11', { skip: false }, () => { assert.equal(1, 1); });
`, { dependencies: {} })], [
    'F002 3 warn: This test is skipped: The orders API is down until SHOP-142 is fixed.',
    'F002 4 warn: This test is skipped, and no reason is given.',
    'F002 5 warn: This test is a to-do, so it checks nothing that can fail the run.',
    'F002 6 warn: This test is a to-do, so it checks nothing that can fail the run.',
    'F002 7 warn: This suite is skipped, so none of its tests run.',
  ]);

  // Jest, Mocha and Cypress forms. Vitest skipIf and runIf carry their condition, so they are not reported.
  const jest = await findings('cart.test.js', `
xit('a', () => { expect(1).toBe(1); });
xtest('b', () => { expect(1).toBe(1); });
xdescribe('C', () => { it('c', () => { expect(1).toBe(1); }); });
it.skip('d', () => { expect(1).toBe(1); });
it.todo('e');
`, { dependencies: { jest: '^29.7.0' } });
  assert.deepEqual(jest.map((line) => line.slice(0, 11)), ['F002 1 warn', 'F002 2 warn', 'F002 3 warn', 'F002 4 warn', 'F002 5 warn']);
  const mocha = await findings('cart.test.js', `
const { expect } = require('chai');
describe('Cart', () => {
  it('pending');
  it('skips itself', function () { this.skip(); expect(1).to.equal(1); });
  it('skips without an API', function () { if (!process.env.API_URL) this.skip(); expect(1).to.equal(1); });
});
`, { dependencies: { mocha: '^10.7.0', chai: '^4.5.0' } });
  assert.deepEqual(mocha.map((line) => line.slice(0, 11)), ['F002 3 warn', 'F002 4 warn']);
  assert.deepEqual([...await findings('print.test.ts', `
import { expect, it } from 'vitest';
it.skipIf(process.platform === 'win32')('prints', () => { expect(1).toBe(1); });
it.runIf(process.env.PRINTER_URL)('pings', () => { expect(1).toBe(1); });
`, { dependencies: { vitest: '^2.1.0' } })], []);
});

test('QCR-S001 reads hooks: a brittle selector in a beforeEach', async () => {
  const found = await findings('login.spec.ts', `
import { expect, test } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.goto('https://www.saucedemo.com');
  await page.locator('//div[2]/form/input[1]').fill('standard_user');
  await page.locator('.css-1q2w3e4').fill('secret_sauce');
  await page.getByTestId('login-button').click();
  await page.locator('.inventory_item').first().waitFor();
});
test('shows six products', async ({ page }) => { await expect(page.getByTestId('inventory-item')).toHaveCount(6); });
`, { rules: /QCR-S001/ });
  assert.deepEqual([...found], [
    'S001 4 warn: XPath depends on layout: //div[2]/form/input[1].',
    'S001 5 warn: Selector uses a generated name that changes from build to build: css-1q2w3e4.',
    'S001 7 info: Picks the first match of a selector that is not a role, a label or a test id, so the test depends on the order of the page.',
  ]);
  assert.ok(found.all.every((finding) => finding.testId === null));
});
