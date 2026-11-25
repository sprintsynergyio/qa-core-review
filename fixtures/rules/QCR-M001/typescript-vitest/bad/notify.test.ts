import { expect, it, vi } from 'vitest';
import { send } from '../src/mailer';
import { notify } from '../src/notify';

vi.mock('../src/mailer');

it('sends a mail when an order is placed', async () => {
  await notify({ id: 7 });
  expect(send).toHaveBeenCalledTimes(1); // expect: QCR-M001
});
