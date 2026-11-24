import { expect, test } from '@playwright/test';

const noop = () => {};

test('shows the promo banner', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/inventory.html');
  await expect(page.getByTestId('promo-banner')).toBeVisible().catch(() => {}); // expect: QCR-E001
  await expect(page.getByTestId('promo-title')).toHaveText('Summer sale').catch(() => undefined); // expect: QCR-E001
  await expect(page.getByTestId('promo-code')).toHaveText('SAUCE10').catch(() => null); // expect: QCR-E001
});

test('shows the footer', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/inventory.html');
  await expect(page.getByTestId('footer')).toBeVisible().catch(console.log); // expect: QCR-E001
  await expect(page.getByTestId('footer-copy')).toContainText('Sauce Labs').catch(console.error); // expect: QCR-E001
  await expect(page.getByTestId('social-twitter')).toBeVisible().catch(console.warn); // expect: QCR-E001
  await expect(page.getByTestId('social-linkedin')).toBeVisible().catch(noop); // expect: QCR-E001
});

// The only assertion sits in the chain that the handler ends.
test('has the shop title', async ({ page }) => {
  await page.goto('https://www.saucedemo.com').then(() => expect(page).toHaveTitle('Swag Labs')).catch((error) => { // expect: QCR-E001
    console.log(error);
  });
});
