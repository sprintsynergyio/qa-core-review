import { test, expect } from '@playwright/test';

test('an assertion that is not finished', async ({ page }) => {
  expect(page.getByText('Your Cart')); // expect: QCR-A003
  expect(await page.title()).toBe; // expect: QCR-A003
  await expect(page.getByTestId('title')).not; // expect: QCR-A003
  await expect(page).toHaveTitle('Swag Labs');
});

test('an assertion after a return', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/cart.html');
  await expect(page).toHaveTitle('Swag Labs');
  return;
  await expect(page.getByText('Your Cart')).toBeVisible(); // expect: QCR-A003
});

test('an assertion after a throw', async ({ page }) => {
  await expect(page).toHaveTitle('Swag Labs');
  throw new Error('not written yet');
  await expect(page.getByText('Your Cart')).toBeVisible(); // expect: QCR-A003
});
