import { expect, test } from '@playwright/test';

// A test with only visual checks is a valid choice. It is reported as info.
test('shows the cart', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/cart.html');
  await expect(page).toHaveScreenshot('cart.png'); // expect: QCR-P001
});

test('shows the header and the footer', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/inventory.html');
  await expect(page.getByTestId('header-container')).toHaveScreenshot('header.png'); // expect: QCR-P001
  await expect(page.getByTestId('footer')).toHaveScreenshot('footer.png');
});
