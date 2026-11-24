// QCR-D001 duplicate-test, QCR-P001 snapshot-only and QCR-C001 missing-cleanup (SPEC.md Sections
// 10.10, 10.13 and 10.14). The fixture folders are checked in tests/rules.test.mjs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConfigError, FIX_TEXT, examplesFor, resolveConfig } from '../dist/index.js';
import { ruleFixtureFolders, runRuleFixtures } from './helpers/fixtures.mjs';
import { reviewFiles } from './helpers/temp-project.mjs';

const PLAYWRIGHT = { '@playwright/test': '^1.49.0' };
const VITEST = { vitest: '^2.1.0' };
const only = (lines, rule) => lines.filter((line) => line.includes(` ${rule} `));

test('QCR-D001: copies in one file and across two files, with the first copy in the evidence', async () => {
  const copy = "async ({ page }) => {\n  await page.goto('/cart.html');\n  await expect(page.getByTestId('cart-list')).toBeVisible();\n}";
  const { lines, findings } = await reviewFiles({
    'tests/a-cart.spec.ts': `
import { expect, test } from '@playwright/test';
test.describe('Cart', () => {
  test('opens the cart', ${copy});
  test('the cart opens', ${copy.replace('goto', ' goto').replace(/\n/g, '\n\n')}); // spaces do not matter
});
`,
    'tests/b-smoke.spec.ts': `
import { expect, test } from '@playwright/test';
test('smoke: cart', ${copy});
test('smoke: other page', async ({ page }) => {\n  await page.goto('/inventory.html');\n  await expect(page.getByTestId('cart-list')).toBeVisible();\n});
`,
    // The same body in another language is not compared.
    'tests/c-legacy.spec.js': `
const { expect, test } = require('@playwright/test');
test('legacy cart', ${copy});
`,
  }, { dependencies: PLAYWRIGHT });
  assert.deepEqual(lines, [
    'tests/a-cart.spec.ts:7 D001 warn: This test has the same body as "opens the cart" (line 3).',
    'tests/b-smoke.spec.ts:2 D001 warn: This test has the same body as "opens the cart" (tests/a-cart.spec.ts:3).',
  ]);
  // The evidence names the first copy by its file and full title. It has no line number, so it stays the same when lines move.
  assert.deepEqual(findings.map((finding) => finding.evidence), ['tests/a-cart.spec.ts > Cart > opens the cart', 'tests/a-cart.spec.ts > Cart > opens the cart']);
  assert.deepEqual([findings[0].fix, findings[0].goodExample], [FIX_TEXT['QCR-D001'].fix, FIX_TEXT['QCR-D001'].examples.js.good]);
});

test('QCR-D001: parameterized tests, short bodies and the same title', async () => {
  const { lines, findings } = await reviewFiles({
    'cart.test.ts': `
import { describe, expect, it } from 'vitest';
it.each([['backpack', 29.99], ['onesie', 7.99]])('prices %s', (id, price) => { const found = priceOf(id); expect(found).toBe(price); });
it.each([['bike-light', 9.99]])('prices %s', (id, price) => { const found = priceOf(id); expect(found).toBe(price); });
for (const id of ['backpack', 'onesie']) {
  it(\`has \${id} in stock\`, () => { const stock = stockOf(id); expect(stock).toBeGreaterThan(0); });
}
['bolt-shirt', 'fleece'].forEach((id) => {
  it(\`has \${id} in stock\`, () => { const stock = stockOf(id); expect(stock).toBeGreaterThan(0); });
});
it('is cheap', () => { expect(priceOf('onesie')).toBeLessThan(10); });
it('costs little', () => { expect(priceOf('onesie')).toBeLessThan(10); });
describe('A', () => { it('starts empty', () => { const cart = new Cart(); expect(cart.items).toHaveLength(0); }); });
describe('B', () => { it('starts empty', () => { const list = new Wishlist(); expect(list.items).toHaveLength(0); }); });
describe('C', () => {
  it('adds', () => { const cart = new Cart().add('backpack'); expect(cart.items).toHaveLength(1); });
  it('adds', () => { const cart = new Cart().add('onesie'); expect(cart.total).toBe(7.99); });
  it('adds', () => { const cart = new Cart().add('backpack'); expect(cart.items).toHaveLength(1); });
});
`,
  }, { dependencies: VITEST });
  assert.deepEqual(lines, [
    'cart.test.ts:16 D001 warn: This test has the same title as the test on line 15, so a report cannot tell the two apart.',
    // The same body and the same title: one finding, for the body.
    'cart.test.ts:17 D001 warn: This test has the same body as "adds" (line 15).',
  ]);
  assert.deepEqual([findings[0].evidence, findings[0].fix, findings[0].goodExample], ['C > adds', FIX_TEXT['QCR-D001/title'].fix, FIX_TEXT['QCR-D001/title'].examples.js.good]);
  assert.deepEqual(examplesFor('QCR-D001', 'typescript').map((entry) => entry.title), ['A test with the same body as another test', 'Two tests with the same title in one file']);
});

test('QCR-P001: warn for snapshots, info for visual checks, and an empty inline snapshot', async () => {
  const { lines, findings, report } = await reviewFiles({
    'cart.spec.ts': `
import { expect, test } from '@playwright/test';
test('snapshot only', async ({ page }) => { expect(await page.innerText('body')).toMatchSnapshot('cart.txt'); });
test('visual only', async ({ page }) => { await expect(page).toHaveScreenshot('cart.png'); });
test('two visual checks', async ({ page }) => { await expect(page).toHaveScreenshot('a.png'); await expect(page.getByTestId('footer')).toHaveScreenshot('b.png'); });
test('a snapshot and a visual check', async ({ page }) => { await expect(page).toHaveScreenshot('a.png'); await expect(page.getByTestId('cart-list')).toMatchAriaSnapshot({ name: 'cart.yml' }); });
test('a visual check and a real one', async ({ page }) => { await expect(page.getByTestId('cart-list')).toBeVisible(); await expect(page).toHaveScreenshot('a.png'); });
test('no assertion', async ({ page }) => { await page.goto('/'); });
`,
    'price.test.ts': `
import { expect, it } from 'vitest';
it('snapshot and value', () => { expect(formatPrice(1)).toBe('$1.00'); expect(formatPrice(2)).toMatchSnapshot(); });
it('empty inline with a value', () => { expect(formatPrice(1)).toBe('$1.00'); expect(formatPrice(2)).toMatchInlineSnapshot(); });
it('empty inline alone', () => { expect(formatPrice(2)).toMatchInlineSnapshot(); });
it('filled inline alone', () => { expect(formatPrice(2)).toMatchInlineSnapshot(\`"$2.00"\`); });
it('empty inline and a snapshot', () => { expect(formatPrice(2)).toMatchInlineSnapshot(); expect(formatPrice(3)).toMatchSnapshot(); });
`,
  }, { dependencies: { ...PLAYWRIGHT, ...VITEST } });
  assert.deepEqual(only(lines, 'P001'), [
    'cart.spec.ts:2 P001 warn: The only assertion of this test is a snapshot, which the first run records whatever the output is.',
    'cart.spec.ts:3 P001 info: The only assertion of this test is a visual check. That is a valid choice: make sure someone reviews each new baseline image.',
    'cart.spec.ts:4 P001 info: All 2 assertions of this test are visual checks. That is a valid choice: make sure someone reviews each new baseline image.',
    'cart.spec.ts:5 P001 warn: All 2 assertions of this test are snapshots, which the first run records whatever the output is.',
    'price.test.ts:3 P001 warn: This inline snapshot is empty, so the next run records whatever the code gives.',
    // An empty inline snapshot alone gives one finding, not two.
    'price.test.ts:4 P001 warn: This inline snapshot is empty, so the next run records whatever the code gives.',
    'price.test.ts:5 P001 warn: The only assertion of this test is a snapshot, which the first run records whatever the output is.',
    'price.test.ts:6 P001 warn: This inline snapshot is empty, so the next run records whatever the code gives.',
    'price.test.ts:6 P001 warn: All 2 assertions of this test are snapshots, which the first run records whatever the output is.',
  ]);
  const p001 = findings.filter((finding) => finding.ruleId === 'QCR-P001');
  assert.deepEqual([p001[0].evidence, p001[0].fix, p001[1].fix, p001[4].fix], ["expect(await page.innerText('body')).toMatchSnapshot('cart.txt')", FIX_TEXT['QCR-P001'].fix, FIX_TEXT['QCR-P001/visual'].fix, FIX_TEXT['QCR-P001/inline'].fix]);
  // Info does not change a verdict: a visual test passes, a snapshot-only test needs a review.
  const verdict = (title) => report.files.flatMap((file) => file.tests).find((entry) => entry.title === title).verdict;
  assert.deepEqual([verdict('visual only'), verdict('snapshot only')], ['pass', 'review']);
});

test('QCR-C001: every kind of state, hooks, and the restoreMocksConfigured option', async () => {
  const files = {
    'date.test.ts': `
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
beforeEach(() => { vi.stubEnv('TZ', 'UTC'); });
describe('leaks', () => {
  it('timers', () => { vi.useFakeTimers(); expect(formatToday()).toBe('Jan 1, 2026'); });
  it('spy', () => { const log = vi.spyOn(console, 'log'); formatToday(); expect(log).toHaveBeenCalledTimes(0); });
  it('env and globals', () => { process.env.LOCALE = 'en'; vi.stubGlobal('fetch', fake); Date.now = () => 0; expect(formatToday()).toBe('Jan 1, 1970'); });
});
describe('clean', () => {
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  it('timers and spy', () => { vi.useFakeTimers(); vi.spyOn(console, 'log'); vi.stubGlobal('fetch', fake); expect(formatToday()).toBe('Jan 1, 2026'); });
  it('restored in the test', () => { const warn = vi.spyOn(console, 'warn'); expect(formatToday()).toBe('x'); warn.mockRestore(); });
});
`,
  };
  const { lines, findings } = await reviewFiles(files, { dependencies: VITEST });
  assert.deepEqual(only(lines, 'C001'), [
    'date.test.ts:2 C001 warn: This environment variable is changed and never set back.',
    'date.test.ts:4 C001 warn: Fake timers are switched on here and never switched back.',
    'date.test.ts:5 C001 warn: This spy or stub is never restored.',
    'date.test.ts:6 C001 warn: This environment variable is changed and never set back.',
    'date.test.ts:6 C001 warn: This global is replaced and never put back.',
    'date.test.ts:6 C001 warn: This global is replaced and never put back.',
  ]);
  const c001 = findings.filter((finding) => finding.ruleId === 'QCR-C001');
  // A resource taken in a hook belongs to no test. The evidence is the line that takes it.
  assert.deepEqual(c001.map((finding) => [finding.evidence, finding.testId === null]), [
    ["vi.stubEnv('TZ', 'UTC')", true], ['vi.useFakeTimers()', false], ["vi.spyOn(console, 'log')", false], ["process.env.LOCALE = 'en'", false], ["vi.stubGlobal('fetch', fake)", false], ['Date.now = () => 0', false],
  ]);
  assert.deepEqual(c001.map((finding) => finding.fix), ['env', 'timers', 'spy', 'env', 'global', 'global'].map((key) => FIX_TEXT[`QCR-C001/${key}`].fix));
  assert.equal(c001[1].goodExample, FIX_TEXT['QCR-C001/timers'].examples.js.good);
  // restoreMocksConfigured: the runner config restores spies, so they are not reported. Nothing else changes.
  const configured = await reviewFiles(files, { dependencies: VITEST, config: { rules: { 'QCR-C001': { restoreMocksConfigured: true } } } });
  assert.deepEqual(only(configured.lines, 'C001').map((line) => line.split(' ')[0]), ['date.test.ts:2', 'date.test.ts:4', 'date.test.ts:6', 'date.test.ts:6', 'date.test.ts:6']);
  // The option is a yes or no.
  assert.throws(() => resolveConfig({ rules: { 'QCR-C001': { restoreMocksConfigured: 'yes' } } }), (error) => error instanceof ConfigError && error.problems[0].pointer === '/rules/QCR-C001/restoreMocksConfigured');
});

test('QCR-C001: browsers, contexts and API clients, and test data as info', async () => {
  const { lines, findings } = await reviewFiles({
    'shop.spec.ts': `
import { chromium, expect, request, test } from '@playwright/test';
test('own browser', async () => { const browser = await chromium.launch(); const page = await browser.newPage(); await expect(page).toHaveTitle('Swag Labs'); });
test('own browser, closed', async () => { const browser = await chromium.launch(); try { await expect(await browser.newPage()).toHaveTitle('Swag Labs'); } finally { await browser.close(); } });
test('own context', async ({ browser }) => { const admin = await browser.newContext(); await expect(await admin.newPage()).toHaveTitle('Swag Labs'); });
test('fixtures', async ({ page, context }) => { const tab = await context.newPage(); await expect(tab).toHaveTitle('Swag Labs'); await expect(page).toHaveTitle('Swag Labs'); });
test('api client', async () => { const api = await request.newContext(); expect((await api.get('/orders')).ok()).toBe(true); });
test('api client, disposed', async () => { const api = await request.newContext(); expect((await api.get('/orders')).status()).toBe(200); await api.dispose(); });
test('creates', async ({ request }) => { const created = await request.post('/orders', { data: {} }); expect(created.status()).toBe(201); });
test('creates and deletes', async ({ request }) => { const created = await request.post('/orders', { data: { id: 1 } }); expect(created.status()).toBe(201); await request.delete('/orders/1'); });
test('reads', async ({ request }) => { const list = await request.get('/orders'); expect(list.status()).toBe(200); });
`,
    // With an after hook in the file, the tool cannot see what the hook deletes, so it says nothing.
    'orders.spec.ts': `
import { expect, test } from '@playwright/test';
test.afterEach(async ({ request }) => { await request.delete('/orders/all'); });
test('creates', async ({ request }) => { const created = await request.post('/orders', { data: { item: 1 } }); expect(created.status()).toBe(201); });
`,
  }, { dependencies: PLAYWRIGHT });
  assert.deepEqual(only(lines, 'C001'), [
    'shop.spec.ts:2 C001 warn: This browser is opened and never closed.',
    'shop.spec.ts:2 C001 warn: This page is opened and never closed.',
    'shop.spec.ts:4 C001 warn: This browser context is opened and never closed.',
    'shop.spec.ts:4 C001 warn: This page is opened and never closed.',
    'shop.spec.ts:6 C001 warn: This API client is created and never disposed.',
    'shop.spec.ts:8 C001 info: This test creates data over HTTP and never deletes it.',
  ]);
  const data = findings.find((finding) => finding.severity === 'info');
  assert.deepEqual([data.confidence, data.evidence, data.fix, data.goodExample], ['low', "request.post('/orders', { data: {} })", FIX_TEXT['QCR-C001/data'].fix, FIX_TEXT['QCR-C001/data'].examples.js.good]);
  assert.equal(examplesFor('QCR-C001', 'typescript').length, 6);
});

test('QCR-C001: every case has a bad fixture, and every bad fixture has a fixed twin of the same name', async () => {
  const seen = new Set();
  const folders = ruleFixtureFolders().filter((entry) => entry.ruleId === 'QCR-C001');
  assert.deepEqual(folders.map((entry) => entry.name), ['javascript-mocha', 'typescript-jest', 'typescript-playwright', 'typescript-vitest']);
  for (const { name, dir } of folders) {
    const { bad, good, report } = await runRuleFixtures(dir);
    assert.deepEqual(good.map((entry) => entry.file.replace('good/', '')), bad.map((entry) => entry.file.replace('bad/', '')), `${name}: one good twin per bad file`);
    assert.ok(bad.every((entry) => entry.expected.length > 0) && good.every((entry) => entry.actual.length === 0), name);
    for (const finding of report.findings) seen.add(Object.keys(FIX_TEXT).find((key) => key.startsWith('QCR-C001/') && FIX_TEXT[key].fix === finding.fix));
  }
  assert.deepEqual([...seen].sort(), Object.keys(FIX_TEXT).filter((key) => key.startsWith('QCR-C001/')).sort());
});
