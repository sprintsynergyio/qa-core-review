import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import axios from 'axios';
import * as orders from './orders';
import { sendReceipt } from './mailer';
import { taxRate } from './tax';

// The module under test is replaced: the test below checks the mock, not the code.
jest.mock('./orders', () => ({ total: jest.fn(() => 42) }));
// A dependency is replaced, and one that keeps the real code.
jest.mock('./mailer');
jest.mock('./tax', () => ({ ...jest.requireActual('./tax'), taxRate: () => 0 }));
jest.unstable_mockModule('./audit', () => ({ record: jest.fn() }));

describe('orders', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    process.env.API_URL = 'https://api.example.test';
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    delete process.env.API_URL;
  });

  it('returns the total', () => {
    expect(orders.total([{ price: 40 }, { price: 2 }])).toBe(42);
  });

  it('stubs the function it then checks', () => {
    const find = jest.spyOn(orders, 'find').mockReturnValue({ id: 'o-1', status: 'PAID' });
    expect(orders.find('o-1').status).toBe('PAID');
    expect(find).toHaveBeenCalledWith('o-1');
  });

  it('spies without changing the code', async () => {
    const save = jest.spyOn(orders, 'save');
    await orders.create({ items: ['backpack'] });
    expect(save).toHaveBeenCalledTimes(1);
    expect(sendReceipt).toHaveBeenCalled();
    expect(taxRate()).toBe(0);
    save.mockRestore();
  });

  it('stubs later, in every way', async () => {
    const load = jest.spyOn(orders, 'load');
    load.mockResolvedValue({ id: 'o-1' });
    load.mockResolvedValueOnce({ id: 'o-2' });
    load.mockRejectedValue(new Error('offline'));
    load.mockRejectedValueOnce(new Error('timeout'));
    load.mockReturnValueOnce(Promise.resolve({ id: 'o-3' }));
    load.mockImplementation(async () => ({ id: 'o-4' }));
    load.mockImplementationOnce(async () => ({ id: 'o-5' }));
    await expect(orders.load('o-2')).resolves.toEqual({ id: 'o-2' });
  });

  it('moves the clock', async () => {
    const pending = orders.expireAfter(1000);
    jest.advanceTimersByTime(1000);
    await jest.advanceTimersByTimeAsync(10);
    jest.runAllTimers();
    await jest.runAllTimersAsync();
    jest.runOnlyPendingTimers();
    await expect(pending).resolves.toBe('EXPIRED');
  });

  it('changes globals and never puts them back', async () => {
    globalThis.fetch = jest.fn(async () => ({ ok: true }));
    global.navigator = { language: 'en' };
    window.innerWidth = 320;
    Date.now = () => 0;
    process.env.CURRENCY = 'EUR';
    await expect(orders.sync()).resolves.toBe(true);
  });

  it('changes an env value and puts it back', () => {
    const original = process.env.REGION;
    process.env.REGION = 'eu';
    expect(orders.region()).toBe('eu');
    process.env.REGION = original;
  });

  it('mocks one module for one test', async () => {
    jest.doMock('./stock', () => ({ inStock: () => false }));
    const { create } = await import('./orders');
    await expect(create({ items: ['backpack'] })).rejects.toThrow('out of stock');
  });

  it('calls a real API and cleans up', async () => {
    const created = await axios.post('https://api.example.test/orders', { item: 'backpack' });
    expect(created.status).toBe(201);
    await axios.get(`https://api.example.test/orders/${created.data.id}`);
    await axios.delete(`https://api.example.test/orders/${created.data.id}`);
  });
});
