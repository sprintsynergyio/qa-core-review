import { api } from '../src/api';
import { priceWithTax } from '../src/price';

it('adds the tax to the price', () => {
  const taxRate = jest.fn().mockReturnValue(0.08);
  expect(priceWithTax(29.99, taxRate)).toBe(32.39);
});

it('reads the stock', async () => {
  expect(await api.stockOf('backpack')).toBeGreaterThan(0);
});
