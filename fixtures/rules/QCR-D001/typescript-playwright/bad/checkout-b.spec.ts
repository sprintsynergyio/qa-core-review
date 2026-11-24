import { expect, test } from '@playwright/test';

// Copied from checkout-a.spec.ts.
test('the order total is right', async ({ page }) => { // expect: QCR-D001
  await page.goto('https://www.saucedemo.com/checkout-step-two.html');
  await expect(page.getByTestId('total-label')).toHaveText('Total: $32.39');
});
