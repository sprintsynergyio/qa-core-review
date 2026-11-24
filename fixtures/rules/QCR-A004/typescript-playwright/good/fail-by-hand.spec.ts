import { test, expect } from '@playwright/test';

// The condition is the check: the test fails when it is true.
test('the orders endpoint answers', async ({ request }) => {
  const response = await request.get('https://api.example.test/orders');
  if (response.status() !== 200) throw new Error(`unexpected status ${response.status()}`);
});

test('one check always runs', async ({ page }) => {
  await expect(page).toHaveTitle('Swag Labs');
  if (await page.getByTestId('banner').isVisible()) {
    await expect(page.getByTestId('banner')).toContainText('Sale');
  }
});
