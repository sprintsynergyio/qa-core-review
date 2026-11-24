import { expect, test } from '@playwright/test';
import { login } from '../support/login';

test('login works', async ({ page }) => {
  await login(page, 'standard_user');
  await expect(page).toHaveURL(/inventory/);
});

// The same body under another title. Spaces and comments make no difference.
test('login works for standard user', async ({ page }) => { // expect: QCR-D001
  await login(page, 'standard_user');

  await expect(page).toHaveURL(/inventory/); // still the same check
});

test('a standard user can log in', async ({ page }) => { await login(page, 'standard_user'); await expect(page).toHaveURL(/inventory/); }); // expect: QCR-D001
