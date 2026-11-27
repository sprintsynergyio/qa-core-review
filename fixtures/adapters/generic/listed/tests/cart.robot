*** Settings ***
Library    SeleniumLibrary

*** Test Cases ***
Adds An Item
    Open Browser    https://www.saucedemo.com    chrome
    Click Button    add-to-cart-sauce-labs-backpack
    Element Text Should Be    css=.shopping_cart_badge    1
