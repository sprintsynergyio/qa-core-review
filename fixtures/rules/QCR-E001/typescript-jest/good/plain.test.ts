import { fetchOrder } from '../src/orders';

test('loads order 7', async () => {
  await expect(fetchOrder(7)).resolves.toEqual({ id: 7, total: 32.39 });
});

// A handler that throws again does not hide the failure.
test('loads order 8', async () => {
  await expect(fetchOrder(8)).resolves.toMatchObject({ id: 8 }).catch((error) => {
    throw new Error('order 8 did not load', { cause: error });
  });
});
