import { api } from '../src/api';

it('every cart has a total', async () => {
  const carts = await api.list();
  expect(carts).not.toHaveLength(0);
  for (const cart of carts) {
    expect(cart.total()).toBeGreaterThan(0);
  }
});

it('checks the result of a promise', async () => {
  await api.list().then((carts) => {
    expect(carts).toHaveLength(2);
  });
});
