import { filters } from '../src/filters';

// `only` and `fit` as plain names are not a focus.
test('keeps only in-stock items', () => {
  const only = filters.only('in-stock');
  const fit = filters.fit('large');
  expect([only.length, fit.length]).toEqual([4, 2]);
});
