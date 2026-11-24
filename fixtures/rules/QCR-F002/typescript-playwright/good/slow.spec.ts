import { expect, test } from '@playwright/test';

// A slow mark and a word in a title are not a skip.
test('does not skip the tax line', async ({ page }) => {
  test.slow();
  await page.goto('https://www.saucedemo.com/checkout-step-two.html');
  await expect(page.getByTestId('tax-label')).toBeVisible();
});
