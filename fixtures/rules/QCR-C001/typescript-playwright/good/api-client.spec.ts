import { expect, request, test } from '@playwright/test';

test('the orders API is up', async () => {
  const api = await request.newContext({ baseURL: 'https://api.example.test' });
  const response = await api.get('/orders');
  expect(response.status()).toBe(200);
  await api.dispose();
});
