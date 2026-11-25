import { expect, it, vi } from 'vitest';
import * as price from '../src/price';
import { UserService } from '../src/user';

// The mock is what the real code depends on. The real code is called and checked.
it('loads the user', async () => {
  const http = { get: vi.fn().mockResolvedValue({ id: 7, name: 'Sam' }) };
  expect(await new UserService(http).getUser(7)).toEqual({ id: 7, name: 'Sam' });
  expect(http.get).toHaveBeenCalledWith('/users/7');
});

it('formats a price', () => {
  expect(price.format(1)).toBe('$1.00');
});
