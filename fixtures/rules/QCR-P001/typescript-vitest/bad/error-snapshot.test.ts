import { expect, it } from 'vitest';
import { toCsv } from '../src/export';

it('refuses rows of different shapes', () => {
  expect(() => toCsv([{ id: 7 }, { total: 1 }])).toThrowErrorMatchingSnapshot(); // expect: QCR-P001
});

it('names the bad row', () => {
  expect(() => toCsv([{ id: 7 }, { total: 1 }])).toThrowErrorMatchingInlineSnapshot(); // expect: QCR-P001
});
