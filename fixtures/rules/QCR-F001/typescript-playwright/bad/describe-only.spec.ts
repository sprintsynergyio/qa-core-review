import { expect, test } from '@playwright/test';

test.describe.only('Checkout', () => { // expect: QCR-F001
  test('shows the form', async ({ page }) => {
    await page.goto('https://www.saucedemo.com/checkout-step-one.html');
    await expect(page.getByTestId('firstName')).toBeVisible();
  });
});

test.describe('Cart', () => {
  test('is empty at first', async ({ page }) => {
    await page.goto('https://www.saucedemo.com/cart.html');
    await expect(page.getByTestId('inventory-item')).toHaveCount(0);
  });
});
