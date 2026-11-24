import { expect, test } from '@playwright/test';

test.describe('Cart', () => {
  test('shows only the items you added', async ({ page }) => {
    await page.goto('https://www.saucedemo.com/cart.html');
    await expect(page.getByTestId('inventory-item')).toHaveCount(0);
  });
});
