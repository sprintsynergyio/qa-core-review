object Helpers {
  def cartWith(name: String): Cart = {
    val cart = new Cart()
    cart.add(name, 1)
    cart
  }
}
