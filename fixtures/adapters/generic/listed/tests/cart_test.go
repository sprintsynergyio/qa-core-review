package shop

import "testing"

func TestAddsAnItem(t *testing.T) {
	cart := NewCart()
	cart.Add("backpack", 1)
	if cart.Len() != 1 {
		t.Fatalf("got %d items", cart.Len())
	}
}
