import { expect, it, vi } from 'vitest';
import { formatToday } from '../src/date';

it('uses the fixed date', () => {
  vi.useFakeTimers(); // expect: QCR-C001
  vi.setSystemTime(new Date('2026-01-01'));
  expect(formatToday()).toBe('Jan 1, 2026');
});
