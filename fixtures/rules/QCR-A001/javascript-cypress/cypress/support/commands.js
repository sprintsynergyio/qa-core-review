// Custom commands. One that contains an assertion counts as an assertion where it is called.
Cypress.Commands.add('expectCartCount', (count) => {
  cy.get('[data-test="shopping-cart-badge"]').should('have.text', String(count));
});

Cypress.Commands.add('login', (user) => {
  cy.visit('https://www.saucedemo.com');
  cy.get('[data-test="username"]').type(user);
  cy.get('[data-test="login-button"]').click();
});
