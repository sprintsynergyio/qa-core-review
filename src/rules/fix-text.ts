// The fix and the examples of each rule, per language (SPEC.md Section 10.0), so that a finding
// in a TypeScript file suggests TypeScript and one in a Python file suggests Python. A key is a
// rule id, or a rule id and a sub-case. The JS/TS texts are in the first table, the Python
// texts in the second and the Java texts in the third. A file in any other language gets the
// general fix and no example.
import type { LanguageId } from '../model/types.js';

type Family = 'js' | 'python' | 'java';
const FAMILY: Partial<Record<LanguageId, Family>> = { javascript: 'js', typescript: 'js', python: 'python', java: 'java' };

interface Example { bad: string; good: string }
interface Entry {
  /** What the sub-case is, for `explain` and the docs. */
  title: string;
  /** The fix in words that fit any language. */
  fix: string;
  /** The fix in the words of one language, where the general one names things that language does not have. */
  fixes?: Partial<Record<Family, string>>;
  examples: Partial<Record<Family, Example>>;
}

const SELECTOR_FIX = 'Prefer role, label or test id selectors. For Playwright suites, qa-core-heal can repair many broken locators at once.';

const BASE: Readonly<Record<string, Entry>> = {
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
  'QCR-A003/mock': {
    title: 'A check on a mock that does not exist or is never called',
    fix: 'Use a real assertion method of the mock, and call it.',
    examples: { js: { bad: 'expect(mailer.send).toHaveBeenCalled;', good: 'expect(mailer.send).toHaveBeenCalled();' } },
  },
  'QCR-A003/soft': {
    title: 'A soft assertion that is never reported',
    fix: 'Ask the object that collects the soft assertions for its failures at the end of the test, or let the test framework make and report it.',
    examples: {},
  },
  'QCR-A003/second-value': {
    title: 'A truth check that is given a second value',
    fix: 'Compare the two values with an equality assertion.',
    examples: {},
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
  'QCR-X002': {
    title: 'A suppression with no reason',
    fix: 'Say why the rule does not apply here, after two dashes. A suppression with a reason is one that a reviewer can agree or disagree with.',
    examples: { js: {
      bad: '// qa-core-review-disable-next-line QCR-W001\nawait page.waitForTimeout(500);',
      good: '// qa-core-review-disable-next-line QCR-W001 -- the animation has no event to wait for\nawait page.waitForTimeout(500);',
    } },
  },
};

/** The Python texts: an example for each case that a Python file can have, and the fix where Python says it in other words. */
const PYTHON: Readonly<Record<string, Partial<Example> & { fix?: string }>> = {
  'QCR-A001': {
    bad: 'def test_user_can_log_in(driver):\n    driver.get("https://www.saucedemo.com")\n    driver.find_element(By.ID, "login-button").click()',
    good: 'def test_user_can_log_in(driver):\n    driver.get("https://www.saucedemo.com")\n    driver.find_element(By.ID, "login-button").click()\n    assert driver.find_element(By.CLASS_NAME, "title").text == "Products"',
  },
  'QCR-A002': {
    bad: 'assert True\nassert cart.total() == cart.total()',
    good: 'assert item in cart.items\nassert cart.total() == 29.99',
  },
  'QCR-A003/incomplete': {
    fix: 'Finish the assertion by calling a matcher, for example to_be_visible() or to_have_text(...).',
    bad: 'expect(page.get_by_text("Products"))',
    good: 'expect(page.get_by_text("Products")).to_be_visible()',
  },
  'QCR-A003/unreachable': {
    fix: 'Move the assertion before the return or raise, or remove the early exit.',
    bad: 'return\nassert len(cart.items) == 1',
    good: 'assert len(cart.items) == 1\nreturn',
  },
  'QCR-A003/unawaited': {
    fix: 'Put await before the assertion. In the async API of Playwright every expect(...) check has to be awaited.',
    bad: 'async def test_checkout_is_shown(page):\n    expect(page.get_by_role("button", name="Checkout")).to_be_visible()',
    good: 'async def test_checkout_is_shown(page):\n    await expect(page.get_by_role("button", name="Checkout")).to_be_visible()',
  },
  'QCR-A003/locator': {
    bad: 'assert page.locator("#checkout")',
    good: 'expect(page.locator("#checkout")).to_be_visible()',
  },
  'QCR-A003/count': {
    bad: 'assert len(rows) >= 0',
    good: 'assert len(rows) == 3',
  },
  'QCR-A003/collection': {
    fix: 'Check the value itself. A tuple or a list that is written out with items is always true, so assert (value, "message") never fails.',
    bad: 'assert (cart.total(), 42)',
    good: 'assert cart.total() == 42',
  },
  'QCR-A003/mock': {
    fix: 'Use a real assertion method of the mock, and call it: assert_called_once_with(...), not called_once_with(...). A mock accepts any other name and returns a new mock.',
    bad: 'payment.called_once_with(42)\nmailer.send.assert_called_once',
    good: 'payment.assert_called_once_with(42)\nmailer.send.assert_called_once()',
  },
  'QCR-A003/second-value': {
    fix: 'Use assertEqual to compare the two values. assertTrue checks only the first one and takes the second as the failure message.',
    bad: 'self.assertTrue(cart.total(), 29.99)',
    good: 'self.assertEqual(cart.total(), 29.99)',
  },
  'QCR-A004': {
    bad: 'for item in api.get("/items").json():\n    assert item["price"] > 0',
    good: 'items = api.get("/items").json()\nassert len(items) > 0\nfor item in items:\n    assert item["price"] > 0',
  },
  'QCR-W001': {
    fix: 'Wait for a condition instead: WebDriverWait(driver, 10).until(...) in Selenium, an expect(...) assertion in Playwright, or a polling helper. For timing failures that come and go, see qa-core-flaky.',
    bad: 'driver.find_element(By.ID, "add-to-cart-sauce-labs-backpack").click()\ntime.sleep(3)\nassert driver.find_element(By.CLASS_NAME, "shopping_cart_badge").text == "1"',
    good: 'driver.find_element(By.ID, "add-to-cart-sauce-labs-backpack").click()\nWebDriverWait(driver, 10).until(EC.text_to_be_present_in_element((By.CLASS_NAME, "shopping_cart_badge"), "1"))',
  },
  'QCR-W001/implicit': {
    bad: 'driver.implicitly_wait(10)',
    good: 'WebDriverWait(driver, 10).until(EC.visibility_of_element_located((By.CLASS_NAME, "shopping_cart_badge")))',
  },
  'QCR-S001/xpath': {
    bad: 'driver.find_element(By.XPATH, "/html/body/div[1]/div/div[2]/button[3]").click()',
    good: 'driver.find_element(By.CSS_SELECTOR, "[data-test=\'add-to-cart-sauce-labs-backpack\']").click()',
  },
  'QCR-S001/position': {
    bad: 'page.locator(".inventory_list > div:nth-child(2) button").click()',
    good: 'page.locator("[data-test=\'add-to-cart-sauce-labs-backpack\']").click()',
  },
  'QCR-S001/generated': {
    bad: 'page.locator(".css-1q2w3e4").click()',
    good: 'page.get_by_test_id("checkout").click()',
  },
  'QCR-S001/deep': {
    bad: 'page.locator("#root > div > main > section > button").click()',
    good: 'page.get_by_role("button", name="Checkout").click()',
  },
  'QCR-S001/pick': {
    bad: 'page.locator(".inventory_item").nth(2).click()',
    good: 'page.locator(".inventory_item").filter(has_text="Sauce Labs Backpack").click()',
  },
  'QCR-E001': {
    fix: 'Take the assertion out of the try block, or raise the error again in the except block. To go on after a failed check, use a soft assertion (pytest-check).',
    bad: 'try:\n    expect(page.get_by_test_id("total")).to_have_text("$32.39")\nexcept Exception as error:\n    print("total did not match", error)',
    good: 'expect(page.get_by_test_id("total")).to_have_text("$32.39")',
  },
  'QCR-F002': {
    fix: 'Turn the test back on, or delete it. If it has to wait, use skipif with a condition and a reason that names the ticket.',
    bad: '@pytest.mark.skip\ndef test_rejects_empty_password(page):\n    ...',
    good: '@pytest.mark.skipif(sys.platform == "win32", reason="File picker is not supported on Windows CI")\ndef test_uploads_a_file(page):\n    ...',
  },
  'QCR-F002/expected-failure': {
    fix: 'Say which bug makes the test fail and where it is tracked, in reason=. With strict=True the test fails as soon as the bug is fixed, so the mark does not stay forever.',
    bad: '@pytest.mark.xfail\ndef test_rounds_the_tax_up(cart):\n    ...',
    good: '@pytest.mark.xfail(reason="SHOP-142: the tax is rounded down", strict=True)\ndef test_rounds_the_tax_up(cart):\n    ...',
  },
  'QCR-D001': {
    fix: 'Delete the copy, or change it so that it checks another case. For the same steps with other data, use @pytest.mark.parametrize or subTest.',
    bad: 'def test_login_works(page):\n    login(page, "standard_user")\n    expect(page).to_have_url(re.compile("inventory"))\n\n\ndef test_login_works_for_standard_user(page):\n    login(page, "standard_user")\n    expect(page).to_have_url(re.compile("inventory"))',
    good: '@pytest.mark.parametrize("user", ["standard_user", "performance_glitch_user"])\ndef test_login_works(page, user):\n    login(page, user)\n    expect(page).to_have_url(re.compile("inventory"))',
  },
  'QCR-D001/title': {
    fix: 'Give each test a name that says what it checks. Python keeps only the last function with a name, so the first of the two never runs.',
    bad: 'def test_adds_an_item():\n    assert len(Cart().add("backpack").items) == 1\n\n\ndef test_adds_an_item():\n    assert Cart().add("backpack").add("onesie").total == 37.98',
    good: 'def test_adds_an_item():\n    assert len(Cart().add("backpack").items) == 1\n\n\ndef test_adds_the_prices_of_two_items():\n    assert Cart().add("backpack").add("onesie").total == 37.98',
  },
  'QCR-P001': {
    bad: 'def test_renders_cart(snapshot):\n    html = render_cart([{"name": "Backpack", "price": 29.99}])\n    assert html == snapshot',
    good: 'def test_renders_cart(snapshot):\n    html = render_cart([{"name": "Backpack", "price": 29.99}])\n    assert "Backpack" in html\n    assert "$29.99" in html\n    assert html == snapshot',
  },
  'QCR-C001/spy': {
    fix: 'Stop every patcher that you start: call self.addCleanup(patcher.stop) right after start(). A patch used as a decorator or in a with block, and the mocker fixture, undo themselves.',
    bad: 'class OrderTests(unittest.TestCase):\n    def setUp(self):\n        self.charge = patch("shop.payments.charge").start()',
    good: 'class OrderTests(unittest.TestCase):\n    def setUp(self):\n        patcher = patch("shop.payments.charge")\n        self.charge = patcher.start()\n        self.addCleanup(patcher.stop)',
  },
  'QCR-C001/env': {
    fix: 'Use monkeypatch.setenv, which pytest puts back after the test, or patch.dict(os.environ, {...}) in a with block.',
    bad: 'def test_uses_the_staging_api():\n    os.environ["API_URL"] = "https://api.example.test"\n    assert api_url() == "https://api.example.test"',
    good: 'def test_uses_the_staging_api(monkeypatch):\n    monkeypatch.setenv("API_URL", "https://api.example.test")\n    assert api_url() == "https://api.example.test"',
  },
  'QCR-C001/handle': {
    fix: 'Close it after the yield of a fixture, in tearDown, or with a with block, so that it is closed when the test fails too.',
    bad: 'def test_checkout():\n    driver = webdriver.Chrome()\n    driver.get("https://www.saucedemo.com")\n    assert "Swag Labs" in driver.title',
    good: '@pytest.fixture\ndef driver():\n    driver = webdriver.Chrome()\n    yield driver\n    driver.quit()\n\n\ndef test_checkout(driver):\n    driver.get("https://www.saucedemo.com")\n    assert "Swag Labs" in driver.title',
  },
  'QCR-C001/data': {
    fix: 'Delete what the test creates, in the test or after the yield of a fixture, so that the next run starts from the same data.',
    bad: 'def test_creates_an_order(api):\n    response = api.post("https://api.example.test/orders", json={"item": "backpack"})\n    assert response.status_code == 201',
    good: 'def test_creates_an_order(api):\n    response = api.post("https://api.example.test/orders", json={"item": "backpack"})\n    assert response.status_code == 201\n    api.delete(f"https://api.example.test/orders/{response.json()[\'id\']}")',
  },
  'QCR-N001': {
    bad: 'class TestApplyDiscount:\n    def test_ten_percent(self):\n        assert apply_discount(100, "SAVE10") == 90\n\n    def test_twenty_percent(self):\n        assert apply_discount(100, "SAVE20") == 80',
    good: 'class TestApplyDiscount:\n    def test_ten_percent(self):\n        assert apply_discount(100, "SAVE10") == 90\n\n    def test_rejects_unknown_code(self):\n        with pytest.raises(ValueError, match="Invalid code"):\n            apply_discount(100, "NOPE")',
  },
  'QCR-M001/subject': {
    bad: 'from shop.cart import Cart\n\n\n@patch("shop.cart.Cart")\ndef test_returns_total(cart_class):\n    cart_class.return_value.total.return_value = 42\n    assert Cart().total() == 42',
    good: 'from shop.cart import Cart\n\n\n@patch("shop.cart.tax_rate", return_value=0)\ndef test_returns_total(tax_rate):\n    assert Cart([{"price": 40}, {"price": 2}]).total() == 42',
  },
  'QCR-M001/stubbed': {
    bad: 'from shop.cart import get_total\n\n\n@patch("shop.cart.get_total", return_value=42)\ndef test_returns_total(mock_total):\n    assert get_total([{"price": 40}, {"price": 2}]) == 42',
    good: 'from shop.cart import get_total\n\n\n@patch("shop.cart.tax_rate", return_value=0)\ndef test_returns_total(tax_rate):\n    assert get_total([{"price": 40}, {"price": 2}]) == 42',
  },
  'QCR-M001/calls-only': {
    bad: 'def test_places_the_order(mailer):\n    place_order(cart, mailer)\n    mailer.send.assert_called_once()',
    good: 'def test_places_the_order(mailer):\n    order = place_order(cart, mailer)\n    assert order.status == "placed"\n    mailer.send.assert_called_once()',
  },
  'QCR-M001/everything': {
    bad: 'from shop.orders import OrderService\nfrom shop.payments import PaymentClient\n\n\n@patch("shop.orders.OrderService")\n@patch("shop.payments.PaymentClient")\ndef test_places_the_order(payment_client, order_service):\n    ...',
    good: 'from shop.orders import OrderService\nfrom shop.payments import PaymentClient\n\n\n@patch("shop.payments.PaymentClient")\ndef test_places_the_order(payment_client):\n    ...',
  },
  'QCR-M001/network': {
    bad: 'page.route("**/*", lambda route: route.fulfill(json={"items": []}))\npage.goto("https://www.saucedemo.com/cart.html")\nexpect(page.get_by_test_id("cart-list")).to_be_visible()',
    good: 'page.route("**/api/cart", lambda route: route.fulfill(json={"items": []}))\npage.goto("https://www.saucedemo.com/cart.html")\nexpect(page.get_by_test_id("cart-list")).to_be_visible()',
  },
  'QCR-X002': {
    bad: '# qa-core-review-disable-next-line QCR-W001\ntime.sleep(0.5)',
    good: '# qa-core-review-disable-next-line QCR-W001 -- the animation has no event to wait for\ntime.sleep(0.5)',
  },
};

const JAVA: Readonly<Record<string, Partial<Example> & { fix?: string }>> = {
  'QCR-A001': {
    bad: '@Test\nvoid userCanLogIn() {\n    driver.get("https://www.saucedemo.com");\n    driver.findElement(By.id("login-button")).click();\n}',
    good: '@Test\nvoid userCanLogIn() {\n    driver.get("https://www.saucedemo.com");\n    driver.findElement(By.id("login-button")).click();\n    assertEquals("Products", driver.findElement(By.className("title")).getText());\n}',
  },
  'QCR-A002': {
    bad: 'assertTrue(true);\nassertEquals(cart.total(), cart.total());',
    good: 'assertTrue(cart.items().contains(item));\nassertEquals(29.99, cart.total(), 0.001);',
  },
  'QCR-A003/incomplete': {
    fix: 'Finish the assertion: call a check on assertThat(...), such as isEqualTo(...) or isVisible(), and end a StepVerifier with verify() or verifyComplete().',
    bad: 'assertThat(cart.total());',
    good: 'assertThat(cart.total()).isEqualTo(29.99);',
  },
  'QCR-A003/unreachable': {
    fix: 'Take out the call that always throws before the assertion, such as a fail(...) left over from a test that was not written yet.',
    bad: 'cart.add("apple");\nfail("not written yet");\nassertEquals(1, cart.items().size());',
    good: 'cart.add("apple");\nassertEquals(1, cart.items().size());',
  },
  'QCR-A003/locator': {
    fix: 'Check what the element shows or does, for example isDisplayed() or its text. findElement never gives null (it throws when the element is missing), and a Playwright locator exists before the element does.',
    bad: 'assertNotNull(driver.findElement(By.id("checkout")));',
    good: 'assertTrue(driver.findElement(By.id("checkout")).isDisplayed());',
  },
  'QCR-A003/count': {
    bad: 'assertTrue(rows.size() >= 0);',
    good: 'assertEquals(3, rows.size());',
  },
  'QCR-A003/mock': {
    fix: 'Name the call you expect after verify(mock): verify(mailer).send(...). verify(mailer) by itself checks nothing.',
    bad: 'verify(mailer);',
    good: 'verify(mailer).send("ana", "receipt");',
  },
  'QCR-A003/soft': {
    fix: 'Call assertAll() on the soft assertion object at the end of the test, or let the framework report it: SoftAssertions.assertSoftly(...), a try-with-resources with AutoCloseableSoftAssertions, or the SoftAssertionsExtension.',
    bad: 'SoftAssertions softly = new SoftAssertions();\nsoftly.assertThat(cart.owner()).isEqualTo("ana");\nsoftly.assertThat(cart.size()).isEqualTo(2);',
    good: 'SoftAssertions softly = new SoftAssertions();\nsoftly.assertThat(cart.owner()).isEqualTo("ana");\nsoftly.assertThat(cart.size()).isEqualTo(2);\nsoftly.assertAll();',
  },
  'QCR-A004': {
    bad: 'for (Item item : api.items()) {\n    assertTrue(item.price() > 0);\n}',
    good: 'List<Item> items = api.items();\nassertFalse(items.isEmpty());\nfor (Item item : items) {\n    assertTrue(item.price() > 0);\n}',
  },
  'QCR-W001': {
    fix: 'Wait for a condition instead: new WebDriverWait(driver, timeout).until(...) in Selenium, an assertThat(locator) check in Playwright, or Awaitility. For timing failures that come and go, see qa-core-flaky.',
    bad: 'driver.findElement(By.id("add-to-cart-sauce-labs-backpack")).click();\nThread.sleep(3000);\nassertEquals("1", driver.findElement(By.className("shopping_cart_badge")).getText());',
    good: 'driver.findElement(By.id("add-to-cart-sauce-labs-backpack")).click();\nnew WebDriverWait(driver, Duration.ofSeconds(10))\n    .until(ExpectedConditions.textToBe(By.className("shopping_cart_badge"), "1"));',
  },
  'QCR-W001/implicit': {
    bad: 'driver.manage().timeouts().implicitlyWait(Duration.ofSeconds(30));',
    good: 'new WebDriverWait(driver, Duration.ofSeconds(10))\n    .until(ExpectedConditions.visibilityOfElementLocated(By.className("shopping_cart_badge")));',
  },
  'QCR-S001/xpath': {
    bad: 'driver.findElement(By.xpath("//div[2]/div[1]/div/form/input[3]")).click();',
    good: 'driver.findElement(By.id("login-button")).click();',
  },
  'QCR-S001/position': {
    bad: 'page.locator("ul.inventory_list > li:nth-child(3) button").click();',
    good: 'page.getByTestId("add-to-cart-sauce-labs-bolt-t-shirt").click();',
  },
  'QCR-S001/generated': {
    bad: 'driver.findElement(By.cssSelector(".css-1x2y3z4")).click();',
    good: 'driver.findElement(By.cssSelector("[data-test=\'checkout\']")).click();',
  },
  'QCR-S001/deep': {
    bad: 'driver.findElement(By.cssSelector("#root > div > div > main > section > button")).click();',
    good: 'driver.findElement(By.id("checkout")).click();',
  },
  'QCR-S001/pick': {
    bad: 'driver.findElements(By.className("inventory_item")).get(2).click();',
    good: 'driver.findElement(By.cssSelector("[data-test=\'add-to-cart-sauce-labs-bolt-t-shirt\']")).click();',
  },
  'QCR-E001': {
    fix: 'Take the assertion out of the try block, or throw the error again in the catch block. To go on after a failed check, use soft assertions (AssertJ SoftAssertions, TestNG SoftAssert).',
    bad: 'try {\n    assertEquals("$32.39", cart.total());\n} catch (Throwable ignored) {\n    // nothing\n}',
    good: 'assertEquals("$32.39", cart.total());',
  },
  'QCR-F002': {
    fix: 'Turn the test back on, or delete it. If it has to wait, say why in the annotation, with the ticket that tracks it: @Disabled("SHOP-123: the coupon service is down").',
    bad: '@Disabled\n@Test\nvoid appliesACoupon() {\n    assertEquals(9.0, cart.apply("SAVE10"), 0.001);\n}',
    good: '@Test\nvoid appliesACoupon() {\n    assertEquals(9.0, cart.apply("SAVE10"), 0.001);\n}',
  },
  'QCR-D001': {
    fix: 'Delete the copy, or change it so that it checks another case. For the same steps with other data, write one @ParameterizedTest, or one test with a TestNG @DataProvider.',
    bad: '@Test\nvoid addsAnApple() {\n    cart.add("apple");\n    assertEquals(1, cart.size());\n}\n\n@Test\nvoid addsAPear() {\n    cart.add("apple");\n    assertEquals(1, cart.size());\n}',
    good: '@ParameterizedTest\n@ValueSource(strings = {"apple", "pear"})\nvoid addsAnItem(String name) {\n    cart.add(name);\n    assertEquals(1, cart.size());\n}',
  },
  'QCR-D001/title': {
    bad: '@Test\n@DisplayName("adds an item")\nvoid addsAnApple() { ... }\n\n@Test\n@DisplayName("adds an item")\nvoid addsAPear() { ... }',
    good: '@Test\n@DisplayName("adds an apple")\nvoid addsAnApple() { ... }\n\n@Test\n@DisplayName("adds a pear")\nvoid addsAPear() { ... }',
  },
  'QCR-P001': {
    bad: '@Test\nvoid printsTheReceipt() {\n    Approvals.verify(cart.receipt());\n}',
    good: '@Test\nvoid printsTheReceipt() {\n    assertEquals(29.99, cart.total(), 0.001);\n    Approvals.verify(cart.receipt());\n}',
  },
  'QCR-C001/spy': {
    fix: 'Open the static mock in a try-with-resources, so that it is closed when the test fails too, or close it in an @AfterEach method.',
    bad: 'MockedStatic<Clock> clock = mockStatic(Clock.class);\nclock.when(Clock::now).thenReturn(NOON);',
    good: 'try (MockedStatic<Clock> clock = mockStatic(Clock.class)) {\n    clock.when(Clock::now).thenReturn(NOON);\n    assertEquals("12:00", receipt.time());\n}',
  },
  'QCR-C001/env': {
    fix: 'Clear the property, or set it back to its old value, in an @AfterEach method. A method that runs after the test also runs when the test fails.',
    bad: '@Test\nvoid usesEuros() {\n    System.setProperty("shop.currency", "EUR");\n    assertEquals("EUR", Prices.currency());\n}',
    good: '@AfterEach\nvoid clearTheCurrency() {\n    System.clearProperty("shop.currency");\n}\n\n@Test\nvoid usesEuros() {\n    System.setProperty("shop.currency", "EUR");\n    assertEquals("EUR", Prices.currency());\n}',
  },
  'QCR-C001/handle': {
    fix: 'Quit or close it in an @AfterEach or @AfterMethod method, or open it in a try-with-resources, so that it is closed when the test fails too.',
    bad: '@Test\nvoid showsTheLoginPage() {\n    WebDriver driver = new ChromeDriver();\n    driver.get("https://www.saucedemo.com");\n    assertEquals("Swag Labs", driver.getTitle());\n}',
    good: 'private WebDriver driver;\n\n@BeforeEach\nvoid start() {\n    driver = new ChromeDriver();\n}\n\n@AfterEach\nvoid stop() {\n    driver.quit();\n}',
  },
  'QCR-C001/data': {
    bad: 'given().body(order).post("/orders").then().statusCode(201);',
    good: 'String id = given().body(order).post("/orders").then().statusCode(201).extract().path("id");\ngiven().delete("/orders/" + id).then().statusCode(204);',
  },
  'QCR-N001': {
    bad: '@Test\nvoid addsAnItem() { ... }\n\n@Test\nvoid totalsTheCart() { ... }',
    good: '@Test\nvoid addsAnItem() { ... }\n\n@Test\nvoid rejectsANegativeQuantity() {\n    assertThrows(IllegalArgumentException.class, () -> cart.add("apple", -1));\n}',
  },
  'QCR-M001/subject': {
    fix: 'Mock what the class under test depends on, not the class itself. Make the real object with new, or with @InjectMocks.',
    bad: '@Mock Prices prices;\n\n@Test\nvoid readsThePrice() {\n    when(prices.of("apple")).thenReturn(99);\n    assertEquals(99, prices.of("apple"));\n}',
    good: '@Mock PriceTable table;\n@InjectMocks Prices prices;\n\n@Test\nvoid readsThePrice() {\n    when(table.lookup("apple")).thenReturn(99);\n    assertEquals(99, prices.of("apple"));\n}',
  },
  'QCR-M001/stubbed': {
    fix: 'Call the real method and check what it returns. Give fixed replies only to the things it depends on.',
    bad: 'when(gateway.fee("4111")).thenReturn(30);\nassertEquals(30, gateway.fee("4111"));',
    good: 'when(gateway.fee("4111")).thenReturn(30);\nassertEquals(1030, checkout.total(cart, "4111"));',
  },
  'QCR-M001/calls-only': {
    bad: 'checkout.pay(cart, "4111");\nverify(mailer).send("ana", "receipt");',
    good: 'Receipt receipt = checkout.pay(cart, "4111");\nassertEquals("paid", receipt.status());\nverify(mailer).send("ana", "receipt");',
  },
  'QCR-M001/network': {
    bad: 'page.route("**/*", route -> route.fulfill(new Route.FulfillOptions().setBody("{}")));\nassertThat(page.locator(".inventory_item")).hasCount(0);',
    good: 'page.route("**/api/recommendations", route -> route.fulfill(new Route.FulfillOptions().setBody("[]")));\nassertThat(page.locator(".inventory_item")).hasCount(6);',
  },
  'QCR-X002': {
    bad: '// qa-core-review-disable-next-line QCR-W001\nThread.sleep(500);',
    good: '// qa-core-review-disable-next-line QCR-W001 -- the animation has no event to wait for\nThread.sleep(500);',
  },
};

/** Every key with its texts in every language that has them. */
export const FIX_TEXT: Readonly<Record<string, Entry>> = Object.fromEntries(Object.entries(BASE).map(([key, entry]) => {
  const fixes: Partial<Record<Family, string>> = {};
  const examples = { ...entry.examples };
  for (const [family, table] of [['python', PYTHON], ['java', JAVA]] as const) {
    const { fix, ...example } = table[key] ?? {};
    if (fix) fixes[family] = fix;
    if ('bad' in example) examples[family] = example as Example;
  }
  return [key, { ...entry, ...(Object.keys(fixes).length > 0 ? { fixes } : {}), examples }];
}));

/** Words of a rule message that another language names differently. */
const TERMS: Readonly<Record<string, Partial<Record<Family, string>>>> = {
  'catch block': { python: 'except block' },
  // `System.setProperty` changes a system property, which is what a Java test uses where others use the environment.
  'environment variable': { java: 'system property' },
  // `mockStatic(Clock.class)` is what stays in place in Java, where Python has a patch.
  patch: { java: 'static mock' },
};

/** The word a message uses in a file of this language: `catch block` is `except block` in Python. */
export function termFor(term: string, language: LanguageId): string {
  return TERMS[term]?.[FAMILY[language] ?? ('none' as Family)] ?? term;
}

const inLanguage = (entry: Entry, language: LanguageId): { fix: string; example: Example | null } => {
  const family = FAMILY[language] ?? ('none' as Family);
  return { fix: entry.fixes?.[family] ?? entry.fix, example: entry.examples[family] ?? null };
};

/** The fix and the good example for a finding in a file of this language. */
export function fixFor(key: string, language: LanguageId): { fix: string; goodExample?: string } {
  const { fix, example } = inLanguage(FIX_TEXT[key]!, language);
  return { fix, ...(example ? { goodExample: example.good } : {}) };
}

/** The sub-cases of a rule with their examples in this language, for `explain`. */
export function examplesFor(ruleId: string, language: LanguageId): Array<{ title: string; fix: string; example: Example | null }> {
  return Object.entries(FIX_TEXT).filter(([key]) => key === ruleId || key.startsWith(`${ruleId}/`))
    .map(([, entry]) => ({ title: entry.title, ...inLanguage(entry, language) }));
}
