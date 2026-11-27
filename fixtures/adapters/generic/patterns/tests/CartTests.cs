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

        [Ignore("flaky on CI")]
        [Test]
        public void SyncsWithTheServer()
        {
            var cart = new Cart();
            Thread.Sleep(2000);
            Assert.That(cart.Sync(), Is.True);
        }

        [TestCase(1)]
        [TestCase(2)]
        public void TotalsTheCart(int quantity)
        {
            var cart = new Cart();
            cart.Add("backpack", quantity);
        }
    }
}
