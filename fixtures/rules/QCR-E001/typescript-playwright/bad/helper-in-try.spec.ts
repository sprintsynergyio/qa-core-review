import { expect, test, type Page } from '@playwright/test';

async function expectLoggedIn(page: Page) {
  await expect(page.getByTestId('title')).toHaveText('Products');
}

// The assertion is in a helper. The catch block still hides its failure.
test('logs in', async ({ page }) => {
  await page.goto('https://www.saucedemo.com');
  await page.getByTestId('login-button').click();
  let failed = false;
  try { // expect: QCR-E001
    await expectLoggedIn(page);
  } catch (error) {
    failed = true;
    await page.screenshot({ path: 'login-failed.png' });
  }
  console.log({ failed });
});
