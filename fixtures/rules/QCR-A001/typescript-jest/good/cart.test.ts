import request from 'supertest';
import { app } from '../src/app';
import { Cart } from '../src/cart';

describe('Cart', () => {
  it('adds an item', () => {
    const cart = new Cart();
    cart.add({ name: 'Backpack', price: 29.99 });
    expect(cart.items).toHaveLength(1);
  });

  // Expecting an error is a check.
  it('rejects a negative price', () => {
    const cart = new Cart();
    expect(() => cart.add({ name: 'Free', price: -1 })).toThrow('price');
  });
});

// supertest checks the response inside the chain.
it('lists the orders', async () => {
  await request(app)
    .get('/orders')
    .expect(200)
    .expect('Content-Type', /json/);
});
