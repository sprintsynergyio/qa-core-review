import { Cart } from '../src/cart';

fit('adds an item', () => { // expect: QCR-F001
  expect(new Cart().add('backpack').items).toHaveLength(1);
});

it('starts empty', () => {
  expect(new Cart().items).toHaveLength(0);
});
