import { render, screen } from '@testing-library/react';
import { CartView } from './CartView';

describe('CartView', () => {
  it('shows the number of items', () => {
    render(<CartView items={[{ name: 'Backpack', price: 29.99 }]} />);
    expect(screen.getByText('1 item')).toBeDefined();
  });

  it('shows an empty message', () => {
    const { container } = render(<CartView items={[]} />);
    expect(container).toMatchSnapshot();
  });
});
