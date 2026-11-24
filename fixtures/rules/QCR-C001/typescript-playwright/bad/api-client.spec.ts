import { expect, request, test } from '@playwright/test';

test('the orders API is up', async () => {
  const api = await request.newContext({ baseURL: 'https://api.example.test' }); // expect: QCR-C001
  const response = await api.get('/orders');
  expect(response.ok()).toBe(true);
});
