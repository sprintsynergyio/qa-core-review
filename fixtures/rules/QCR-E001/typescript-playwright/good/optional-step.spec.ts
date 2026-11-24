import { expect, test } from '@playwright/test';

test('adds a backpack', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/inventory.html');
  // An action that may not be needed. No assertion is inside the try block.
  try {
    await page.getByRole('button', { name: 'Accept cookies' }).click({ timeout: 2000 });
  } catch {
    // No cookie banner this time.
  }
  await page.getByRole('button', { name: 'Dismiss' }).click({ timeout: 1000 }).catch(() => {});
  // The result is used: this asks a question, it does not hide a failure.
  const hasPromo = await expect(page.getByTestId('promo-banner')).toBeVisible({ timeout: 1000 }).then(() => true).catch(() => false);
  await page.getByTestId('add-to-cart-sauce-labs-backpack').click();
  await expect(page.getByTestId('shopping-cart-badge')).toHaveText(hasPromo ? '2' : '1');
});
