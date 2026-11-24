import { addItem, createCart } from '../src/cart';
import { openDb } from '../src/db';

test('adds context to a failure', () => {
  const cart = createCart();
  try {
    expect(addItem(cart, 'backpack', 1)).toBe(true);
  } catch (error) {
    throw new Error(`cart ${cart.id}`, { cause: error });
  }
});

test('closes the database whatever happens', async () => {
  const db = await openDb();
  try {
    expect(await db.count('orders')).toBe(0);
  } finally {
    await db.close();
  }
});
