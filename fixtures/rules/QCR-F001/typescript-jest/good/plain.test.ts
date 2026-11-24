import { Cart } from '../src/cart';

describe('Cart', () => {
  it('adds only what you ask for', () => {
    expect(new Cart().add('backpack').items).toEqual(['backpack']);
  });
});
