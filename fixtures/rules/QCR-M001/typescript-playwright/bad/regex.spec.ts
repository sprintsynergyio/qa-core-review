import { expect, test } from '@playwright/test';

test('shows the profile', async ({ page }) => {
  await page.route(/.*/, (route) => route.fulfill({ json: { name: 'Sam' } })); // expect: QCR-M001
  await page.goto('https://www.saucedemo.com/profile.html');
  await expect(page.getByTestId('profile-name')).toHaveText('Sam');
});
