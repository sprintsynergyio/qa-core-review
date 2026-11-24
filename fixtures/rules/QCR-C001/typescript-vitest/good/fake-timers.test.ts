import { afterEach, expect, it, vi } from 'vitest';
import { formatToday } from '../src/date';

afterEach(() => {
  vi.useRealTimers();
});

it('uses the fixed date', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-03-15'));
  expect(formatToday()).toBe('Mar 15, 2026');
});
