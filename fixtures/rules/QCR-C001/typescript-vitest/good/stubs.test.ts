import { afterEach, expect, it, vi } from 'vitest';
import { apiUrl, loadRates } from '../src/rates';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it('loads the rates', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{"GBP":0.79}')));
  expect(await loadRates()).toEqual({ GBP: 0.79 });
});

it('uses the staging API', () => {
  vi.stubEnv('API_URL', 'https://staging.example.test');
  expect(apiUrl()).toBe('https://staging.example.test');
});
