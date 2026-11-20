package billing

final case class Invoice(lines: List[BigDecimal]):
  def total: BigDecimal = lines.sum
