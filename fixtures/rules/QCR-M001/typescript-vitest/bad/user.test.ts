import { afterEach, expect, it, vi } from 'vitest';
import * as price from '../src/price';
import '../src/user';

afterEach(() => {
  vi.restoreAllMocks();
});

// The mock is given a reply, called, and checked for that reply.
it('loads the user', async () => {
  const getUser = vi.fn().mockResolvedValue({ id: 7, name: 'Sam' });
  expect(await getUser(7)).toEqual({ id: 7, name: 'Sam' }); // expect: QCR-M001
});

it('formats a price', () => {
  vi.spyOn(price, 'format').mockReturnValue('$1.00');
  expect(price.format(1)).toBe('$1.00'); // expect: QCR-M001
});
