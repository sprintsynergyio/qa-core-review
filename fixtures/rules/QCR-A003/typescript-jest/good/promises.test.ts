import { loadCart } from '../src/cart';

it('loads a cart', async () => {
  await expect(loadCart('c-1')).resolves.toHaveProperty('items');
});

it('rejects a missing cart', () => {
  return expect(loadCart('missing')).rejects.toThrow('not found');
});

it('loads two carts', () => Promise.all([expect(loadCart('c-1')).resolves.toBeDefined(), expect(loadCart('c-2')).resolves.toBeDefined()]));
