import 'package:test/test.dart';

void main() {
  test('adds an item', () {
    final cart = Cart()..add('backpack', 1);
    expect(cart.length, equals(1));
  });
}
