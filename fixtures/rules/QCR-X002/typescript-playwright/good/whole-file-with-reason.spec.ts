// qa-core-review-disable QCR-S001 -- the legacy footer has no test ids yet, tracked in SHOP-142
import { expect, test } from '@playwright/test';

test('shows the copyright line in the footer', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/inventory.html');
  await expect(page.locator('//footer/div[1]')).toContainText('Sauce Labs');
});
