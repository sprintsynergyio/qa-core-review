import { test, expect } from '@playwright/test';

test('pays for an order', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/checkout-step-two.html');
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByText('Thank you for your order!')).toBeVisible();
});
