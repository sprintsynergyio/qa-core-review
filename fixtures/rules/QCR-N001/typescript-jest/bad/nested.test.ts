import { Cart } from '../src/cart';

describe('Cart', () => {
  // Each suite is its own group. This one has an error case.
  describe('add', () => {
    it('adds an item', () => {
      expect(new Cart().add('backpack').items).toEqual(['backpack']);
    });

    it('rejects a negative quantity', () => {
      expect(() => new Cart().add('backpack', -1)).toThrow('quantity');
    });
  });

  describe('total', () => { // expect: QCR-N001
    it('adds the prices', () => {
      expect(new Cart().add('backpack').add('onesie').total).toBe(37.98);
    });

    it('counts an item twice when it is added twice', () => {
      expect(new Cart().add('onesie').add('onesie').total).toBe(15.98);
    });
  });
});
