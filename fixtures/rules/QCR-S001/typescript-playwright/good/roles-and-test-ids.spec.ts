import { expect, test } from '@playwright/test';

test('logs in and adds a backpack', async ({ page }) => {
  await page.goto('https://www.saucedemo.com');
  await page.getByPlaceholder('Username').fill('standard_user');
  await page.getByLabel('Password').fill('secret_sauce');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.getByTestId('add-to-cart-sauce-labs-backpack').click();
  // The first match of a role or a test id is fine, and so is index 0.
  await page.getByRole('button', { name: 'Add to cart' }).first().click();
  await page.getByTestId('inventory-item-name').last().click();
  await page.getByRole('listitem').nth(0).click();
  await expect(page.getByTestId('shopping-cart-badge')).toHaveText('2');
});
