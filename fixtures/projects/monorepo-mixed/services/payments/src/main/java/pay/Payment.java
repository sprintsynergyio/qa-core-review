package pay;

public record Payment(String id, long amountInCents) {
    public boolean isRefundable() {
        return amountInCents > 0;
    }
}
