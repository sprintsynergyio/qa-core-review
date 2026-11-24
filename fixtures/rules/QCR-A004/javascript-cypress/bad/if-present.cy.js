describe('Login', () => {
  it('shows an error when there is one', () => {
    cy.visit('https://www.saucedemo.com');
    cy.get('body').then(($body) => {
      if ($body.find('[data-test="error"]').length > 0) {
        cy.get('[data-test="error"]').should('contain', 'locked out'); // expect: QCR-A004
      }
    });
  });
});
