import { expect, test } from '@playwright/test';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test('sorts by price', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/inventory.html');
  await page.getByTestId('product-sort-container').selectOption('lohi');
  await new Promise((resolve) => setTimeout(resolve, 1000)); // expect: QCR-W001
  await sleep(500); // expect: QCR-W001
  await expect(page.getByTestId('inventory-item-price').first()).toHaveText('$7.99');
});
