import { test, expect } from '@playwright/test';

test('error shows for a locked user', async ({ page }) => {
  await expect(page.getByTestId('error')).toContainText('locked out');
});

// A check of the length before the loop means the loop cannot pass with nothing in it.
test('every price has a dollar sign', async ({ page }) => {
  const prices = await page.getByTestId('inventory-item-price').all();
  expect(prices.length).toBeGreaterThan(0);
  for (const price of prices) {
    await expect(price).toContainText('$');
  }
});
