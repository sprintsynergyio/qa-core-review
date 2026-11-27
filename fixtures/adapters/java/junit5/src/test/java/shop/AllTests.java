package shop;

import org.junit.platform.suite.api.SelectClasses;
import org.junit.platform.suite.api.Suite;

// A suite class has no test of its own. The platform packages belong to every version of JUnit.
@Suite
@SelectClasses({CartTest.class, OrderServiceTest.class})
class AllTests {
}
