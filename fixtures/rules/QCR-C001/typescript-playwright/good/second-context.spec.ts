import { expect, test } from '@playwright/test';

test('an admin sees the order of a user', async ({ browser, page }) => {
  const admin = await browser.newContext({ storageState: 'admin.json' });
  try {
    const adminPage = await admin.newPage();
    await page.goto('https://www.saucedemo.com/checkout-complete.html');
    await adminPage.goto('https://www.saucedemo.com/admin/orders.html');
    await expect(adminPage.getByTestId('order-row')).toHaveCount(1);
  } finally {
    await admin.close();
  }
});

// A second tab of the context that the runner made is closed by the runner.
test('opens the receipt in a second tab', async ({ context, page }) => {
  await page.goto('https://www.saucedemo.com/checkout-complete.html');
  const receipt = await context.newPage();
  await receipt.goto('https://www.saucedemo.com/receipt.html');
  await expect(receipt.getByTestId('receipt-total')).toHaveText('$32.39');
});
