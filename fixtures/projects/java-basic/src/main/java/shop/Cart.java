package shop;

import java.util.ArrayList;
import java.util.List;

public class Cart {
    private final List<Double> prices = new ArrayList<>();

    public void add(double price) {
        prices.add(price);
    }

    public double total() {
        return prices.stream().mapToDouble(Double::doubleValue).sum();
    }

    public int size() {
        return prices.size();
    }
}
