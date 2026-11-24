import { expect, it } from 'vitest';
import { toCsv } from '../src/export';

it('exports the orders', () => {
  expect(toCsv([{ id: 7, total: 32.39 }])).toMatchSnapshot(); // expect: QCR-P001
  expect(toCsv([])).toMatchInlineSnapshot(`"id,total"`);
});
