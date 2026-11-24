import { loadCart } from '../src/cart';

it('loads a cart', () => {
  expect(loadCart('c-1')).resolves.toHaveProperty('items'); // expect: QCR-A003
});

it('rejects a missing cart', async () => {
  expect(loadCart('missing')).rejects.toThrow('not found'); // expect: QCR-A003
});
