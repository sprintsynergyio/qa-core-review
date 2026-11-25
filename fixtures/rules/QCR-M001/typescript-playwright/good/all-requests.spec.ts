import { expect, test } from '@playwright/test';

test('shows the cart', async ({ page }) => {
  await page.route('**/api/cart', (route) => route.fulfill({ json: { items: [{ name: 'Backpack' }] } }));
  await page.goto('https://www.saucedemo.com/cart.html');
  await expect(page.getByTestId('inventory-item-name')).toHaveText('Backpack');
});
