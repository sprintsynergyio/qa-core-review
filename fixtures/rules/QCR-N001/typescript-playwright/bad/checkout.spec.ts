import { expect, test } from '@playwright/test';

test('checkout shows the form', async ({ page }) => { // expect: QCR-N001
  await page.goto('https://www.saucedemo.com/checkout-step-one.html');
  await expect(page.getByTestId('firstName')).toBeVisible();
});

test('checkout shows the total', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/checkout-step-two.html');
  await expect(page.getByTestId('total-label')).toHaveText('Total: $32.39');
});
