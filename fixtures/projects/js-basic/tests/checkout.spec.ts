import { test, expect } from '@playwright/test';
import { login } from './helpers/login';

test.describe('Checkout', () => {
  test('adds a backpack to the cart', async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: 'Add to cart' }).first().click();
    await expect(page.getByTestId('shopping-cart-badge')).toHaveText('1');
  });

  test('opens the cart page', async ({ page }) => {
    await login(page);
    await page.locator('.shopping_cart_link').click();
    await page.waitForTimeout(2000);
  });
});
