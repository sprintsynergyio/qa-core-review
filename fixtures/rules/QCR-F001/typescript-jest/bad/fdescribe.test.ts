import { Cart } from '../src/cart';

fdescribe('Cart totals', () => { // expect: QCR-F001
  it('adds the prices', () => {
    expect(new Cart().add('backpack').add('bike-light').total).toBe(39.98);
  });
});

describe.only('Cart limits', () => { // expect: QCR-F001
  it('takes at most 99 of one item', () => {
    expect(() => new Cart().add('backpack', 100)).toThrow('99');
  });
});
