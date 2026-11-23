import { describe, expect, it, jest } from '@jest/globals';
import { Cart, loadCart } from './cart';
import { api } from './api';

const backpack = { name: 'Backpack', price: 29.99 };

function expectTotal(cart: Cart, total: number) {
  expect(cart.total()).toBeCloseTo(total);
}

const expectEmpty = (cart: Cart) => {
  expect(cart.items).toHaveLength(0);
};

describe('value matchers', () => {
  it('equality', () => {
    const cart = new Cart([backpack]);
    expect(cart.items.length).toBe(1);
    expect(cart.items[0]).toEqual(backpack);
    expect(cart.items).toStrictEqual([backpack]);
    expect(cart.total()).toBeCloseTo(29.99, 2);
    expect(cart.total()).not.toBe(0);
  });

  it('truthiness and nullness', () => {
    const cart = new Cart([backpack]);
    expect(cart.has('Backpack')).toBeTruthy();
    expect(cart.has('Bike Light')).toBeFalsy();
    expect(cart.find('Bike Light')).toBeUndefined();
    expect(cart.find('Backpack')).toBeDefined();
    expect(cart.coupon).toBeNull();
    expect(cart.total() / 0).not.toBeNaN();
  });

  it('comparison, contains and type', () => {
    const cart = new Cart([backpack]);
    expect(cart.total()).toBeGreaterThan(0);
    expect(cart.total()).toBeGreaterThanOrEqual(29.99);
    expect(cart.total()).toBeLessThan(100);
    expect(cart.total()).toBeLessThanOrEqual(29.99);
    expect(cart.names()).toContain('Backpack');
    expect(cart.items).toContainEqual(backpack);
    expect(cart.summary()).toMatch(/1 item/);
    expect(cart.items[0]).toMatchObject({ name: 'Backpack' });
    expect(cart.items[0]).toHaveProperty('price', 29.99);
    expect(cart).toBeInstanceOf(Cart);
    expect(cart.items).toHaveLength(1);
    expect(new Set(cart.names()).size).toBe(1);
  });

  it('errors', async () => {
    const cart = new Cart([]);
    expect(() => cart.add({ name: 'Free', price: -1 })).toThrow('price');
    expect(() => cart.remove('Missing')).toThrowError(RangeError);
    await expect(loadCart('missing')).rejects.toThrow('not found');
    await expect(loadCart('c-1')).resolves.toHaveProperty('items');
    expect(() => cart.checkout()).toThrowErrorMatchingSnapshot();
    expect(() => cart.checkout()).toThrowErrorMatchingInlineSnapshot(`"The cart is empty"`);
  });

  it('snapshots', () => {
    const cart = new Cart([backpack]);
    expect(cart.summary()).toMatchSnapshot();
    expect(cart.summary()).toMatchInlineSnapshot();
  });
});

describe('mocks', () => {
  it('checks how a mock was called', () => {
    const onChange = jest.fn();
    const save = jest.spyOn(api, 'save');
    const cart = new Cart([], { onChange });
    cart.add(backpack);
    expect(onChange).toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(backpack);
    expect(onChange).toHaveBeenLastCalledWith(backpack);
    expect(onChange).toHaveBeenNthCalledWith(1, backpack);
    expect(onChange).toHaveReturned();
    expect(onChange).toHaveReturnedWith(undefined);
    expect(save).toBeCalled();
    expect(save).toBeCalledWith(cart);
    expect(save).toBeCalledTimes(1);
    expect(onChange.mock.calls.length).toBeGreaterThanOrEqual(0);
  });
});

describe('assertions that cannot fail or may not run', () => {
  it('trivial', () => {
    const cart = new Cart([backpack]);
    expect(true).toBe(true);
    expect(cart.total()).toEqual(cart.total());
    expect(1).toBeTruthy();
    expect('').toBe('');
    expect([]).toEqual([]);
    expect(-1).toBeLessThan(0);
  });

  it('a promise matcher that is not awaited', () => {
    expect(loadCart('c-1')).resolves.toBeDefined();
    expect(loadCart('missing')).rejects.toThrow();
  });

  it('expect in a callback', async () => {
    const carts = await api.list();
    carts.forEach((cart) => {
      expect(cart.total()).toBeGreaterThan(0);
    });
    carts.map((cart) => expect(cart.items).not.toHaveLength(0));
  });

  it('expect in a callback, with a guard', async () => {
    expect.assertions(2);
    const carts = await api.list();
    carts.forEach((cart) => expect(cart.total()).toBeGreaterThan(0));
  });

  it('expect in a catch, with a guard', async () => {
    expect.hasAssertions();
    try {
      await loadCart('missing');
    } catch (error) {
      expect(error).toHaveProperty('code', 404);
    }
  });

  it('a switch and a ternary', () => {
    const cart = new Cart([backpack]);
    switch (cart.items.length) {
      case 1:
        expect(cart.total()).toBe(29.99);
        break;
      default:
        expect(cart.total()).toBe(0);
    }
    cart.coupon ? expect(cart.total()).toBeLessThan(29.99) : expect(cart.total()).toBe(29.99);
    cart.coupon ?? expect(cart.discount()).toBe(0);
    while (cart.items.length > 0) {
      cart.remove(cart.items[0].name);
      expect(cart.total()).toBeGreaterThanOrEqual(0);
    }
  });

  it('after a fail call', () => {
    fail('not written yet');
    expect(new Cart([]).total()).toBe(0);
  });
});

describe('try blocks', () => {
  it('swallows the failure', () => {
    try {
      expect(new Cart([backpack]).total()).toBe(30);
    } catch {
      // nothing
    }
  });

  it('fails in the handler', async () => {
    try {
      await loadCart('missing');
      fail('loadCart should have thrown');
    } catch (error) {
      if (!(error instanceof Error)) fail('not an Error');
      expect(error.message).toMatch(/not found/);
    }
  });

  it('passes the error to done', (done) => {
    api.onSaved((cart) => {
      try {
        expect(cart.total()).toBe(29.99);
        done();
      } catch (error) {
        done(error);
      }
    });
  });

  it('rejects in the handler', () => new Promise<void>((resolve, reject) => {
    api.onSaved((cart) => {
      try {
        expect(cart.items).toHaveLength(1);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }));
});

describe('helpers', () => {
  it('uses helpers from this file', () => {
    const cart = new Cart([backpack]);
    expectTotal(cart, 29.99);
    cart.clear();
    expectEmpty(cart);
  });

  it('uses a helper the tool cannot see, until its name is in assertionHelpers', () => {
    verifyCart(new Cart([backpack]));
  });
});
