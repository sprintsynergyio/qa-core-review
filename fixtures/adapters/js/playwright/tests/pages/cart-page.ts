import { expect, type Locator, type Page } from '@playwright/test';

// A page object. Methods that contain an assertion go into the helper index.
export class CartPage {
  readonly items: Locator;

  constructor(private readonly page: Page) {
    this.items = page.getByTestId('inventory-item');
  }

  async open() {
    await this.page.goto('https://www.saucedemo.com/cart.html');
  }

  async expectItemCount(count: number) {
    await expect(this.items).toHaveCount(count);
  }

  expectEmpty = async () => {
    await expect(this.items).toHaveCount(0);
  };

  // Calls another helper but has no assertion of its own: one level deep only.
  async checkEverything() {
    await this.expectItemCount(1);
  }
}

export async function expectLoggedIn(page: Page) {
  await expect(page).toHaveURL(/inventory\.html/);
}

export const itemNames = async (page: Page) => page.getByTestId('inventory-item-name').allTextContents();
