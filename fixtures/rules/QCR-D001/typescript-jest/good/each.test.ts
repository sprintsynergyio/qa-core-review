import { priceOf } from '../src/price';

it.each([['backpack', 29.99], ['bike-light', 9.99]])('prices %s', (id, price) => {
  const found = priceOf(id);
  expect(found).toBe(price);
});

// Two tables with one body are two tests with their own data.
it.each([['onesie', 7.99], ['fleece-jacket', 49.99]])('prices %s', (id, price) => {
  const found = priceOf(id);
  expect(found).toBe(price);
});
