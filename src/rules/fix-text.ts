// The fix and the examples of each rule, per language (SPEC.md Section 10.0), so that a finding
// in a TypeScript file suggests TypeScript and one in a Python file suggests Python. A key is a
// rule id, or a rule id and a sub-case. The Python and Java texts arrive with those adapters;
// until then such a file gets the general fix and no example.
import type { LanguageId } from '../model/types.js';

type Family = 'js';
const FAMILY: Partial<Record<LanguageId, Family>> = { javascript: 'js', typescript: 'js' };

interface Example { bad: string; good: string }
interface Entry {
  /** What the sub-case is, for `explain` and the docs. */
  title: string;
  /** The fix in words that fit any language. */
  fix: string;
  examples: Partial<Record<Family, Example>>;
}

const SELECTOR_FIX = 'Prefer role, label or test id selectors. For Playwright suites, qa-core-heal can repair many broken locators at once.';

export const FIX_TEXT: Readonly<Record<string, Entry>> = {
  'QCR-A001': {
    title: 'A test with no assertion',
    fix: 'Add an assertion that checks the result of the action, for example the URL, a visible element or the response body.',
    examples: { js: {
      bad: "test('user can log in', async ({ page }) => {\n  await page.goto('https://www.saucedemo.com');\n  await page.getByRole('button', { name: 'Login' }).click();\n});",
      good: "test('user can log in', async ({ page }) => {\n  await page.goto('https://www.saucedemo.com');\n  await page.getByRole('button', { name: 'Login' }).click();\n  await expect(page).toHaveURL(/inventory\\.html/);\n});",
    } },
  },
  'QCR-A002': {
    title: 'An assertion whose result is fixed by the code itself',
    fix: 'Check a value that the code under test produced, against the value you expect.',
    examples: { js: { bad: 'expect(true).toBe(true);\nexpect(cart.total()).toBe(cart.total());', good: 'expect(cart.items).toContainEqual(item);\nexpect(cart.total()).toBe(29.99);' } },
  },
  'QCR-A003/incomplete': {
    title: 'An assertion that is started and never finished',
    fix: 'Finish the assertion by calling a matcher.',
    examples: { js: { bad: "expect(page.getByText('Products'));\nexpect(total).toBeTruthy;", good: "await expect(page.getByText('Products')).toBeVisible();\nexpect(total).toBeTruthy();" } },
  },
  'QCR-A003/unreachable': {
    title: 'An assertion after a return or a throw',
    fix: 'Move the assertion before the return or throw, or remove the early exit.',
    examples: { js: { bad: 'return;\nexpect(cart.items).toHaveLength(1);', good: 'expect(cart.items).toHaveLength(1);\nreturn;' } },
  },
  'QCR-A003/unawaited': {
    title: 'An async assertion that is not awaited',
    fix: 'Put await before the assertion, or return it from the test.',
    examples: { js: {
      bad: "expect(page.getByRole('button', { name: 'Checkout' })).toBeVisible();\nexpect(loadCart('c-1')).resolves.toHaveProperty('items');",
      good: "await expect(page.getByRole('button', { name: 'Checkout' })).toBeVisible();\nawait expect(loadCart('c-1')).resolves.toHaveProperty('items');",
    } },
  },
  'QCR-A003/locator': {
    title: 'A check that a locator object exists',
    fix: 'Check what the element shows or does, for example that it is visible or has the right text.',
    examples: { js: { bad: "expect(page.locator('#checkout')).toBeTruthy();", good: "await expect(page.locator('#checkout')).toBeVisible();" } },
  },
  'QCR-A003/count': {
    title: 'A count compared with zero in a way that is always true',
    fix: 'Compare the count with the number you expect, or check that it is greater than zero.',
    examples: { js: { bad: 'expect(await rows.count()).toBeGreaterThanOrEqual(0);', good: 'await expect(rows).toHaveCount(3);' } },
  },
  'QCR-A003/collection': {
    title: 'A list or object literal checked for being truthy',
    fix: 'Check the value itself. A list or an object that is written out is always truthy.',
    examples: { js: { bad: 'expect([cart.total(), 42]).toBeTruthy();', good: 'expect(cart.total()).toBe(42);' } },
  },
  'QCR-A004': {
    title: 'Every assertion is inside a condition, a loop or a callback',
    fix: 'Assert without the condition, or first check that there is something to check: for example the length of the list before the loop.',
    examples: { js: {
      bad: "const error = page.getByTestId('error');\nif (await error.isVisible()) {\n  await expect(error).toContainText('locked out');\n}",
      good: "await expect(page.getByTestId('error')).toContainText('locked out');",
    } },
  },
  'QCR-W001': {
    title: 'A fixed sleep',
    fix: 'Wait for a condition instead: a web-first assertion, an explicit wait (WebDriverWait, waitForResponse) or a polling helper. For timing failures that come and go, see qa-core-flaky.',
    examples: { js: {
      bad: "await page.getByRole('button', { name: 'Add to cart' }).click();\nawait page.waitForTimeout(3000);\nawait expect(page.getByTestId('shopping-cart-badge')).toHaveText('1');",
      good: "await page.getByRole('button', { name: 'Add to cart' }).click();\nawait expect(page.getByTestId('shopping-cart-badge')).toHaveText('1');",
    } },
  },
  'QCR-W001/implicit': {
    title: 'A long implicit wait (info)',
    fix: 'Keep the implicit wait at 0 or short, and wait for each condition where the test needs it.',
    examples: { js: {
      bad: 'await browser.setTimeout({ implicit: 10000 });',
      good: "await $('[data-test=\"shopping-cart-badge\"]').waitForDisplayed({ timeout: 10000 });",
    } },
  },
  'QCR-S001/xpath': {
    title: 'An XPath that depends on layout',
    fix: SELECTOR_FIX,
    examples: { js: {
      bad: "await page.locator('//div[3]/div[2]/button[2]').click();",
      good: "await page.getByRole('button', { name: 'Add to cart' }).click();",
    } },
  },
  'QCR-S001/position': {
    title: 'A selector that picks by position',
    fix: SELECTOR_FIX,
    examples: { js: {
      bad: "cy.get('.inventory_list > div:nth-child(2) button').click();",
      good: "cy.get('[data-test=\"add-to-cart-sauce-labs-backpack\"]').click();",
    } },
  },
  'QCR-S001/generated': {
    title: 'A generated class or id',
    fix: SELECTOR_FIX,
    examples: { js: { bad: "await page.locator('.css-1q2w3e4').click();", good: "await page.getByTestId('checkout').click();" } },
  },
  'QCR-S001/deep': {
    title: 'A selector that follows the page structure through 4 or more levels',
    fix: SELECTOR_FIX,
    examples: { js: {
      bad: "await page.locator('#root > div > main > section > button').click();",
      good: "await page.getByRole('button', { name: 'Checkout' }).click();",
    } },
  },
  'QCR-S001/pick': {
    title: 'A pick by position in a list (info)',
    fix: 'Pick the element by something it shows, such as its text, a role with a name or a test id, not by its place in a list.',
    examples: { js: {
      bad: "await page.locator('.inventory_item').nth(2).click();",
      good: "await page.locator('.inventory_item').filter({ hasText: 'Sauce Labs Backpack' }).click();",
    } },
  },
  'QCR-E001': {
    title: 'A catch block that hides a failed assertion',
    fix: 'Take the assertion out of the try block, or throw the error again in the handler. To go on after a failed check, use a soft assertion.',
    examples: { js: {
      bad: "try {\n  await expect(page.getByTestId('total')).toHaveText('$32.39');\n} catch (e) {\n  console.log('total did not match', e);\n}",
      good: "await expect(page.getByTestId('total')).toHaveText('$32.39');",
    } },
  },
  'QCR-E001/promise': {
    title: 'A .catch() handler that hides a failed assertion',
    fix: 'Remove the .catch() from the assertion, so that a failed check fails the test. To go on after a failed check, use a soft assertion.',
    examples: { js: {
      bad: "await expect(page.getByTestId('promo-banner')).toBeVisible().catch(() => {});",
      good: "await expect(page.getByTestId('promo-banner')).toBeVisible();",
    } },
  },
  'QCR-F001': {
    title: 'A focused test or suite',
    fix: 'Remove the focus before you commit. To stop it from coming back, let CI refuse focused tests (Playwright forbidOnly, Mocha --forbid-only).',
    examples: { js: {
      bad: "test.only('adds item to cart', async ({ page }) => {\n  // ...\n});",
      good: "test('adds item to cart', async ({ page }) => {\n  // ...\n});",
    } },
  },
  'QCR-F002': {
    title: 'A skipped test or suite, a to-do, or a fixme',
    fix: 'Turn the test back on, or delete it. If it has to wait, skip it on a condition and say why, with the ticket that tracks it.',
    examples: { js: {
      bad: "it.skip('rejects an empty password', () => {\n  // ...\n});",
      good: "test('uploads a file', async ({ page }) => {\n  test.skip(process.platform === 'win32', 'File picker is not supported on Windows CI');\n  // ...\n});",
    } },
  },
  'QCR-F002/expected-failure': {
    title: 'An expected failure (info)',
    fix: 'Say which bug makes the test fail and where it is tracked, and remove the mark when the bug is fixed.',
    examples: { js: {
      bad: "test.fail('rounds the tax up', async ({ page }) => {\n  // ...\n});",
      good: "// Fails until SHOP-142 is fixed: the tax is rounded down.\ntest.fail('rounds the tax up', async ({ page }) => {\n  // ...\n});",
    } },
  },
  'QCR-D001': {
    title: 'A test with the same body as another test',
    fix: 'Delete the copy, or change it so that it checks another case. For the same steps with other data, write one parameterized test.',
    examples: { js: {
      bad: "test('login works', async ({ page }) => {\n  await login(page, 'standard_user');\n  await expect(page).toHaveURL(/inventory/);\n});\n\ntest('login works for standard user', async ({ page }) => {\n  await login(page, 'standard_user');\n  await expect(page).toHaveURL(/inventory/);\n});",
      good: "for (const user of ['standard_user', 'performance_glitch_user']) {\n  test(`login works for ${user}`, async ({ page }) => {\n    await login(page, user);\n    await expect(page).toHaveURL(/inventory/);\n  });\n}",
    } },
  },
  'QCR-D001/title': {
    title: 'Two tests with the same title in one file',
    fix: 'Give each test a title that says what it checks, so that a failure report points to one test.',
    examples: { js: {
      bad: "it('adds an item', () => {\n  expect(new Cart().add('backpack').items).toHaveLength(1);\n});\n\nit('adds an item', () => {\n  expect(new Cart().add('backpack').add('onesie').total).toBe(37.98);\n});",
      good: "it('adds an item', () => {\n  expect(new Cart().add('backpack').items).toHaveLength(1);\n});\n\nit('adds the prices of two items', () => {\n  expect(new Cart().add('backpack').add('onesie').total).toBe(37.98);\n});",
    } },
  },
  'QCR-P001': {
    title: 'A test with only snapshot assertions',
    fix: 'Add assertions on the values that matter, so that the test says what must be true. Keep the snapshot next to them if it helps.',
    examples: { js: {
      bad: "it('renders the cart', () => {\n  const html = renderCart([{ name: 'Backpack', price: 29.99 }]);\n  expect(html).toMatchSnapshot();\n});",
      good: "it('renders the cart', () => {\n  const html = renderCart([{ name: 'Backpack', price: 29.99 }]);\n  expect(html).toContain('Backpack');\n  expect(html).toContain('$29.99');\n  expect(html).toMatchSnapshot();\n});",
    } },
  },
  'QCR-P001/inline': {
    title: 'An inline snapshot recorded empty',
    fix: 'Run the test once, read what the runner writes into the snapshot, and commit it only when it is right.',
    examples: { js: {
      bad: "it('formats the receipt', () => {\n  const receipt = formatReceipt({ items: ['backpack'], tax: 2.4 });\n  expect(receipt.total).toBe('$32.39');\n  expect(receipt.lines).toMatchInlineSnapshot();\n});",
      good: "it('formats the receipt', () => {\n  const receipt = formatReceipt({ items: ['backpack'], tax: 2.4 });\n  expect(receipt.total).toBe('$32.39');\n  expect(receipt.lines).toMatchInlineSnapshot(`\"Backpack $29.99, Tax $2.40\"`);\n});",
    } },
  },
  'QCR-P001/visual': {
    title: 'A test with only visual checks (info)',
    fix: 'Look at each new baseline image before you commit it. One assertion on what the page must show makes a failure easier to read.',
    examples: { js: {
      bad: "test('shows the cart', async ({ page }) => {\n  await page.goto('https://www.saucedemo.com/cart.html');\n  await expect(page).toHaveScreenshot('cart.png');\n});",
      good: "test('shows the cart', async ({ page }) => {\n  await page.goto('https://www.saucedemo.com/cart.html');\n  await expect(page.getByTestId('cart-list')).toBeVisible();\n  await expect(page).toHaveScreenshot('cart.png');\n});",
    } },
  },
  'QCR-C001/timers': {
    title: 'Fake timers that are never switched back',
    fix: 'Switch back to real timers in an afterEach hook. A hook also runs when the test fails; a line at the end of the test does not.',
    examples: { js: {
      bad: "it('uses the fixed date', () => {\n  vi.useFakeTimers();\n  vi.setSystemTime(new Date('2026-01-01'));\n  expect(formatToday()).toBe('Jan 1, 2026');\n});",
      good: "afterEach(() => {\n  vi.useRealTimers();\n});\n\nit('uses the fixed date', () => {\n  vi.useFakeTimers();\n  vi.setSystemTime(new Date('2026-01-01'));\n  expect(formatToday()).toBe('Jan 1, 2026');\n});",
    } },
  },
  'QCR-C001/spy': {
    title: 'A spy or stub that is never restored',
    fix: 'Restore every spy in an afterEach hook. If the runner config already does it (restoreMocks), set restoreMocksConfigured for this rule.',
    examples: { js: {
      bad: "it('logs the order', () => {\n  const log = jest.spyOn(console, 'log').mockImplementation(() => {});\n  placeOrder({ id: 7 });\n  expect(log).toHaveBeenCalledWith('order 7 placed');\n});",
      good: "afterEach(() => {\n  jest.restoreAllMocks();\n});\n\nit('logs the order', () => {\n  const log = jest.spyOn(console, 'log').mockImplementation(() => {});\n  placeOrder({ id: 7 });\n  expect(log).toHaveBeenCalledWith('order 7 placed');\n});",
    } },
  },
  'QCR-C001/env': {
    title: 'An environment variable that is never set back',
    fix: 'Set the variable back in an afterEach hook, or use the stub helper of the runner and undo it there.',
    examples: { js: {
      bad: "it('uses the staging API', () => {\n  process.env.API_URL = 'https://api.example.test';\n  expect(apiUrl()).toBe('https://api.example.test');\n});",
      good: "const original = process.env.API_URL;\n\nafterEach(() => {\n  process.env.API_URL = original;\n});\n\nit('uses the staging API', () => {\n  process.env.API_URL = 'https://api.example.test';\n  expect(apiUrl()).toBe('https://api.example.test');\n});",
    } },
  },
  'QCR-C001/global': {
    title: 'A global that is never put back',
    fix: 'Put the global back in an afterEach hook, or use the stub helper of the runner and undo it there.',
    examples: { js: {
      bad: "it('loads the rates', async () => {\n  vi.stubGlobal('fetch', vi.fn(async () => new Response('{\"EUR\":0.92}')));\n  expect(await loadRates()).toEqual({ EUR: 0.92 });\n});",
      good: "afterEach(() => {\n  vi.unstubAllGlobals();\n});\n\nit('loads the rates', async () => {\n  vi.stubGlobal('fetch', vi.fn(async () => new Response('{\"EUR\":0.92}')));\n  expect(await loadRates()).toEqual({ EUR: 0.92 });\n});",
    } },
  },
  'QCR-C001/handle': {
    title: 'A browser, context, page or client that is never closed',
    fix: 'Close it in an after hook, or let the test runner make it for you: a fixture is closed by the runner.',
    examples: { js: {
      bad: "test('opens the shop', async () => {\n  const browser = await chromium.launch();\n  const page = await browser.newPage();\n  await page.goto('https://www.saucedemo.com');\n  await expect(page).toHaveTitle('Swag Labs');\n});",
      good: "test('opens the shop', async ({ page }) => {\n  await page.goto('https://www.saucedemo.com');\n  await expect(page).toHaveTitle('Swag Labs');\n});",
    } },
  },
  'QCR-C001/data': {
    title: 'Test data that is never deleted (info)',
    fix: 'Delete what the test creates, in the test or in an after hook, so that the next run starts from the same data.',
    examples: { js: {
      bad: "test('creates an order', async ({ request }) => {\n  const response = await request.post('https://api.example.test/orders', { data: { item: 'backpack' } });\n  expect(response.status()).toBe(201);\n});",
      good: "test('creates an order', async ({ request }) => {\n  const response = await request.post('https://api.example.test/orders', { data: { item: 'backpack' } });\n  expect(response.status()).toBe(201);\n  const { id } = await response.json();\n  await request.delete(`https://api.example.test/orders/${id}`);\n});",
    } },
  },
  'QCR-N001': {
    title: 'A group of tests with happy paths only',
    fix: 'Add at least one test for what must not work: bad input, a missing value, or a failure of something the code depends on.',
    examples: { js: {
      bad: "describe('applyDiscount', () => {\n  it('applies 10% off', () => {\n    expect(applyDiscount(100, 'SAVE10')).toBe(90);\n  });\n  it('applies 20% off', () => {\n    expect(applyDiscount(100, 'SAVE20')).toBe(80);\n  });\n});",
      good: "describe('applyDiscount', () => {\n  it('applies 10% off', () => {\n    expect(applyDiscount(100, 'SAVE10')).toBe(90);\n  });\n  it('rejects an unknown code', () => {\n    expect(() => applyDiscount(100, 'NOPE')).toThrow('Invalid code');\n  });\n});",
    } },
  },
  'QCR-M001/subject': {
    title: 'The code under test is mocked',
    fix: 'Mock what the code under test depends on, not the code under test itself.',
    examples: { js: {
      bad: "import { getTotal } from './cart';\n\nvi.mock('./cart', () => ({ getTotal: vi.fn(() => 42) }));\n\nit('returns the total', () => {\n  expect(getTotal([{ price: 40 }, { price: 2 }])).toBe(42);\n});",
      good: "import { getTotal } from './cart';\n\nvi.mock('./tax', () => ({ taxRate: () => 0 }));\n\nit('returns the total', () => {\n  expect(getTotal([{ price: 40 }, { price: 2 }])).toBe(42);\n});",
    } },
  },
  'QCR-M001/stubbed': {
    title: 'A stubbed function is called and checked',
    fix: 'Call the real function and check what it returns. Give fixed replies only to the things it depends on.',
    examples: { js: {
      bad: "it('loads the user', async () => {\n  const getUser = vi.fn().mockResolvedValue({ id: 7, name: 'Sam' });\n  expect(await getUser(7)).toEqual({ id: 7, name: 'Sam' });\n});",
      good: "it('loads the user', async () => {\n  const http = { get: vi.fn().mockResolvedValue({ id: 7, name: 'Sam' }) };\n  expect(await new UserService(http).getUser(7)).toEqual({ id: 7, name: 'Sam' });\n});",
    } },
  },
  'QCR-M001/calls-only': {
    title: 'A test that checks only calls on mocks (warn)',
    fix: 'Also check a result: what the code returns, what it saves, or what the user sees.',
    examples: { js: {
      bad: "it('places the order', async () => {\n  await placeOrder(cart);\n  expect(mailer.send).toHaveBeenCalledTimes(1);\n});",
      good: "it('places the order', async () => {\n  const order = await placeOrder(cart);\n  expect(order.status).toBe('placed');\n  expect(mailer.send).toHaveBeenCalledTimes(1);\n});",
    } },
  },
  'QCR-M001/everything': {
    title: 'Every import of the file is mocked (warn)',
    fix: 'Keep the module under test real. Mock only what is slow, random or outside your control.',
    examples: { js: {
      bad: "import { placeOrder } from '../src/orders';\nimport { charge } from '../src/payments';\n\njest.mock('../src/orders');\njest.mock('../src/payments');",
      good: "import { placeOrder } from '../src/orders';\nimport { charge } from '../src/payments';\n\njest.mock('../src/payments');",
    } },
  },
  'QCR-M001/network': {
    title: 'Every network request is faked (warn)',
    fix: 'Fake only the requests this test is about, and let the others go to the real server or to a test server.',
    examples: { js: {
      bad: "await page.route('**/*', (route) => route.fulfill({ json: { items: [] } }));\nawait page.goto('https://www.saucedemo.com/cart.html');\nawait expect(page.getByTestId('cart-list')).toBeVisible();",
      good: "await page.route('**/api/cart', (route) => route.fulfill({ json: { items: [] } }));\nawait page.goto('https://www.saucedemo.com/cart.html');\nawait expect(page.getByTestId('cart-list')).toBeVisible();",
    } },
  },
};

/** The fix and the good example for a finding in a file of this language. */
export function fixFor(key: string, language: LanguageId): { fix: string; goodExample?: string } {
  const entry = FIX_TEXT[key]!;
  const example = entry.examples[FAMILY[language] ?? ('none' as Family)];
  return { fix: entry.fix, ...(example ? { goodExample: example.good } : {}) };
}

/** The sub-cases of a rule with their examples in this language, for `explain`. */
export function examplesFor(ruleId: string, language: LanguageId): Array<{ title: string; fix: string; example: Example | null }> {
  return Object.entries(FIX_TEXT).filter(([key]) => key === ruleId || key.startsWith(`${ruleId}/`))
    .map(([, entry]) => ({ title: entry.title, fix: entry.fix, example: entry.examples[FAMILY[language] ?? ('none' as Family)] ?? null }));
}
