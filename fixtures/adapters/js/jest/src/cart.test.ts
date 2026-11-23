import { afterAll, beforeAll, describe, expect, it, jest, test } from '@jest/globals';
import { Cart } from './cart';
import { sendReceipt } from './mailer';

jest.mock('./mailer');

describe('Cart', () => {
  let cart: Cart;

  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    cart = new Cart();
  });

  test('adds an item', () => {
    cart.add({ name: 'Backpack', price: 29.99 });
    expect(cart.count()).toBe(1);
  });

  test.each([
    [1, 9.99],
    [2, 19.98],
    [3, 29.97],
  ])('totals %i items to %d', (count, total) => {
    for (let i = 0; i < count; i += 1) cart.add({ name: 'Light', price: 9.99 });
    expect(cart.total()).toBeCloseTo(total);
  });

  it.each`
    code       | discount
    ${'SAVE5'} | ${5}
    ${'HALF'}  | ${50}
  `('applies the $code coupon', ({ code, discount }) => {
    expect(cart.applyCoupon(code)).toBe(discount);
  });

  it.concurrent('sends a receipt', async () => {
    await cart.checkout();
    expect(sendReceipt).toHaveBeenCalledTimes(1);
  });

  test.failing('rejects a negative price', () => {
    cart.add({ name: 'Broken', price: -1 });
    expect(cart.total()).toBe(0);
  });

  test.todo('merges two carts');

  fit('is focused by mistake', () => {
    expect(cart.count()).toBe(0);
  });

  xit('is switched off', () => {
    expect(cart.count()).toBe(1);
  });

  xtest('is switched off too', () => {});
});

describe.each(['EUR', 'USD'])('Cart in %s', (currency) => {
  test('formats the total', () => {
    expect(new Cart(currency).format()).toContain(currency);
  });
});

fdescribe('Focused suite', () => {
  it('runs alone', () => {
    expect(true).toBe(true);
  });
});

xdescribe('Old checkout', () => {
  it('is never run', () => {});
});
