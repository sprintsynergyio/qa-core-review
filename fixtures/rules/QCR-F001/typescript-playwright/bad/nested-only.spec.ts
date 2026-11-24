import { expect, test } from '@playwright/test';

test.describe('Inventory', () => {
  test.describe.serial('sorting', () => {
    test.only('sorts by price', async ({ page }) => { // expect: QCR-F001
      await page.goto('https://www.saucedemo.com/inventory.html');
      await page.getByTestId('product-sort-container').selectOption('lohi');
      await expect(page.getByTestId('inventory-item-price').first()).toHaveText('$7.99');
    });
  });
});
