import { expect, test } from '@playwright/test';

test('checkout shows the form', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/checkout-step-one.html');
  await expect(page.getByTestId('lastName')).toBeVisible();
});

// An error case found by the text it checks.
test('checkout needs a first name', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/checkout-step-one.html');
  await page.getByTestId('continue').click();
  await expect(page.getByTestId('error')).toHaveText('Error: First Name is required');
});
