import { Cart } from '../src/cart';

describe('Cart totals', () => {
  it('adds the prices', () => {
    const cart = new Cart().add('backpack').add('onesie');
    expect(cart.total).toBe(37.98);
  });

  it('adds the prices', () => { // expect: QCR-D001
    const cart = new Cart().add('backpack').add('bike-light');
    expect(cart.total).toBe(39.98);
  });
});
