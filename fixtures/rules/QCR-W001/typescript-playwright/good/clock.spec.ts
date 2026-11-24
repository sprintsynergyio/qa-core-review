import { expect, test } from '@playwright/test';

// A fake clock moves time forward at once. Nothing sleeps.
test('logs out after 30 minutes without a click', async ({ page }) => {
  await page.clock.install();
  await page.goto('https://www.saucedemo.com/inventory.html');
  await page.clock.fastForward('30:00');
  await expect(page.getByTestId('login-button')).toBeVisible();
});
