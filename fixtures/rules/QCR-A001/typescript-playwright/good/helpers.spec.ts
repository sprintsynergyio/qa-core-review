import { test, expect, type Page } from '@playwright/test';
import { CartPage } from './pages/cart-page';

async function expectLoggedIn(page: Page) {
  await expect(page).toHaveURL(/inventory\.html/);
}

test('counts through a helper in this file', async ({ page }) => {
  await page.goto('https://www.saucedemo.com');
  await page.getByRole('button', { name: 'Login' }).click();
  await expectLoggedIn(page);
});

test('counts through a page object', async ({ page }) => {
  const cart = new CartPage(page);
  await cart.open();
  await cart.expectItemCount(0);
});
