import { expect, test } from '@playwright/test';

test('shows the cart', async ({ page }) => {
  await page.route('**/*', (route) => route.fulfill({ json: { items: [{ name: 'Backpack' }] } })); // expect: QCR-M001
  await page.goto('https://www.saucedemo.com/cart.html');
  await expect(page.getByTestId('inventory-item-name')).toHaveText('Backpack');
});
