import { expect, test } from '@playwright/test';

test('checks out the second product', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/inventory.html');
  // Position in the page.
  await page.locator('#root > div > div:nth-child(2) > div.css-1q2w3e4 > button').click(); // expect: QCR-S001
  await page.locator('li:nth-of-type(3) a').click(); // expect: QCR-S001
  await page.locator('tr:nth-last-child(1) td').click(); // expect: QCR-S001
  await page.locator('.inventory_item >> nth=2').click(); // expect: QCR-S001
  await page.locator('text=Add to cart >> nth=1').click(); // expect: QCR-S001
  // Four levels of page structure.
  await page.locator('#root > div > main > section > button').click(); // expect: QCR-S001
  await page.click('.page .list .item .price .amount'); // expect: QCR-S001
  await expect(page.getByTestId('shopping-cart-badge')).toHaveText('1');
});
