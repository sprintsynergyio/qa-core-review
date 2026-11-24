import { test } from '@playwright/test';
import { CartPage } from '../good/pages/cart-page';

test('creates an order', async ({ request }) => { // expect: QCR-A001
  await request.post('https://api.example.test/orders', { data: { item: 'backpack' } });
});

test('opens the cart in a step', async ({ page }) => { // expect: QCR-A001
  await test.step('open the cart', async () => {
    await page.goto('https://www.saucedemo.com/cart.html');
  });
});

// `open` is a page object method with no assertion in it.
test('opens the cart with a page object', async ({ page }) => { // expect: QCR-A001
  const cart = new CartPage(page);
  await cart.open();
});
