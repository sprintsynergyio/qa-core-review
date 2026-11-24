import { expect, test } from '@playwright/test';

test('an admin sees the order of a user', async ({ browser, page }) => {
  const admin = await browser.newContext({ storageState: 'admin.json' }); // expect: QCR-C001
  const adminPage = await admin.newPage(); // expect: QCR-C001
  await page.goto('https://www.saucedemo.com/checkout-complete.html');
  await adminPage.goto('https://www.saucedemo.com/admin/orders.html');
  await expect(adminPage.getByTestId('order-row')).toHaveCount(1);
});
