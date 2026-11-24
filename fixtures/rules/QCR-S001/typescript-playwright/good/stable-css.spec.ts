import { expect, test } from '@playwright/test';

test('opens the cart', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/inventory.html');
  await page.locator('#login-button').click();
  await page.locator('[data-test="shopping-cart-link"]').click();
  await page.locator('.cart_list .cart_item .inventory_item_name').click();
  // Names written by people: BEM, snake case, a year, a grid column.
  await page.locator('.card__title').click();
  await page.locator('.nav_items_list').click();
  await page.locator('.product-2024').click();
  await page.locator('.col-md-12 > .btn_primary').click();
  // A short XPath on an attribute.
  await page.locator('//button[@data-test="add-to-cart-sauce-labs-backpack"]').click();
  await page.locator('//label[text()="First Name"]/following-sibling::input').fill('Sam');
  await expect(page.locator('.cart_item')).toHaveCount(1);
});
