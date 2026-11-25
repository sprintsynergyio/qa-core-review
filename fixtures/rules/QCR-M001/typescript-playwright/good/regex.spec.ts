import { expect, test } from '@playwright/test';

// The fake answers every request, and the test checks the request, not the page.
test('asks for the profile once', async ({ page }) => {
  const asked: string[] = [];
  await page.route(/.*/, (route) => {
    asked.push(route.request().url());
    return route.fulfill({ json: { name: 'Sam' } });
  });
  await page.goto('https://www.saucedemo.com/profile.html');
  expect(asked.filter((url) => url.endsWith('/api/profile'))).toHaveLength(1);
});
