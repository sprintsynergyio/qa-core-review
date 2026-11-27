from snapshottest import TestCase

from shop.invoice import render_invoice


class InvoiceTests(TestCase):
    def test_renders_the_invoice(self):
        self.assertMatchSnapshot(render_invoice(7))  # expect: QCR-P001
