import { expect, test } from '@playwright/test';

test.describe('Checkout', () => {
  test('shows the total', async ({ page }) => {
    await page.goto('https://www.saucedemo.com/checkout-step-two.html');
    await expect(page.getByTestId('total-label')).toHaveText('Total: $32.39');
  });

  // Two tests with one title: a failure report cannot tell them apart.
  test('shows the total', async ({ page }) => { // expect: QCR-D001
    await page.goto('https://www.saucedemo.com/checkout-step-two.html');
    await expect(page.getByTestId('tax-label')).toHaveText('Tax: $2.40');
  });
});
