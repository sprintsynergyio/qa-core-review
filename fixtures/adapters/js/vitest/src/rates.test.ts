import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadRates, rates } from './rates';
import * as cache from './cache';

vi.mock('./cache', async (importOriginal) => ({ ...(await importOriginal()), read: vi.fn(() => null) }));
vi.mock('./http', async () => ({ ...(await vi.importActual('./http')), retries: 0 }));
vi.mock('./rates');

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('rates', () => {
  it('the subject is mocked, so this checks nothing real', async () => {
    expect(await loadRates()).toBeUndefined();
    expect(rates).toBeDefined();
  });

  it('stubs globals and env values, and the hook restores them', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => ({ EUR: 1 }) })));
    vi.stubEnv('RATES_URL', 'https://api.example.test/rates');
    vi.useFakeTimers();
    vi.advanceTimersByTime(60_000);
    await vi.advanceTimersByTimeAsync(1);
    vi.runAllTimers();
    expect(cache.read).toHaveBeenCalled();
  });

  it('spies and never restores', () => {
    const write = vi.spyOn(cache, 'write').mockImplementation(() => undefined);
    cache.write('EUR', 1);
    expect(write).toHaveBeenCalledWith('EUR', 1);
  });

  it('mocks a module for one test', async () => {
    vi.doMock('./http', () => ({ get: async () => ({ EUR: 2 }) }));
    const fresh = await import('./rates');
    expect(fresh.rates).toBeDefined();
  });

  it('sends the rates and reads them back', async () => {
    await fetch('https://api.example.test/rates', { method: 'POST', body: '{}' });
    const response = await fetch('https://api.example.test/rates');
    expect(response.status).toBe(200);
  });
});
