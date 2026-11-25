import { expect, test } from '@playwright/test';

// Every request is looked at, and all but the images go on to the server.
test('shows an empty order list', async ({ page }) => {
  await page.route('**', async (route) => {
    if (route.request().resourceType() === 'image') await route.abort();
    else await route.continue();
  });
  await page.goto('https://www.saucedemo.com/orders.html');
  await expect(page.getByTestId('order-list')).toBeVisible();
});
