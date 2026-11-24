import { test, expect } from '@playwright/test';

test('every price has a dollar sign', async ({ page }) => {
  for (const price of await page.getByTestId('inventory-item-price').all()) {
    await expect(price).toContainText('$'); // expect: QCR-A004
  }
});

test('every name is filled in', async ({ page }) => {
  const names = await page.getByTestId('inventory-item-name').allTextContents();
  names.forEach((name) => {
    expect(name).not.toBe(''); // expect: QCR-A004
  });
});
