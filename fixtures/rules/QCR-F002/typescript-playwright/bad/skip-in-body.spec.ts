import { expect, test } from '@playwright/test';

// A bare test.skip() or test.fixme() in the body has no condition: the test never runs.
test('uploads a file', async ({ page }) => { // expect: QCR-F002
  test.skip();
  await page.goto('https://www.saucedemo.com/inventory.html');
  await expect(page.getByTestId('upload')).toBeVisible();
});

test('downloads the invoice', async ({ page }) => { // expect: QCR-F002
  test.fixme();
  await page.goto('https://www.saucedemo.com/checkout-complete.html');
  await expect(page.getByTestId('invoice')).toBeVisible();
});
