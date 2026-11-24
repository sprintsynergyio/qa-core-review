import { chromium, expect, test } from '@playwright/test';

test('opens the shop', async () => {
  const browser = await chromium.launch(); // expect: QCR-C001
  const page = await browser.newPage(); // expect: QCR-C001
  await page.goto('https://www.saucedemo.com');
  await expect(page).toHaveTitle('Swag Labs');
});
