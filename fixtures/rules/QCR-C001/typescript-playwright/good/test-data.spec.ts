import { expect, test } from '@playwright/test';

test('creates an order', async ({ request }) => {
  const response = await request.post('https://api.example.test/orders', { data: { item: 'bike-light' } });
  expect(response.status()).toBe(201);
  const { id } = await response.json();
  await request.delete(`https://api.example.test/orders/${id}`);
});
