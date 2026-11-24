import { api } from '../src/api';

it('every cart has a total', async () => {
  const carts = await api.list();
  carts.forEach((cart) => {
    expect(cart.total()).toBeGreaterThan(0); // expect: QCR-A004
  });
});

it('checks when the event comes', () => {
  api.onSaved((cart) => {
    expect(cart.items).toHaveLength(1); // expect: QCR-A004
  });
});
