import { expect, test } from '@playwright/test';

test.describe('orders API', () => {
  test('lists the orders', async ({ request }) => {
    const response = await request.get('https://api.example.test/orders?limit=10');
    expect(response.status()).toBe(200);
  });

  // An error case found by its status code.
  test('reads an order that is not there', async ({ request }) => {
    const response = await request.get('https://api.example.test/orders/999999');
    expect(response.status()).toBe(404);
  });
});
