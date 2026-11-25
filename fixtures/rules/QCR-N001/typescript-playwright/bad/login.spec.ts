import { expect, test } from '@playwright/test';

test.describe('Login', () => { // expect: QCR-N001
  test('logs in as a standard user', async ({ page }) => {
    await page.goto('https://www.saucedemo.com');
    await page.getByTestId('username').fill('standard_user');
    await page.getByTestId('login-button').click();
    await expect(page).toHaveURL(/inventory/);
  });

  test('logs in as a visual user', async ({ page }) => {
    await page.goto('https://www.saucedemo.com');
    await page.getByTestId('username').fill('visual_user');
    await page.getByTestId('login-button').click();
    await expect(page).toHaveURL(/inventory/);
  });
});
