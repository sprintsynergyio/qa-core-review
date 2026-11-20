package billing

import org.scalatest.funsuite.AnyFunSuite

class InvoiceSpec extends AnyFunSuite:
  test("total adds the lines") {
    assert(Invoice(List(BigDecimal(10), BigDecimal(5))).total == BigDecimal(15))
  }
