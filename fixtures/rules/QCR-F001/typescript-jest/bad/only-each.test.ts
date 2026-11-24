import { priceOf } from '../src/price';

test.only('prices a backpack', () => { // expect: QCR-F001
  expect(priceOf('backpack')).toBe(29.99);
});

it.only.each([['bike-light', 9.99], ['onesie', 7.99]])('prices %s', (id, price) => { // expect: QCR-F001
  expect(priceOf(id)).toBe(price);
});
