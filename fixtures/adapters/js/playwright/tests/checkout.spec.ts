// qa-core-review-disable QCR-S001 -- the shop uses generated class names
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const users = ['standard_user', 'performance_glitch_user'];

async function login(page: Page, user = 'standard_user'): Promise<void> {
  await page.goto('https://www.saucedemo.com');
  await page.getByPlaceholder('Username').fill(user);
  await page.getByPlaceholder('Password').fill('secret_sauce');
  await page.getByRole('button', { name: 'Login' }).click();
}

test.beforeEach(async ({ page }) => {
  await login(page);
});

test.describe('Checkout', () => {
  test.afterEach(async ({ page }) => {
    await page.evaluate(() => window.localStorage.clear());
  });

  test('adds a backpack to the cart', async ({ page }) => {
    await page.getByRole('button', { name: 'Add to cart' }).first().click();
    await expect(page.getByTestId('shopping-cart-badge')).toHaveText('1');
  });

  test.only('opens the cart page', async ({ page }) => {
    await page.locator('.shopping_cart_link').click();
    // qa-core-review-disable-next-line QCR-W001 -- the cart animation has no end event
    await page.waitForTimeout(2000);
    expect(page.url()).toContain('cart');
  });

  test.skip('removes an item', async ({ page }) => {
    await page.locator('#remove-sauce-labs-backpack').click();
  });

  test.fixme('applies a coupon', async () => {});

  test('uploads a receipt', async ({ page }) => {
    test.skip(process.platform === 'win32', 'File picker is not supported on Windows CI');
    await page.setInputFiles('input[type=file]', 'receipt.pdf');
    await expect(page.getByText('Uploaded')).toBeVisible();
  });

  test('prints the order', async ({ page }) => {
    test.fixme();
    await page.getByRole('button', { name: 'Print' }).click();
  });

  for (const user of ['standard_user', 'visual_user', 'error_user']) {
    test(`logs in as ${user}`, async ({ page }) => {
      await login(page, user);
      await expect(page).toHaveURL(/inventory/);
    });
  }

  users.forEach((user) => {
    test(`sees the product list as ${user}`, async ({ page }) => {
      await expect(page.locator('.inventory_item')).toHaveCount(6);
    });
  });

  test.describe.serial('Payment', () => {
    test.beforeAll(async () => {});
    test.afterAll(async () => {});

    test('fills the address', async ({ page }) => {
      await test.step('open the form', async () => {
        await page.goto('https://www.saucedemo.com/checkout-step-one.html');
      });
      await page.fill('#first-name', 'Sam');
    });

    test.fail('rejects an empty address', async ({ page }) => {
      await page.getByRole('button', { name: 'Continue' }).click();
      await expect(page.getByTestId('error')).toBeHidden();
    });
  });

  test.describe.parallel('Sorting', () => {
    test('sorts by price', async ({ page }) => {
      await page.selectOption('.product_sort_container', 'lohi');
      const first = page.locator('.inventory_item_price').first();
      await expect(first).toHaveText('$7.99');
    });
  });
});
