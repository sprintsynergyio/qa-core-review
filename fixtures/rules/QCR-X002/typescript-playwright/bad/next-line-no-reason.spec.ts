import { expect, test } from '@playwright/test';

test('adds a backpack to the cart', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/inventory.html');
  await page.getByTestId('add-to-cart-sauce-labs-backpack').click();
  // qa-core-review-disable-next-line QCR-W001
  await page.waitForTimeout(500);
  await expect(page.getByTestId('shopping-cart-badge')).toHaveText('1');
});
