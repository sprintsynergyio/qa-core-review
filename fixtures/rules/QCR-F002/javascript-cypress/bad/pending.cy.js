describe('Wishlist', () => {
  it('saves a product for later'); // expect: QCR-F002

  xdescribe('sharing', () => { // expect: QCR-F002
    it('copies the link', () => {
      cy.visit('https://www.saucedemo.com/wishlist.html');
      cy.get('[data-test="share"]').should('be.visible');
    });
  });
});
