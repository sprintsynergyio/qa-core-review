import { expect, type Locator, type Page } from '@playwright/test';

// A page object outside the test folders. The review finds it through the import in the spec.
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
}
