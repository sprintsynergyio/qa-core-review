import { expect, it, vi } from 'vitest';
import { send } from '../src/mailer';
import { notify } from '../src/notify';

vi.mock('../src/mailer');

it('sends a mail when an order is placed', async () => {
  const result = await notify({ id: 7 });
  expect(result).toEqual({ order: 7, mailed: true });
  expect(send).toHaveBeenCalledTimes(1);
});

// A plain callback only watches the real code. That is not over-mocking.
it('calls back when the mail is out', async () => {
  const done = vi.fn();
  await notify({ id: 8 }, done);
  expect(done).toHaveBeenCalledWith(8);
});
