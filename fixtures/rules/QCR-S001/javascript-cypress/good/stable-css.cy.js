describe('Login', () => {
  it('logs in', () => {
    cy.visit('https://www.saucedemo.com');
    cy.get('#user-name').type('standard_user');
    cy.get('#password').type('secret_sauce');
    cy.get('form .submit-button').click();
    cy.get('.inventory_list .inventory_item').should('have.length', 6);
  });
});
