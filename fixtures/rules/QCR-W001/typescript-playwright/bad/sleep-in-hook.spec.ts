import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('https://www.saucedemo.com/inventory.html');
  await page.waitForTimeout(2000); // expect: QCR-W001
});

test('shows six products', async ({ page }) => {
  await expect(page.getByTestId('inventory-item')).toHaveCount(6);
});
