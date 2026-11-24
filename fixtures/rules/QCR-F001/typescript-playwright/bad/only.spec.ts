import { expect, test } from '@playwright/test';

test.only('adds item to cart', async ({ page }) => { // expect: QCR-F001
  await page.goto('https://www.saucedemo.com/inventory.html');
  await page.getByTestId('add-to-cart-sauce-labs-backpack').click();
  await expect(page.getByTestId('shopping-cart-badge')).toHaveText('1');
});

test('opens the cart', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/cart.html');
  await expect(page.getByTestId('cart-list')).toBeVisible();
});
