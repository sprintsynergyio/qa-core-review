/// <reference types="cypress" />

describe('Login', () => {
  before(() => {
    cy.log(`Running on ${Cypress.browser.name}`);
  });

  beforeEach(() => {
    cy.visit('https://www.saucedemo.com');
  });

  after(() => {
    cy.clearCookies();
  });

  context('with valid details', () => {
    it('logs in the standard user', () => {
      cy.get('[data-test="username"]').type('standard_user');
      cy.get('[data-test="password"]').type('secret_sauce');
      cy.get('[data-test="login-button"]').click();
      cy.url().should('include', '/inventory.html');
    });

    it('shows the product list', { retries: 2 }, () => {
      cy.get('.inventory_item').should('have.length', 6).and('be.visible');
    });

    specify('the cart starts empty', () => {
      cy.get('.shopping_cart_badge').should('not.exist');
    });
  });

  context('with a locked account', () => {
    it.only('shows an error', () => {
      cy.get('#user-name').type('locked_out_user');
      cy.get('#password').type('secret_sauce');
      cy.get('#login-button').click();
      cy.wait(1000);
      cy.contains('Sorry, this user has been locked out.');
    });

    it.skip('keeps the user on the login page', () => {
      cy.get('#login-button').click();
    });
  });
});
