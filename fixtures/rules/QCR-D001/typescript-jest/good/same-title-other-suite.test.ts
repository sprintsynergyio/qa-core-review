import { Cart } from '../src/cart';
import { Wishlist } from '../src/wishlist';

describe('Cart', () => {
  it('starts empty', () => {
    const cart = new Cart();
    expect(cart.items).toHaveLength(0);
  });
});

describe('Wishlist', () => {
  it('starts empty', () => {
    const wishlist = new Wishlist();
    expect(wishlist.items).toHaveLength(0);
  });
});
