"""Order tests: async test cases, names imported from unittest, and a framework base class."""
from unittest import IsolatedAsyncioTestCase, TestCase, expectedFailure, skip
import unittest

from rest_framework.test import APITestCase

from shop.orders import OrderClient

API = "https://api.example.test"


class OrderClientTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.client = OrderClient(API)
        await self.client.open()

    async def asyncTearDown(self):
        await self.client.close()

    async def test_order_is_created(self):
        order = await self.client.create(sku="backpack")
        self.assertEqual(order["status"], "created")

    async def test_unknown_sku_is_rejected(self):
        with self.assertRaises(LookupError):
            await self.client.create(sku="nope")


class OrderHistory(IsolatedAsyncioTestCase):
    async def test_history_starts_empty(self):
        self.assertEqual(await OrderClient(API).history(), [])


class OrderNumbers(TestCase):
    @skip("the number format changes in the next release")
    def test_format(self):
        self.assertRegex(OrderClient.number(7), r"^A-\d+$")

    @expectedFailure
    def test_numbers_are_unique(self):
        self.assertNotEqual(OrderClient.number(7), OrderClient.number(7))


class OrderApiTests(APITestCase):
    """APITestCase is not unittest's own class, but its name says what it is."""

    def test_list_needs_a_login(self):
        response = self.client.get("/api/orders/")
        self.assertEqual(response.status_code, 401)


class OrderFixtures:
    """Not a test class."""

    def test_data(self):
        return [{"sku": "backpack"}]
