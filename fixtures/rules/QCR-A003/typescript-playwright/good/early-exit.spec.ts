import { test, expect } from '@playwright/test';

// A return inside a condition does not cut off the assertion after it.
test('leaves early on the mobile layout', async ({ page, isMobile }) => {
  await expect(page).toHaveTitle('Swag Labs');
  if (isMobile) {
    return;
  }
  await expect(page.getByTestId('desktop-menu')).toBeVisible();
});

test('values are plain values, not locators', async ({ page }) => {
  const title = await page.title();
  const text = await page.getByTestId('title').textContent();
  expect(title).toBeTruthy();
  expect(text).not.toBeNull();
});
