describe('avatarUpload', () => {
  it('takes a WebP', () => {
    cy.visit('https://www.saucedemo.com/profile.html');
    cy.get('[data-test="avatar"]').selectFile('cypress/fixtures/sam.webp');
    cy.get('[data-test="avatar-preview"]').should('be.visible');
  });

  it('refuses a file over the size limit', () => {
    cy.visit('https://www.saucedemo.com/profile.html');
    cy.get('[data-test="avatar"]').selectFile('cypress/fixtures/huge.png');
    cy.get('[data-test="avatar-message"]').should('contain.text', 'too large');
  });
});
