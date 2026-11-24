import { test, expect } from '@playwright/test';

// The callback of a step always runs.
test('checks inside steps', async ({ page }) => {
  await test.step('open the cart', async () => {
    await expect(page).toHaveURL(/cart/);
  });
});

test('retries until it passes', async ({ page }) => {
  await expect(async () => {
    expect(await page.getByTestId('inventory-item').count()).toBe(2);
  }).toPass();
});
