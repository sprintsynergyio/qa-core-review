import { Cart } from '../src/cart';

describe('Cart', () => {
  it('adds an item', () => {
    const cart = new Cart().add('backpack');
    expect(cart.items).toEqual(['backpack']);
  });

  it('keeps the item it was given', () => { // expect: QCR-D001
    const cart = new Cart().add('backpack');
    expect(cart.items).toEqual(['backpack']);
  });
});
