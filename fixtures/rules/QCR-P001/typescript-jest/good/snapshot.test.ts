import { renderCart } from '../src/render';

// The assertions say what must be true. The snapshot catches the rest.
it('renders the cart', () => {
  const html = renderCart([{ name: 'Backpack', price: 29.99 }]);
  expect(html).toContain('Backpack');
  expect(html).toContain('$29.99');
  expect(html).toMatchSnapshot();
});
