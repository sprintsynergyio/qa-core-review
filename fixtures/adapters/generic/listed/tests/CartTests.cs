using NUnit.Framework;

namespace Shop.Tests
{
    public class CartTests
    {
        [Test]
        public void AddsAnItem()
        {
            var cart = new Cart();
            cart.Add("backpack", 1);
            Assert.That(cart.Count, Is.EqualTo(1));
        }
    }
}
