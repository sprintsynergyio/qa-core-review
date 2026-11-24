import { Cart } from '../src/cart';

it.todo('exports to CSV'); // expect: QCR-F002

test.todo('imports from CSV'); // expect: QCR-F002

it('starts empty', () => {
  expect(new Cart().items).toHaveLength(0);
});
