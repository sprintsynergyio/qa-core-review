import { $ } from '@wdio/globals';

describe('Cart', () => {
  it('has a badge', async () => {
    const badge = await $('[data-test="shopping-cart-badge"]');
    expect(badge).toBeTruthy(); // expect: QCR-A003
    expect($('[data-test="missing"]')).toBeDefined(); // expect: QCR-A003
  });
});
