const { total } = require('./cart');

test('adds the prices', () => {
  expect(total([10, 5])).toBe(15);
});
