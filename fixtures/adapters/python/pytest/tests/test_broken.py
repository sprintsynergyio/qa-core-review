"""A file with a syntax error in the middle. The tests around it are still found."""
import pytest


def test_before():
    assert 1 + 1 == 2


def test_broken():
    assert total( == 3


def test_after():
    assert "a".upper() == "A"
