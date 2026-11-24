import { expect, test } from '@playwright/test';
import { login } from '../support/login';

// One test body, many cases.
for (const user of ['standard_user', 'performance_glitch_user', 'visual_user']) {
  test(`login works for ${user}`, async ({ page }) => {
    await login(page, user);
    await expect(page).toHaveURL(/inventory/);
  });
}
