import { Cart } from '../src/cart';

describe('Cart', () => {
  it('adds an item', () => { // expect: QCR-A001
    const cart = new Cart();
    cart.add({ name: 'Backpack', price: 29.99 });
  });

  it('prints the total', () => { // expect: QCR-A001
    const cart = new Cart([{ name: 'Backpack', price: 29.99 }]);
    console.log(cart.total());
  });
});
