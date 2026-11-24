import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('https://www.saucedemo.com/cart.html');
  expect(page.getByText('Your Cart')).toBeVisible(); // expect: QCR-A003
});

test('checkout button is shown', async ({ page }) => {
  expect(page.getByRole('button', { name: 'Checkout' })).toBeVisible(); // expect: QCR-A003
  expect(page).toHaveURL(/cart\.html/); // expect: QCR-A003
  expect.poll(() => page.title()).toBe('Swag Labs'); // expect: QCR-A003
  expect.soft(page.getByTestId('title')).toHaveText('Your Cart'); // expect: QCR-A003
});
