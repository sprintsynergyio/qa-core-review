import { expect, test } from '@playwright/test';

test('zeigt den Preis in € an', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/checkout-step-two.html');
  await expect(page.locator('.summary_total_label')).toContainText('€');
});

test('rejects an empty first name', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/checkout-step-one.html');
  await page.locator('#continue').click();
  await expect(page.locator('[data-test="error"]')).toContainText('First Name is required');
});
