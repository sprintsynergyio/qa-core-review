import { expect, test } from '@playwright/test';
import { login } from '../support/login';

// The same steps with other data are two cases, not a copy.
test('a locked user sees an error', async ({ page }) => {
  await login(page, 'locked_out_user');
  await expect(page.getByTestId('error')).toContainText('locked out');
});

test('an unknown user sees an error', async ({ page }) => {
  await login(page, 'nobody');
  await expect(page.getByTestId('error')).toContainText('do not match');
});
