import { test, expect } from '@playwright/test';

test.describe('Cart', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('https://www.saucedemo.com/inventory.html');
  });

  test('adds a backpack', async ({ page }) => { // expect: QCR-A001
    await page.getByTestId('add-to-cart-sauce-labs-backpack').click();
    await page.getByTestId('shopping-cart-link').click();
  });

  test('prints the badge', async ({ page }) => { // expect: QCR-A001
    const badge = await page.getByTestId('shopping-cart-badge').textContent();
    console.log('badge is', badge);
  });

  test('checks the badge', async ({ page }) => {
    await page.getByTestId('add-to-cart-sauce-labs-backpack').click();
    await expect(page.getByTestId('shopping-cart-badge')).toHaveText('1');
  });
});
