import { Cart } from '../src/cart';

// These tests have no assertion. They are reported once, as skipped, and not as tests with no assertion.
describe.skip('old checkout', () => { // expect: QCR-F002
  it('pays', () => {
    new Cart().pay();
  });
});

xdescribe('old wishlist', () => { // expect: QCR-F002
  it('saves', () => {
    new Cart().save();
  });
});

it.skip('merges two carts', () => { // expect: QCR-F002
  new Cart().merge(new Cart());
});

// An expected failure is reported as info.
it.failing('rounds half a cent up', () => { // expect: QCR-F002
  expect(new Cart().add('gum', 3).total).toBe(1.5);
});
