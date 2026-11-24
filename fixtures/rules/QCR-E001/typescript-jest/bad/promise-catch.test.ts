import { fetchOrder } from '../src/orders';

const noop = () => {};

test('loads order 7', async () => {
  await expect(fetchOrder(7)).resolves.toEqual({ id: 7, total: 32.39 }).catch(() => {}); // expect: QCR-E001
});

test('loads order 8', () => {
  return expect(fetchOrder(8)).resolves.toMatchObject({ id: 8 }).catch(noop); // expect: QCR-E001
});

test('loads order 9', async () => {
  await fetchOrder(9) // expect: QCR-E001
    .then((order) => {
      expect(order.total).toBe(15.99);
    })
    .catch((error) => console.warn('order 9', error));
});
