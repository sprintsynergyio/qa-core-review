import { afterEach, beforeEach, describe, expect, it, test, vi } from 'vitest';
import { formatPrice, loadRates } from './price';

const isCI = Boolean(process.env.CI);

describe('formatPrice', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('formats euros', () => {
    expect(formatPrice(29.99, 'EUR')).toBe('29,99 EUR');
  });

  it.fails('rounds half up', () => {
    expect(formatPrice(0.005, 'EUR')).toBe('0,01 EUR');
  });

  test.skipIf(isCI)('reads the live rates', async () => {
    const rates = await loadRates();
    expect(rates.EUR).toBeGreaterThan(0);
  });

  test.runIf(isCI)('uses the cached rates', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    await loadRates();
    expect(spy).not.toHaveBeenCalled();
  });

  test.for([
    ['EUR', 'EUR'],
    ['USD', '$'],
  ])('uses the %s symbol', ([currency, symbol]) => {
    expect(formatPrice(1, currency)).toContain(symbol);
  });
});

describe.concurrent('loadRates', () => {
  it('returns every currency', async () => {
    expect(Object.keys(await loadRates())).toHaveLength(2);
  });
});

describe.sequential('rate cache', () => {
  ['EUR', 'USD'].map((currency) =>
    it(`caches ${currency}`, async () => {
      await loadRates();
      vi.advanceTimersByTime(1000);
      expect((await loadRates())[currency]).toBeDefined();
    }),
  );
});
