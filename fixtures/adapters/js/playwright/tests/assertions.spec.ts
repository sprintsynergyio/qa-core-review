import { test, expect, type FrameLocator, type Locator } from '@playwright/test';
import { CartPage, expectLoggedIn } from './pages/cart-page';

let badge: Locator;

async function expectBadge(count: number) {
  await expect(badge).toHaveText(String(count));
}

test.beforeEach(async ({ page }) => {
  await page.goto('https://www.saucedemo.com/inventory.html');
  badge = page.getByTestId('shopping-cart-badge');
  await expect(page.getByText('Products')).toBeVisible();
});

test.describe('web-first matchers', () => {
  test('state of one element', async ({ page }) => {
    const button = page.getByRole('button', { name: 'Checkout' });
    const input = page.getByPlaceholder('First Name');
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();
    await expect(button).not.toBeDisabled();
    await expect(button).toBeAttached();
    await expect(button).toBeInViewport();
    await expect(button).toHaveText('Checkout');
    await expect(button).toContainText('Check');
    await expect(button).toHaveAttribute('data-test', 'checkout');
    await expect(button).toHaveClass(/btn_action/);
    await expect(button).toHaveCSS('display', 'block');
    await expect(button).toHaveId('checkout');
    await expect(button).toHaveJSProperty('disabled', false);
    await expect(button).toHaveRole('button');
    await expect(button).toHaveAccessibleName('Checkout');
    await expect(button).toHaveAccessibleDescription('Go to checkout');
    await expect(input).toBeEditable();
    await expect(input).toBeEmpty();
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('');
    await expect(page.getByLabel('Remember me')).toBeChecked();
    await expect(page.getByLabel('Sizes')).toHaveValues(['S', 'M']);
    await expect(page.getByAltText('Sauce Labs Backpack')).toBeHidden();
    await expect(page.getByTitle('Close')).toBeHidden();
  });

  test('state of the page', async ({ page, request }) => {
    const frame: FrameLocator = page.frameLocator('#payment');
    const rows = page.locator('.cart_item');
    await expect(page).toHaveURL(/cart\.html/);
    await expect(page).toHaveTitle('Swag Labs');
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText('Backpack');
    await expect(rows.last()).toContainText('Bike Light');
    await expect(rows.nth(1).filter({ hasText: 'Bike' })).toBeVisible();
    await expect(frame.locator('#card')).toBeVisible();
    await expect(page).toHaveScreenshot('cart.png');
    await expect(page.locator('main')).toMatchAriaSnapshot(`- heading "Your Cart"`);
    const response = await request.get('https://api.example.test/orders');
    await expect(response).toBeOK();
    expect(response.status()).toBe(200);
    expect([200, 204]).toContain(response.status());
  });

  test('soft, poll and toPass', async ({ page }) => {
    await expect.soft(page.getByTestId('title')).toHaveText('Products');
    await expect.poll(() => page.locator('.cart_item').count()).toBe(2);
    await expect(async () => {
      expect(await page.locator('.cart_item').count()).toBeGreaterThan(0);
    }).toPass();
  });
});

test.describe('assertions that cannot fail', () => {
  test('a locator is always truthy', async ({ page }) => {
    const checkout = page.locator('#checkout');
    expect(checkout).toBeTruthy();
    expect(page.getByRole('button', { name: 'Checkout' })).toBeDefined();
    expect(checkout).not.toBeNull();
  });

  test('a web-first matcher that is not awaited', async ({ page }) => {
    expect(page.getByRole('button', { name: 'Checkout' })).toBeVisible();
    expect.poll(() => page.title()).toBe('Swag Labs');
    await Promise.all([expect(badge).toHaveText('1'), expect(page).toHaveURL(/inventory/)]);
    return expect(badge).toBeVisible();
  });

  test('a count that is at least zero', async ({ page }) => {
    const rows = page.locator('.cart_item');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(0);
    expect(await rows.count()).not.toBeLessThan(0);
    expect((await rows.all()).length).toBeGreaterThanOrEqual(0);
  });

  test('an assertion that is started and not finished', async ({ page }) => {
    expect(page.locator('#checkout'));
    expect(await page.title()).toBe;
    await expect(page.locator('#checkout')).not;
    const later = expect(page.locator('#checkout'));
    await later.toBeVisible();
  });

  test('an assertion after a return', async ({ page }) => {
    await page.goto('/cart.html');
    return;
    await expect(page.locator('#checkout')).toBeVisible();
  });
});

test.describe('conditional assertions', () => {
  test('inside an if', async ({ page }) => {
    const error = page.getByTestId('error');
    if (await error.isVisible()) {
      await expect(error).toContainText('locked out');
    } else {
      await expect(page).toHaveURL(/inventory/);
    }
  });

  test('inside a loop, with a count check before it', async ({ page }) => {
    const prices = await page.getByTestId('inventory-item-price').all();
    expect(prices.length).toBeGreaterThan(0);
    for (const price of prices) {
      await expect(price).toContainText('$');
    }
  });

  test('a step always runs, a short-circuit may not', async ({ page }) => {
    await test.step('open the cart', async () => {
      await expect(page).toHaveURL(/cart/);
    });
    const empty = (await page.locator('.cart_item').count()) === 0;
    empty && (await expect(page.getByText('Your cart is empty')).toBeVisible());
    empty ? await expect(badge).toBeHidden() : await expect(badge).toBeVisible();
  });

  test('the condition is the check', async ({ request }) => {
    const response = await request.get('https://api.example.test/orders/1');
    if (response.status() !== 200) throw new Error(`unexpected status ${response.status()}`);
  });
});

test.describe('swallowed errors', () => {
  test('try and catch that logs', async ({ page }) => {
    try {
      await expect(page.getByTestId('total')).toHaveText('$32.39');
    } catch (error) {
      console.log('total did not match', error);
    }
  });

  test('try and catch that throws again', async ({ page }) => {
    try {
      await expect(page.getByTestId('total')).toHaveText('$32.39');
    } catch (error) {
      await page.screenshot({ path: 'total.png' });
      throw error;
    } finally {
      await page.close();
    }
  });

  test('an empty promise catch', async ({ page }) => {
    await expect(page.getByTestId('total')).toHaveText('$32.39').catch(() => {});
    await page.getByRole('button', { name: 'Accept cookies' }).click().catch(() => undefined);
    await page.reload().then(() => expect(page).toHaveTitle('Swag Labs')).catch(console.error);
    await expect(page.getByTestId('tax')).toHaveText('$2.40').catch(console.log);
    await expect(page.getByTestId('fee')).toBeHidden().catch(console.warn);
    await expect(page.getByTestId('coupon')).toBeHidden().catch(noop);
    // A handler we cannot see, and one that turns the failure into a value: no block is stored.
    await expect(page.getByTestId('promo')).toBeVisible().catch(reportFailure);
    const hasBanner = await expect(page.getByTestId('banner')).toBeVisible().then(() => true).catch(() => false);
    expect(hasBanner).toBe(true);
    await page.waitForLoadState().finally(() => expect(badge).toBeVisible());
  });
});

test.describe('helpers', () => {
  test('a helper in this file', async () => {
    await expectBadge(1);
  });

  test('a page object from a support file', async ({ page }) => {
    const cart = new CartPage(page);
    await cart.open();
    await cart.expectItemCount(2);
    await cart.expectEmpty();
  });

  test('a function from a support file', async ({ page }) => {
    await expectLoggedIn(page);
  });

  test('a helper that only calls another helper is not counted', async ({ page }) => {
    const cart = new CartPage(page);
    await cart.checkEverything();
  });

  test('no assertion at all', async ({ page }) => {
    const cart = new CartPage(page);
    await cart.open();
    await page.getByRole('button', { name: 'Checkout' }).click();
  });
});
