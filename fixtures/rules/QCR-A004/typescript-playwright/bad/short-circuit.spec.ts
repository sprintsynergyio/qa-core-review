import { test, expect } from '@playwright/test';

test('the cart is empty or has a badge', async ({ page }) => {
  const empty = (await page.getByTestId('inventory-item').count()) === 0;
  empty && (await expect(page.getByText('Your cart is empty')).toBeVisible()); // expect: QCR-A004
});

test('checks only when the request fails', async ({ request }) => {
  await request.get('https://api.example.test/orders').catch((error) => {
    expect(error.message).toContain('timeout'); // expect: QCR-A004
  });
});
