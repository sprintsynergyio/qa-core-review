import { it, expect } from 'vitest';
import { openPrinter } from '../src/printer';

// The condition is in the code, for everyone to read.
it.skipIf(process.platform === 'win32')('prints a receipt', async () => {
  expect(await openPrinter().print('receipt')).toBe(true);
});

it.runIf(process.env.PRINTER_URL)('reaches the printer', async () => {
  expect(await openPrinter().ping()).toBe('ok');
});
