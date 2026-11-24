import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('https://www.saucedemo.com/cart.html');
  await expect(page.getByText('Your Cart')).toBeVisible();
});

test('checkout button is shown', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Checkout' })).toBeVisible();
  await expect.poll(() => page.title()).toBe('Swag Labs');
  await Promise.all([expect(page).toHaveURL(/cart\.html/), expect(page.getByTestId('title')).toHaveText('Your Cart')]);
});

test('the last assertion is returned', async ({ page }) => {
  return expect(page.getByRole('button', { name: 'Checkout' })).toBeEnabled();
});
