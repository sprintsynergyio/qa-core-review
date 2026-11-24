import { expect, test } from '@playwright/test';

test.skip('rejects an empty password', async ({ page }) => { // expect: QCR-F002
  await page.goto('https://www.saucedemo.com');
  await page.getByTestId('login-button').click();
  await expect(page.getByTestId('error')).toContainText('Password is required');
});

test.fixme('rejects a locked user', async ({ page }) => { // expect: QCR-F002
  await page.goto('https://www.saucedemo.com');
  await expect(page.getByTestId('error')).toContainText('locked out');
});
