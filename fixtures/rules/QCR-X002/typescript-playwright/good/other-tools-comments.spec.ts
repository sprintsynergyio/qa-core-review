import { expect, test } from '@playwright/test';

// A comment for another tool is not a suppression for this one.
// eslint-disable-next-line no-console
console.log('checkout suite');

test('goes to the checkout form', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/cart.html');
  // The word disable in an ordinary comment means nothing here.
  await page.getByTestId('checkout').click();
  await expect(page).toHaveURL(/checkout-step-one/);
});
