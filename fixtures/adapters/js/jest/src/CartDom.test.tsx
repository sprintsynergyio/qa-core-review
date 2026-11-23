import '@testing-library/jest-dom';
import { act, render, screen, waitFor } from '@testing-library/react';
import { CartView } from './CartView';

describe('CartView in the page', () => {
  it('shows the items', () => {
    render(<CartView items={[{ name: 'Backpack', price: 29.99 }]} />);
    const total = screen.getByTestId('total');
    expect(screen.getByText('Backpack')).toBeInTheDocument();
    expect(total).toHaveTextContent('$29.99');
    expect(total).toBeVisible();
    expect(total).toHaveStyle({ fontWeight: 'bold' });
    expect(screen.getByRole('button', { name: 'Checkout' })).toBeEnabled();
    // getByText throws when the text is missing, so this is a real check in Testing Library.
    expect(screen.getByText('1 item')).toBeTruthy();
  });

  it('checks the coupon form', async () => {
    render(<CartView items={[]} />);
    const input = screen.getByLabelText('Coupon');
    expect(input).toHaveFocus();
    expect(input).toBeRequired();
    expect(input).toBeInvalid();
    act(() => {
      input.focus();
      expect(input).toHaveDisplayValue('');
    });
    await waitFor(() => expect(input).toBeValid());
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Coupon applied');
    });
  });

  it('matches the stored picture', () => {
    const { container } = render(<CartView items={[]} />);
    expect(container).toMatchImageSnapshot();
  });
});
