import { Cart } from '../src/cart';

// Tests that are not run are for the skipped-test rule, not for this one.
it.skip('merges two carts', () => {
  new Cart().merge(new Cart());
});

it.todo('exports to CSV');

describe.skip('old checkout', () => {
  it('pays', () => {
    new Cart().pay();
  });
});

it('saves the cart', (done) => {
  new Cart().save((error) => {
    expect(error).toBeNull();
    done();
  });
});
