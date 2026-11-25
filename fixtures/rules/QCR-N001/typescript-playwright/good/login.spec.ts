import { expect, test } from '@playwright/test';

test.describe('Login', () => {
  test('logs in as a problem user', async ({ page }) => {
    await page.goto('https://www.saucedemo.com');
    await page.getByTestId('username').fill('problem_user');
    await page.getByTestId('login-button').click();
    await expect(page).toHaveURL(/inventory/);
  });

  test('keeps a locked user out', async ({ page }) => {
    await page.goto('https://www.saucedemo.com');
    await page.getByTestId('username').fill('locked_out_user');
    await page.getByTestId('login-button').click();
    await expect(page.getByTestId('error')).toContainText('locked out');
  });
});
