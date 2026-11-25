import { expect, test } from '@playwright/test';

test.describe('orders API', () => { // expect: QCR-N001
  test('lists the orders', async ({ request }) => {
    const response = await request.get('https://api.example.test/orders');
    expect(response.status()).toBe(200);
  });

  test('reads one order', async ({ request }) => {
    const response = await request.get('https://api.example.test/orders/7');
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ id: 7 });
  });
});
