import { expect, test } from '@playwright/test';

test('lists the products', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/inventory.html');
  expect(await page.getByTestId('inventory-list').innerText()).toMatchSnapshot('products.txt'); // expect: QCR-P001
});
