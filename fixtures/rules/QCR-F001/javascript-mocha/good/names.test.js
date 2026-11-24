const { expect } = require('chai');
const { filters } = require('../src/filters');

describe('filters', () => {
  it('keeps only in-stock items', () => {
    expect(filters.only('in-stock')).to.have.length(4);
  });
});
