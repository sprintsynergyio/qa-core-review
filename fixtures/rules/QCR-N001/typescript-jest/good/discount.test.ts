import { applyDiscount } from '../src/discount';

describe('applyDiscount', () => {
  it('applies 10% off', () => {
    expect(applyDiscount(100, 'SAVE10')).toBe(90);
  });

  it('rejects an unknown code', () => {
    expect(() => applyDiscount(100, 'NOPE')).toThrow('Invalid code');
  });
});
