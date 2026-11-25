import { api } from '../src/api';
import '../src/price';

it('reads the price', () => {
  const priceOf = jest.fn().mockReturnValue(29.99);
  expect(priceOf('backpack')).toBe(29.99); // expect: QCR-M001
});

it('reads the stock', async () => {
  api.stockOf = jest.fn(async () => 3);
  expect(await api.stockOf('backpack')).toBe(3); // expect: QCR-M001
});
