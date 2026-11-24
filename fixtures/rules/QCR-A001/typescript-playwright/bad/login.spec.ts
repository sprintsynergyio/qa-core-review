import { test } from '@playwright/test';

test('user can log in', async ({ page }) => { // expect: QCR-A001
  await page.goto('https://www.saucedemo.com');
  await page.getByPlaceholder('Username').fill('standard_user');
  await page.getByPlaceholder('Password').fill('secret_sauce');
  await page.getByRole('button', { name: 'Login' }).click();
});
