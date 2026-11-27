using Test

@testset "cart" begin
    cart = add_item(Cart(), "backpack", 1)
    @test length(cart.items) == 1
end
