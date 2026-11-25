import { applyDiscount } from '../src/discount';

describe('applyDiscount', () => { // expect: QCR-N001
  it('applies 10% off', () => {
    expect(applyDiscount(100, 'SAVE10')).toBe(90);
  });

  it('applies 20% off', () => {
    expect(applyDiscount(100, 'SAVE20')).toBe(80);
  });
});
