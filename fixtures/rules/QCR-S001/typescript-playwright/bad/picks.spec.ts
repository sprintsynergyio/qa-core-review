import { expect, test } from '@playwright/test';

// Picks by position are reported as info.
test('opens the third product', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/inventory.html');
  await page.locator('.inventory_item').nth(2).click(); // expect: QCR-S001
  await page.locator('.inventory_item_name').first().click(); // expect: QCR-S001
  await page.locator('.inventory_item_name').last().click(); // expect: QCR-S001
  await page.getByText('Add to cart').first().click(); // expect: QCR-S001
  await page.getByRole('listitem').nth(3).click(); // expect: QCR-S001
  await expect(page.getByTestId('inventory-item-name')).toHaveText('Sauce Labs Bolt T-Shirt');
});
