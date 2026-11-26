from snapshottest import TestCase

from shop.invoice import render_invoice


class InvoiceTests(TestCase):
    def test_renders_the_invoice(self):
        invoice = render_invoice(7)
        self.assertIn("Total $32.39", invoice)
        self.assertMatchSnapshot(invoice)
