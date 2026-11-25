import { expect, test } from '@playwright/test';

test('opens the menu', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/inventory.html');
  await page.getByRole('button', { name: 'Open Menu' }).click();
  // qa-core-review-disable-next-line QCR-W001 -- the menu slides in with no event to wait for
  await page.waitForTimeout(400);
  await expect(page.getByRole('link', { name: 'Logout' })).toBeVisible();
});
