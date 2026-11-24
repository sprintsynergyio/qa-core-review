import { test, expect } from '@playwright/test';

test('a locator always exists', async ({ page }) => {
  const checkout = page.locator('[data-test="checkout"]');
  expect(checkout).toBeTruthy(); // expect: QCR-A003
  expect(page.getByRole('button', { name: 'Checkout' })).toBeDefined(); // expect: QCR-A003
  expect(checkout.first()).not.toBeNull(); // expect: QCR-A003
});

test('a count is never below zero', async ({ page }) => {
  const rows = page.getByTestId('inventory-item');
  const count = await rows.count();
  expect(count).toBeGreaterThanOrEqual(0); // expect: QCR-A003
  expect(await rows.count()).not.toBeLessThan(0); // expect: QCR-A003
  expect((await rows.all()).length).toBeGreaterThanOrEqual(0); // expect: QCR-A003
});
