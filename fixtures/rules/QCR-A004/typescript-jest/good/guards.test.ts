import { api } from '../src/api';
import { loadCart } from '../src/cart';

// expect.assertions makes the test fail when the catch block did not run.
it('rejects a missing cart', async () => {
  expect.assertions(1);
  try {
    await loadCart('missing');
  } catch (error) {
    expect(error).toHaveProperty('code', 404);
  }
});

it('every cart has a total', async () => {
  expect.hasAssertions();
  const carts = await api.list();
  carts.forEach((cart) => expect(cart.total()).toBeGreaterThan(0));
});
