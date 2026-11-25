import { checkout } from '../src/checkout';
import { charge } from '../src/payments';
import { send } from '../src/mailer';

jest.mock('../src/payments');
jest.mock('../src/mailer');

it('charges and mails', async () => {
  await checkout({ id: 7, total: 32.39 });
  expect(charge).toHaveBeenCalledWith(32.39); // expect: QCR-M001
  expect(send).toHaveBeenCalledTimes(1);
});
