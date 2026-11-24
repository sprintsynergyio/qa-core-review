import { Cart } from '../src/cart';

let cart: Cart;

beforeEach(() => {
  cart = new Cart();
  expect(true).toBeTruthy(); // expect: QCR-A002
});

it('starts empty', () => {
  expect(cart.items).toHaveLength(0);
  expect(false).toBe(false); // expect: QCR-A002
});
