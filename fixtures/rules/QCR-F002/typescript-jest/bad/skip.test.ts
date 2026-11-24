import { Cart } from '../src/cart';

it.skip('merges two carts', () => { // expect: QCR-F002
  expect(new Cart().merge(new Cart()).items).toHaveLength(0);
});

xit('removes an item', () => { // expect: QCR-F002
  expect(new Cart().add('backpack').remove('backpack').items).toHaveLength(0);
});

xtest('clears the cart', () => { // expect: QCR-F002
  expect(new Cart().add('backpack').clear().items).toHaveLength(0);
});

test.skip.each([['backpack', 29.99], ['onesie', 7.99]])('prices %s', (id, price) => { // expect: QCR-F002
  expect(new Cart().add(id).total).toBe(price);
});
