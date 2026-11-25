import { expect, test } from '@playwright/test';

test('shows an empty order list', async ({ page }) => {
  await page.route('**', async (route) => { // expect: QCR-M001
    await route.fulfill({ status: 200, body: '[]' });
  });
  await page.goto('https://www.saucedemo.com/orders.html');
  await expect(page.getByTestId('empty-state')).toBeVisible();
});
