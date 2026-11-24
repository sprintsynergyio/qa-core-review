import request from 'supertest';
import { app } from '../src/app';
import { createOrder } from '../src/orders';
import { api } from '../src/api';

jest.mock('../src/api');

test('creates an order', async () => { // expect: QCR-A001
  jest.mocked(api.post).mockResolvedValue({ id: 'o-1' });
  await createOrder({ item: 'backpack' });
});

// A request with no .expect(...) in the chain checks nothing.
test('lists the orders', async () => { // expect: QCR-A001
  await request(app).get('/orders');
});
