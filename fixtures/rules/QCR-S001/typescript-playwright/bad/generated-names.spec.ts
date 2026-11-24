import { expect, test } from '@playwright/test';

// Names that a styling library or a framework writes at build time.
test('opens the menu', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/inventory.html');
  await page.locator('.css-1q2w3e4').click(); // expect: QCR-S001
  await page.locator('button.sc-bdnylx').click(); // expect: QCR-S001
  await page.locator('.jss42').click(); // expect: QCR-S001
  await page.locator('.makeStyles-root-12').click(); // expect: QCR-S001
  await page.locator('._button_1x2y3_12').click(); // expect: QCR-S001
  await page.locator('.Button_primary__3xK2a').click(); // expect: QCR-S001
  await page.locator('.ng-tns-c123-4').click(); // expect: QCR-S001
  await page.locator('#ember123').click(); // expect: QCR-S001
  await page.locator('#item-4f3a2b1c').click(); // expect: QCR-S001
  await page.locator('[class*="css-1q2w3e4"]').click(); // expect: QCR-S001
  await expect(page.getByRole('navigation')).toBeVisible();
});
