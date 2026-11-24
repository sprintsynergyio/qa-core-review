import { Cart } from '../src/cart';

// The callback calls done, so it has to run for the test to end.
it('saves the cart', (done) => {
  new Cart().save((error) => {
    expect(error).toBeNull();
    done();
  });
});
