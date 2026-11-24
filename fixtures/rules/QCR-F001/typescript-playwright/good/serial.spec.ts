import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test.describe.parallel('Inventory', () => {
  test('shows six products', async ({ page }) => {
    await page.goto('https://www.saucedemo.com/inventory.html');
    await expect(page.getByTestId('inventory-item')).toHaveCount(6);
  });
});
