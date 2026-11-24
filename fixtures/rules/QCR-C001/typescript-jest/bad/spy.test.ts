import { placeOrder } from '../src/orders';
import * as mailer from '../src/mailer';

it('sends a mail', () => {
  const send = jest.spyOn(mailer, 'send').mockResolvedValue(undefined); // expect: QCR-C001
  placeOrder({ id: 7 });
  expect(send).toHaveBeenCalledWith('order-7');
});
