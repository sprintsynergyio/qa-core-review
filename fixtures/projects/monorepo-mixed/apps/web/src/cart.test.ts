import { describe, expect, it } from 'vitest';
import { total } from './cart';

describe('total', () => {
  it('adds the prices', () => {
    expect(total([10, 5])).toBe(15);
  });
});
