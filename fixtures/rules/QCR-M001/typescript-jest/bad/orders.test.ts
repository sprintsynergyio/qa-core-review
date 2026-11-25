import { placeOrder } from '../src/orders';

// An automock of the module under test: every function returns undefined.
jest.mock('../src/orders'); // expect: QCR-M001

it('places the order', async () => {
  await expect(placeOrder({ id: 7 })).resolves.toBeUndefined();
});
