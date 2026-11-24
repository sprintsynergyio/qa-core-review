import { expect, test } from '@playwright/test';

// A body of one statement is too small to call a copy.
test.describe('as a guest', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test('has the shop title', async ({ page }) => {
    await expect(page).toHaveTitle('Swag Labs');
  });
});

test.describe('as a user', () => {
  test('has the shop title', async ({ page }) => {
    await expect(page).toHaveTitle('Swag Labs');
  });
});
