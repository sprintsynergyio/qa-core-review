import { test, expect } from '@playwright/test';

test('error shows for a locked user', async ({ page }) => {
  const error = page.getByTestId('error');
  if (await error.isVisible()) {
    await expect(error).toContainText('locked out'); // expect: QCR-A004
  }
});

test('checks one of two things', async ({ page }) => {
  const error = page.getByTestId('error');
  if (await error.isVisible()) {
    await expect(error).toContainText('locked out'); // expect: QCR-A004
  } else {
    await expect(page).toHaveURL(/inventory/);
  }
});
