Feature: Cart

  Scenario: Adds an item
    Given an empty cart
    When the shopper adds a backpack
    Then the cart has 1 item
