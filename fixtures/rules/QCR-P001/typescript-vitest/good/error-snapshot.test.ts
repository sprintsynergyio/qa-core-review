import { expect, it } from 'vitest';
import { toCsv } from '../src/export';

it('refuses rows of different shapes', () => {
  expect(() => toCsv([{ id: 7 }, { total: 1 }])).toThrow('Row 2 has other columns than row 1');
});
