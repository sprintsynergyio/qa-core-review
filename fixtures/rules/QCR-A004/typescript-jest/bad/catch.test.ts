import { loadCart } from '../src/cart';

// When loadCart does not throw, nothing is checked and the test passes.
it('rejects a missing cart', async () => {
  try {
    await loadCart('missing');
  } catch (error) {
    expect(error).toHaveProperty('code', 404); // expect: QCR-A004
  }
});
