import { expect, test } from '@playwright/test';

test('sorts the products by price', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/inventory.html');
  await page.getByTestId('product-sort-container').selectOption('lohi');
  // qa-core-review-disable-next-line QCR-W001 --
  await page.waitForTimeout(800);
  await expect(page.getByTestId('inventory-item-price').first()).toHaveText('$7.99');
});
