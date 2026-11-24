// A custom command that asserts. A spec that calls cy.expectTitle() has an assertion.
Cypress.Commands.add('expectTitle', (title) => {
  cy.get('[data-test="title"]').should('have.text', title);
});
