import { expect, test } from '@playwright/test';

// A text or a name is not a selector string, whatever characters it has.
test('follows the steps', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/inventory.html');
  await page.getByText('Home > Products > Bags > Backpacks > Sauce Labs Backpack').click();
  await page.getByRole('link', { name: 'Step 1 > Step 2 > Step 3 > Step 4 > Step 5' }).click();
  await page.getByPlaceholder('a.css-1q2w3e4 > b > c > d > e').fill('x');
  await page.locator('text=Sauce Labs Backpack').click();
  await expect(page.getByTitle('Cart (1)')).toBeVisible();
});
