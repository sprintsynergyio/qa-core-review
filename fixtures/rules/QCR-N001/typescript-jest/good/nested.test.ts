import { Cart } from '../src/cart';

describe('Cart', () => {
  describe('add', () => {
    it('adds an item', () => {
      expect(new Cart().add('backpack').items).toEqual(['backpack']);
    });

    it('rejects a negative quantity', () => {
      expect(() => new Cart().add('backpack', -1)).toThrow('quantity');
    });
  });

  describe('total', () => {
    it('adds the prices', () => {
      expect(new Cart().add('backpack').add('onesie').total).toBe(37.98);
    });

    it('is zero for an empty cart', () => {
      expect(new Cart().total).toBe(0);
    });
  });

  // One test is not a group.
  describe('clear', () => {
    it('removes every item', () => {
      expect(new Cart().add('backpack').clear().items).toHaveLength(0);
    });
  });
});
