import { expect, test } from '@playwright/test';

// A soft assertion goes on after a failure and still fails the test at the end.
test('shows every price', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/inventory.html');
  await expect.soft(page.getByTestId('inventory-item-price').first()).toHaveText('$29.99');
  await expect.soft(page.getByTestId('inventory-item-price').last()).toHaveText('$15.99');
  try {
    await expect.soft(page.getByTestId('shopping-cart-badge')).toBeHidden();
  } catch {
    // A soft assertion does not throw, so there is nothing to hide here.
  }
  await expect(page.getByTestId('inventory-item')).toHaveCount(6);
});
