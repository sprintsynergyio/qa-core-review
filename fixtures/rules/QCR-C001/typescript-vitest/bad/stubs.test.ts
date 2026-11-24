import { expect, it, vi } from 'vitest';
import { apiUrl, loadRates } from '../src/rates';

it('loads the rates', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{"EUR":0.92}'))); // expect: QCR-C001
  expect(await loadRates()).toEqual({ EUR: 0.92 });
});

it('uses the staging API', () => {
  vi.stubEnv('API_URL', 'https://api.example.test'); // expect: QCR-C001
  expect(apiUrl()).toBe('https://api.example.test');
});
