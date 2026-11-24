import { priceOf } from '../src/price';

it.each([['bike-light', 9.99], ['onesie', 7.99]])('prices %s', (id, price) => {
  expect(priceOf(id)).toBe(price);
});

test.concurrent('prices a backpack', async () => {
  expect(priceOf('backpack')).toBe(29.99);
});
