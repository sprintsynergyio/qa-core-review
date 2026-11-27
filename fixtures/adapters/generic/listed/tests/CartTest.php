<?php
use PHPUnit\Framework\TestCase;

final class CartTest extends TestCase
{
    public function testAddsAnItem(): void
    {
        $cart = new Cart();
        $cart->add('backpack', 1);
        $this->assertSame(1, $cart->count());
    }
}
