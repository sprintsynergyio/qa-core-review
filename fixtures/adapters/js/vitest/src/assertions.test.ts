import { describe, expect, it, vi } from 'vitest';
import { page } from '@vitest/browser/context';
import { formatPrice, loadRates, rates } from './price';

describe('vitest assertions', () => {
  it('types and custom matchers', () => {
    expect(formatPrice(5, 'EUR')).toBeTypeOf('string');
    expect(formatPrice(5, 'EUR')).toSatisfy((text: string) => text.endsWith('EUR'));
    expect(formatPrice(5, 'EUR')).toEqual(expect.stringContaining('5'));
  });

  it('file snapshots', async () => {
    await expect(JSON.stringify(rates, null, 2)).toMatchFileSnapshot('./rates.json');
  });

  it('spies', async () => {
    const fetchRates = vi.fn(async () => ({ EUR: 1 }));
    const warn = vi.spyOn(console, 'warn');
    await loadRates(fetchRates);
    expect(fetchRates).toHaveBeenCalledOnce();
    expect(warn).not.toHaveBeenCalled();
  });

  it('soft and poll', async () => {
    expect.soft(rates.EUR).toBe(1);
    expect.soft(rates.USD).toBeGreaterThan(0);
    await expect.poll(() => rates.GBP).toBeDefined();
    await expect.element(page.getByText('EUR')).toBeInTheDocument();
    await vi.waitFor(() => {
      expect(rates.GBP).toBeGreaterThan(0);
    });
  });

  it('unreachable code', async () => {
    try {
      await loadRates(async () => {
        throw new Error('offline');
      });
      expect.unreachable('loadRates should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });

  it('fails by hand', () => {
    if (rates.EUR !== 1) expect.fail('EUR is the base currency');
  });

  it('an executor always runs, a timer callback may not', async () => {
    await new Promise<void>((resolve) => {
      expect(rates.EUR).toBe(1);
      setTimeout(() => {
        expect(rates.USD).toBeGreaterThan(0);
        resolve();
      }, 10);
    });
  });

  it('only stubs, no assertion', () => {
    const fetchRates = vi.fn(() => {
      throw new Error('offline');
    });
    loadRates(fetchRates).catch(() => {});
  });
});
