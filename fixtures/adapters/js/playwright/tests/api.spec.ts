import { test as base, expect } from '@playwright/test';

const test = base.extend<{ token: string }>({
  token: async ({}, use) => {
    await use('test-token');
  },
});

test.use({ baseURL: 'https://api.example.test' });

test('lists the orders', async ({ request, token }) => {
  const response = await request.get('/orders', { headers: { authorization: `Bearer ${token}` } });
  expect(response.status()).toBe(200);
  expect(await response.json()).toHaveLength(3);
});

test('creates an order', { tag: '@smoke' }, async ({ request }) => {
  const response = await request.post('/orders', { data: { item: 'backpack' } });
  expect(response.ok()).toBeTruthy();
});

test('lists the orders', async ({ request }) => {
  const response = await request.get('/orders?page=2');
  expect(response.status()).toBe(200);
});
