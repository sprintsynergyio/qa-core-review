// qa-core-review-disable QCR-S001
import { expect, test } from '@playwright/test';

test('shows the price of the first product', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/inventory.html');
  await expect(page.locator('//div[@id="inventory_container"]/div/div[1]/div[2]/div[2]/div')).toHaveText('$29.99');
});
