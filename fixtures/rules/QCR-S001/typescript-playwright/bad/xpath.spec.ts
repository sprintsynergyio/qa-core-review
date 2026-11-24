import { expect, test } from '@playwright/test';

test('adds four products from the list', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/inventory.html');
  // Starts at the page root.
  await page.locator('/html/body/div[1]/div/div[2]/button').click(); // expect: QCR-S001
  // Positional indexes.
  await page.locator('//div[3]/div[2]/button[2]').click(); // expect: QCR-S001
  await page.locator('(//button)[last()]').click(); // expect: QCR-S001
  // Four steps.
  await page.locator('xpath=//div[@id="root"]//ul/li/a').click(); // expect: QCR-S001
  await expect(page.getByTestId('shopping-cart-badge')).toHaveText('3');
});
