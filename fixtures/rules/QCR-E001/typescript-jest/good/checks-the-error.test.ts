import { createOrder, ValidationError } from '../src/orders';

test('rejects an order with no items', async () => {
  expect.assertions(2);
  try {
    await createOrder({ items: [] });
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).field).toBe('items');
  }
});

// The rejection is turned into a value, and the value is checked.
test('rejects an order with no address', async () => {
  const error = await createOrder({ items: ['backpack'] }).catch((reason) => reason);
  expect(error).toBeInstanceOf(ValidationError);
});

test('says why it failed', async () => {
  await expect(createOrder({ items: [] })).rejects.toThrow('items');
});
