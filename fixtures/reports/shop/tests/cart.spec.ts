import { expect, test } from '@playwright/test';

test.describe('Cart', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('https://www.saucedemo.com/inventory.html');
    await page.waitForTimeout(250);
  });

  test('adds an item @smoke | <b>bold</b> & `code` "quoted"', async ({ page }) => {
    await page.locator('#add-to-cart-sauce-labs-backpack').click();
    await page.waitForTimeout(3000);
    await expect(page.locator('.shopping_cart_badge')).toHaveText('1');
  });

  test('opens', async ({ page }) => {
    await page.locator('.shopping_cart_link').click();
    await page.waitForTimeout(500);
  });

  test('is empty at first', async ({ page }) => {
    // qa-core-review-disable-next-line QCR-T002 -- the badge fades out with no event to wait for
    await page.waitForTimeout(100);
    await expect(page.locator('.shopping_cart_badge')).toBeHidden();
  });
});
