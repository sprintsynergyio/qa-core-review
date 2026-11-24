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
