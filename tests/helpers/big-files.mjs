// Generated test files of about 1,000 lines, for timing and robustness tests.
// Each one is valid code in its language, written the way an AI agent writes tests.

function repeat(count, block) {
  return Array.from({ length: count }, (_, index) => block(index + 1)).join('\n');
}

export const BIG_FILES = {
  typescript: {
    name: 'big.spec.ts',
    text: `import { test, expect } from '@playwright/test';\n\n${repeat(125, (n) => `test('adds item ${n} to the cart', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/inventory.html');
  await page.getByRole('button', { name: 'Add to cart' }).nth(${n % 6}).click();
  const badge = page.getByTestId('shopping-cart-badge');
  await expect(badge).toHaveText('1');
  await expect(page).toHaveURL(/inventory/);
});
`)}`,
  },
  python: {
    name: 'test_big.py',
    text: `import pytest\nfrom shop.cart import Cart\n\n\n${repeat(200, (n) => `def test_cart_total_${n}():
    cart = Cart()
    cart.add("backpack", ${n})
    assert cart.total() == ${n}

`)}`,
  },
  java: {
    name: 'BigTest.java',
    text: `package shop;\n\nimport static org.junit.jupiter.api.Assertions.assertEquals;\nimport org.junit.jupiter.api.Test;\n\nclass BigTest {\n${repeat(166, (n) => `    @Test
    void addsItem${n}() {
        Cart cart = new Cart();
        cart.add("backpack", ${n});
        assertEquals(${n}, cart.total());
    }
`)}}\n`,
  },
};
