import { placeOrder } from '../src/orders';
import * as mailer from '../src/mailer';

afterEach(() => {
  jest.restoreAllMocks();
});

it('sends a mail', () => {
  const send = jest.spyOn(mailer, 'send').mockResolvedValue(undefined);
  placeOrder({ id: 8 });
  expect(send).toHaveBeenCalledWith('order-8');
});
