import { expect, test } from '@playwright/test';

test('has the cart structure', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/cart.html');
  await expect(page.getByTestId('cart-list')).toMatchAriaSnapshot({ name: 'cart.aria.yml' }); // expect: QCR-P001
});
