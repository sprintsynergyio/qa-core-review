import { renderCart } from '../src/render';

it('renders the cart', () => {
  const html = renderCart([{ name: 'Backpack', price: 29.99 }]);
  expect(html).toMatchSnapshot(); // expect: QCR-P001
});

it('renders an empty cart', () => {
  expect(renderCart([])).toMatchSnapshot('empty'); // expect: QCR-P001
  expect(renderCart([], { compact: true })).toMatchSnapshot('empty, compact');
});
