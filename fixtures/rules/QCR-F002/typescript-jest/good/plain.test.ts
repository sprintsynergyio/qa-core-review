import { Cart } from '../src/cart';

describe('Cart', () => {
  it('does not skip the empty check', () => {
    expect(new Cart().items).toHaveLength(0);
  });
});
