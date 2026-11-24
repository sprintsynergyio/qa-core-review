import { expect, test } from '@playwright/test';

test('shows the cart', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/cart.html');
  await expect(page.getByTestId('cart-list')).toBeVisible();
  await expect(page).toHaveScreenshot('cart.png');
});
