import { expect, test } from '@playwright/test';

test.skip(process.platform === 'win32', 'File picker is not supported on Windows CI');

test.describe('Print', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Printing to PDF works in Chromium only');

  test('prints the receipt', async ({ page }) => {
    await page.goto('https://www.saucedemo.com/checkout-complete.html');
    await expect(page.getByTestId('complete-header')).toBeVisible();
  });
});
