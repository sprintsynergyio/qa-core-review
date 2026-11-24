import { expect, test } from '@playwright/test';

test.describe.skip('Checkout', () => { // expect: QCR-F002
  test('shows the form', async ({ page }) => {
    await page.goto('https://www.saucedemo.com/checkout-step-one.html');
    await expect(page.getByTestId('firstName')).toBeVisible();
  });
});

test.describe.fixme('Wishlist', () => { // expect: QCR-F002
  test('is empty at first', async ({ page }) => {
    await page.goto('https://www.saucedemo.com/wishlist.html');
    await expect(page.getByTestId('wishlist-item')).toHaveCount(0);
  });
});

// An expected failure is reported as info.
test.fail('rounds the tax up', async ({ page }) => { // expect: QCR-F002
  await page.goto('https://www.saucedemo.com/checkout-step-two.html');
  await expect(page.getByTestId('tax-label')).toHaveText('Tax: $2.40');
});
