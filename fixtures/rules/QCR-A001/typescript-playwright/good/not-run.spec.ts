import { test, expect } from '@playwright/test';

// A test that fails by hand when the answer is wrong has a check: the condition.
test('the orders endpoint answers', async ({ request }) => {
  const response = await request.get('https://api.example.test/orders');
  if (response.status() !== 200) throw new Error(`unexpected status ${response.status()}`);
});

test('checks inside a step', async ({ page }) => {
  await test.step('open the cart', async () => {
    await page.goto('https://www.saucedemo.com/cart.html');
    await expect(page.getByText('Your Cart')).toBeVisible();
  });
});
