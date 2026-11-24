import { expect, test } from '@playwright/test';

// The runner makes the page and closes it.
test('opens the shop', async ({ page }) => {
  await page.goto('https://www.saucedemo.com');
  await expect(page).toHaveTitle('Swag Labs');
});
