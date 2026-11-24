import { expect, test } from '@playwright/test';

const SETTLE = 1500;

test('adds a backpack to the cart', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/inventory.html');
  await page.getByRole('button', { name: 'Add to cart' }).first().click();
  await page.waitForTimeout(3000); // expect: QCR-W001
  await expect(page.getByTestId('shopping-cart-badge')).toHaveText('1');
});

// The amount is not a literal. It is still a fixed sleep.
test('opens the cart', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/inventory.html');
  await page.waitForTimeout(SETTLE); // expect: QCR-W001
  await page.getByTestId('shopping-cart-link').click();
  await expect(page).toHaveURL(/cart\.html/);
});
