import { expect, test } from '@playwright/test';

test('uploads a file', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'The file picker is not supported on WebKit');
  await page.goto('https://www.saucedemo.com/inventory.html');
  await expect(page.getByTestId('upload')).toBeVisible();
});

test('downloads the invoice', async ({ page, isMobile }) => {
  test.fixme(isMobile, 'Downloads open in a new tab on mobile, tracked in SHOP-142');
  await page.goto('https://www.saucedemo.com/checkout-complete.html');
  await expect(page.getByTestId('invoice')).toBeVisible();
});
