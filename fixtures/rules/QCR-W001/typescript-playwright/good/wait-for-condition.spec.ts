import { expect, test } from '@playwright/test';

test('loads the order list', async ({ page }) => {
  const orders = page.waitForResponse('https://api.example.test/orders');
  await page.goto('https://www.saucedemo.com/inventory.html');
  await page.waitForLoadState('domcontentloaded');
  expect((await orders).status()).toBe(200);
  await page.getByTestId('shopping-cart-link').click();
  await page.waitForURL(/cart\.html/);
  await expect(page.getByTestId('cart-list')).toBeVisible();
});

test('polls until the job is done', async ({ request }) => {
  await expect.poll(async () => (await request.get('https://api.example.test/jobs/7')).status(), { timeout: 15_000 }).toBe(200);
});
