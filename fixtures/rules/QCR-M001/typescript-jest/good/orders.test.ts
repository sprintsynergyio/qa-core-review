import { placeOrder } from '../src/orders';

// requireActual keeps the real module. Only the id maker is replaced.
jest.mock('../src/orders', () => ({ ...jest.requireActual('../src/orders'), nextId: () => 7 }));

it('places the order', async () => {
  await expect(placeOrder({ items: ['backpack'] })).resolves.toEqual({ id: 7, status: 'placed' });
});
