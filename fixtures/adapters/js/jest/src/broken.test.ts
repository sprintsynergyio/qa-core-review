import { expect, test } from '@jest/globals';
// This file is left half merged on purpose. It cannot be parsed, so the lexical scanner reads it.
<<<<<<< HEAD
describe('Checkout', () => {
  test('adds the tax', () => {
    const total = addTax(100
    expect(total).toBe(119);
=======
describe('Checkout with tax', () => {
  test.only('adds the tax', async () => {
    await sleep(500);
    await page.waitForTimeout(
    expect(total).toBe(119;
>>>>>>> feature/tax
  // qa-core-review-disable-next-line QCR-A001 -- written tomorrow
  it('has no check', () => {
    addTax(1
  test.skip('rounds the total', () => {
    const text = "expect(1).toBe(1) in a string is not a check";
    cy.wait(250); // expect(2) in a comment is not a check either
  xit('is switched off', () => {
    assert.equal(round(1.005), 1.01
}}}}}
