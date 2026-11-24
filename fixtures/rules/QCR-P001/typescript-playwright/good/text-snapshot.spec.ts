import { expect, test } from '@playwright/test';

test('lists the products', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/inventory.html');
  await expect(page.getByTestId('inventory-item')).toHaveCount(6);
  expect(await page.getByTestId('inventory-list').innerText()).toMatchSnapshot('products.txt');
});
