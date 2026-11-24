import { test, expect } from '@playwright/test';

test('checks what the element shows', async ({ page }) => {
  const checkout = page.locator('[data-test="checkout"]');
  await expect(checkout).toBeVisible();
  await expect(checkout).toHaveText('Checkout');
});

test('checks a real count', async ({ page }) => {
  const rows = page.getByTestId('inventory-item');
  await expect(rows).toHaveCount(2);
  expect(await rows.count()).toBeGreaterThan(0);
  expect(await rows.count()).toBeGreaterThanOrEqual(1);
  expect((await rows.allTextContents()).length).toBe(2);
});
