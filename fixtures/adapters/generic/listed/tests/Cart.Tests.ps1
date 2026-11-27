Describe "Cart" {
    It "adds an item" {
        $cart = New-Cart
        Add-CartItem -Cart $cart -Name "backpack" -Quantity 1
        $cart.Items.Count | Should -Be 1
    }
}
