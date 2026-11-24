import { expect, test } from '@playwright/test';

test('order total is correct', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/checkout-step-two.html');
  try {
    await expect(page.getByTestId('total-label')).toHaveText('Total: $32.39');
  } catch (error) {
    await page.screenshot({ path: 'total.png' });
    throw error;
  }
});

test('closes the page whatever happens', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/inventory.html');
  try {
    await expect(page.getByTestId('inventory-list')).toBeVisible();
  } finally {
    await page.close();
  }
});

test('adds what went wrong to the error', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/cart.html');
  await expect(page.getByTestId('cart-list')).toBeVisible().catch((error) => {
    throw new Error('The cart did not load', { cause: error });
  });
});
