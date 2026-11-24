import { $ } from '@wdio/globals';

describe('Cart', () => {
  it('has a badge with the count', async () => {
    const badge = await $('[data-test="shopping-cart-badge"]');
    await expect(badge).toExist();
    await expect(badge).toHaveText('1');
    expect(await badge.getText()).toBe('1');
  });
});
