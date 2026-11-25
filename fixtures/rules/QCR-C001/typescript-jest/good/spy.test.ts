import { placeOrder } from '../src/orders';
import * as mailer from '../src/mailer';

afterEach(() => {
  jest.restoreAllMocks();
});

it('sends a mail', () => {
  const send = jest.spyOn(mailer, 'send').mockResolvedValue(undefined);
  expect(placeOrder({ id: 8 })).toEqual({ id: 8, status: 'placed' });
  expect(send).toHaveBeenCalledWith('order-8');
});
