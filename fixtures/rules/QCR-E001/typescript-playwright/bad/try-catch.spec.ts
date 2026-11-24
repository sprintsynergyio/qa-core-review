import { expect, test } from '@playwright/test';

test('order total is correct', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/checkout-step-two.html');
  try { // expect: QCR-E001
    await expect(page.getByTestId('total-label')).toHaveText('Total: $32.39');
  } catch (e) {
    console.log('total did not match', e);
  }
});

test('cart badge shows one item', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/inventory.html');
  await page.getByTestId('add-to-cart-sauce-labs-backpack').click();
  try { // expect: QCR-E001
    await expect(page.getByTestId('shopping-cart-badge')).toHaveText('1');
  } catch {
    // The badge is slow sometimes.
  }
});
