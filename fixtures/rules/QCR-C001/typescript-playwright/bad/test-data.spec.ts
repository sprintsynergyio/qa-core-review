import { expect, test } from '@playwright/test';

// Reported as info: the order stays in the system after the run.
test('creates an order', async ({ request }) => {
  const response = await request.post('https://api.example.test/orders', { data: { item: 'backpack' } }); // expect: QCR-C001
  expect(response.status()).toBe(201);
});
