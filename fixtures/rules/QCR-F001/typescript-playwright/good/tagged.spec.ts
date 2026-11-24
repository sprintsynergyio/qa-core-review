import { expect, test } from '@playwright/test';

// A tag selects tests from the command line. Nothing is left in the code to forget.
test('logs in', { tag: '@smoke' }, async ({ page }) => {
  await page.goto('https://www.saucedemo.com');
  await expect(page.getByTestId('login-button')).toBeVisible();
});

const only = ['standard_user', 'visual_user'];
for (const user of only) {
  test(`logs in as ${user}`, async ({ page }) => {
    await page.goto('https://www.saucedemo.com');
    await page.getByTestId('username').fill(user);
    await expect(page.getByTestId('username')).toHaveValue(user);
  });
}
