import type { Page } from '@playwright/test';

export async function login(page: Page, user: string): Promise<void> {
  await page.goto('https://www.saucedemo.com');
  await page.getByTestId('username').fill(user);
  await page.getByTestId('password').fill('secret_sauce');
  await page.getByTestId('login-button').click();
}
