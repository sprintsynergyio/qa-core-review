import { expect, it } from 'vitest';
import { toCsv } from '../src/export';

it('exports the orders', () => {
  const csv = toCsv([{ id: 7, total: 32.39 }]);
  expect(csv.split('\n')).toHaveLength(2);
  expect(csv).toMatchSnapshot();
});
