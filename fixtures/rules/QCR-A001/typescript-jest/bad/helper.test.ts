import { Cart } from '../src/cart';

// The tool cannot see into `verifyCart`: it is not in this project. Its name can be added to "assertionHelpers" in the config.
test('uses a helper from a package', () => { // expect: QCR-A001
  verifyCart(new Cart());
});

function build() {
  return new Cart([{ name: 'Backpack', price: 29.99 }]);
}

// `build` has no assertion in it.
test('uses a helper that checks nothing', () => { // expect: QCR-A001
  build();
});
