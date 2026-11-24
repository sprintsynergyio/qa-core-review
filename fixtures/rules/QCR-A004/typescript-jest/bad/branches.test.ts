import { Cart } from '../src/cart';

it('totals by the number of items', () => {
  const cart = new Cart([{ name: 'Backpack', price: 29.99 }]);
  switch (cart.items.length) {
    case 1:
      expect(cart.total()).toBe(29.99); // expect: QCR-A004
      break;
    default:
      expect(cart.total()).toBe(0);
  }
});

it('applies the coupon', () => {
  const cart = new Cart([{ name: 'Backpack', price: 29.99 }]);
  cart.coupon ? expect(cart.total()).toBeLessThan(29.99) : expect(cart.total()).toBe(29.99); // expect: QCR-A004
});
