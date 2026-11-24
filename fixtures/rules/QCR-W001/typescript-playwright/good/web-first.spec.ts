import { expect, test } from '@playwright/test';

test.setTimeout(60_000);

test('adds a backpack to the cart', async ({ page }) => {
  page.setDefaultTimeout(10_000);
  await page.goto('https://www.saucedemo.com/inventory.html');
  await page.getByRole('button', { name: 'Add to cart' }).first().click();
  await expect(page.getByTestId('shopping-cart-badge')).toHaveText('1', { timeout: 10_000 });
});
