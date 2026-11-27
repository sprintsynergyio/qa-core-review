// The Java vocabulary (SPEC.md Section 9.3), as data. Every name the adapter knows about
// JUnit 4, JUnit 5 and TestNG is in a table here, not in the code that reads the syntax tree.
// Names are fully qualified: `@Test` after `import org.junit.jupiter.api.Test;` is looked up
// as `org.junit.jupiter.api.Test`.
//
// Two parts so far: the structure of a test file, and what a body checks. What a body does
// (waits, selectors, mocks, resources) is added by the next part of the adapter.
import type { AssertionKind, ComparisonOperator, FrameworkId, NDataOp, NHook, NResource, NStep, NTest, SelectorStrategy } from '../../model/types.js';

type Source = NonNullable<NTest['parameterized']>['source'];

const JUNIT5 = 'org.junit.jupiter.api';
const JUNIT5_PARAMS = 'org.junit.jupiter.params';
const JUNIT5_CONDITION = `${JUNIT5}.condition`;
const JUNIT4 = 'org.junit';
const TESTNG = 'org.testng.annotations';

/** A package, and the framework that a name from it (or from a package below it) proves. The longest package wins. */
export const FRAMEWORK_PACKAGES: Readonly<Record<string, FrameworkId>> = {
  'org.junit.jupiter': 'junit5',
  'org.junit': 'junit4',
  'org.testng': 'testng',
  'org.openqa.selenium': 'selenium',
  'io.restassured': 'restassured',
  'com.microsoft.playwright': 'playwright-java',
  'io.cucumber': 'cucumber',
};
/** Packages of JUnit that belong to every version of it, so they prove no runner. */
export const SHARED_JUNIT_PACKAGES: readonly string[] = ['org.junit.platform'];
/** The frameworks that run tests. The others are libraries used inside them. */
export const RUNNERS: readonly FrameworkId[] = ['junit5', 'junit4', 'testng'];

/** Test libraries that are no framework of their own: an import from one is still a test import. */
export const TEST_LIBRARY_PACKAGES: readonly string[] = ['org.assertj', 'org.hamcrest', 'org.mockito', 'org.awaitility', 'com.github.tomakehurst.wiremock', 'org.opentest4j'];

/**
 * Annotations that make a method a test. `generated` is set when one method gives many tests
 * and the annotation alone says so: a factory or a template makes its tests when it runs.
 */
export const TEST_ANNOTATIONS: Readonly<Record<string, { runner: FrameworkId; generated?: Source }>> = {
  [`${JUNIT5}.Test`]: { runner: 'junit5' },
  [`${JUNIT5_PARAMS}.ParameterizedTest`]: { runner: 'junit5', generated: 'ParameterizedTest' },
  [`${JUNIT5}.RepeatedTest`]: { runner: 'junit5' },
  [`${JUNIT5}.TestFactory`]: { runner: 'junit5', generated: 'loop' },
  [`${JUNIT5}.TestTemplate`]: { runner: 'junit5', generated: 'loop' },
  [`${JUNIT4}.Test`]: { runner: 'junit4' },
  [`${TESTNG}.Test`]: { runner: 'testng' },
};
/** On a class, this one makes every public method of the class a test. */
export const CLASS_TEST_ANNOTATION = `${TESTNG}.Test`;

/** Setup and teardown annotations. `global` ones run once for many classes. */
export const HOOK_ANNOTATIONS: Readonly<Record<string, { kind: NHook['kind']; global?: true }>> = {
  [`${JUNIT5}.BeforeEach`]: { kind: 'beforeEach' },
  [`${JUNIT5}.AfterEach`]: { kind: 'afterEach' },
  [`${JUNIT5}.BeforeAll`]: { kind: 'beforeAll' },
  [`${JUNIT5}.AfterAll`]: { kind: 'afterAll' },
  [`${JUNIT4}.Before`]: { kind: 'beforeEach' },
  [`${JUNIT4}.After`]: { kind: 'afterEach' },
  [`${JUNIT4}.BeforeClass`]: { kind: 'beforeAll' },
  [`${JUNIT4}.AfterClass`]: { kind: 'afterAll' },
  [`${TESTNG}.BeforeMethod`]: { kind: 'beforeEach' },
  [`${TESTNG}.AfterMethod`]: { kind: 'afterEach' },
  [`${TESTNG}.BeforeClass`]: { kind: 'beforeAll' },
  [`${TESTNG}.AfterClass`]: { kind: 'afterAll' },
  [`${TESTNG}.BeforeTest`]: { kind: 'beforeAll', global: true },
  [`${TESTNG}.AfterTest`]: { kind: 'afterAll', global: true },
  [`${TESTNG}.BeforeSuite`]: { kind: 'beforeAll', global: true },
  [`${TESTNG}.AfterSuite`]: { kind: 'afterAll', global: true },
};

/** An inner class with this annotation is a nested suite, also when it has no test of its own yet. */
export const NESTED_ANNOTATION = `${JUNIT5}.Nested`;
/** The title of a test or a suite, in place of the method or class name. */
export const DISPLAY_NAME_ANNOTATION = `${JUNIT5}.DisplayName`;

/** Annotations that switch a test or a class off, always. The reason is the element named here. */
export const SKIP_ANNOTATIONS: Readonly<Record<string, string>> = {
  [`${JUNIT5}.Disabled`]: 'value',
  [`${JUNIT4}.Ignore`]: 'value',
  [`${TESTNG}.Ignore`]: 'value',
};
/** `@Test(enabled = false)`: the element that switches a TestNG test off, and the one that says why. */
export const ENABLED_ELEMENT = 'enabled';
export const DESCRIPTION_ELEMENT = 'description';

/** Annotations that switch a test off on a condition. All of them are in one package and say why in `disabledReason`. */
export const CONDITION_PACKAGE = JUNIT5_CONDITION;
export const CONDITION_ANNOTATIONS: readonly string[] = [
  'DisabledOnOs', 'EnabledOnOs', 'DisabledOnJre', 'EnabledOnJre', 'DisabledForJreRange', 'EnabledForJreRange', 'DisabledIf', 'EnabledIf',
  'DisabledIfSystemProperty', 'EnabledIfSystemProperty', 'DisabledIfEnvironmentVariable', 'EnabledIfEnvironmentVariable', 'DisabledInNativeImage', 'EnabledInNativeImage',
];
export const CONDITION_REASON_ELEMENT = 'disabledReason';

/** Calls inside a body that end the test without a failure. `conditional` ones do so only when their condition does not hold. */
export const SKIP_CALLS: Readonly<Record<string, { conditional: boolean }>> = {
  [`${JUNIT5}.Assumptions.assumeTrue`]: { conditional: true },
  [`${JUNIT5}.Assumptions.assumeFalse`]: { conditional: true },
  [`${JUNIT5}.Assumptions.abort`]: { conditional: false },
  [`${JUNIT4}.Assume.assumeTrue`]: { conditional: true },
  [`${JUNIT4}.Assume.assumeFalse`]: { conditional: true },
  [`${JUNIT4}.Assume.assumeNotNull`]: { conditional: true },
  [`${JUNIT4}.Assume.assumeThat`]: { conditional: true },
  [`${JUNIT4}.Assume.assumeNoException`]: { conditional: true },
};
/** Exceptions that skip the test when thrown. */
export const THROWN_SKIPS: readonly string[] = ['org.testng.SkipException', 'org.opentest4j.TestAbortedException', 'org.junit.AssumptionViolatedException'];

/**
 * Where a parameterized JUnit 5 test gets its cases, and how many: `values` when the cases are
 * the elements written in the annotation, a number when the annotation always gives that many,
 * null when the cases are somewhere else (a method, a file, an enum).
 */
export const ARGUMENT_SOURCES: Readonly<Record<string, 'values' | number | null>> = {
  [`${JUNIT5_PARAMS}.provider.ValueSource`]: 'values',
  [`${JUNIT5_PARAMS}.provider.CsvSource`]: 'values',
  [`${JUNIT5_PARAMS}.provider.NullSource`]: 1,
  [`${JUNIT5_PARAMS}.provider.EmptySource`]: 1,
  [`${JUNIT5_PARAMS}.provider.NullAndEmptySource`]: 2,
  [`${JUNIT5_PARAMS}.provider.MethodSource`]: null,
  [`${JUNIT5_PARAMS}.provider.EnumSource`]: null,
  [`${JUNIT5_PARAMS}.provider.CsvFileSource`]: null,
  [`${JUNIT5_PARAMS}.provider.ArgumentsSource`]: null,
  [`${JUNIT5_PARAMS}.provider.FieldSource`]: null,
};
/** An element of a source annotation that holds the cases in a form that is not counted (a text block). */
export const UNCOUNTED_SOURCE_ELEMENTS: readonly string[] = ['textBlock'];
/** Elements of a source annotation that are settings, not cases. */
export const SOURCE_SETTING_ELEMENTS: readonly string[] = ['delimiter', 'delimiterString', 'nullValues', 'emptyValue', 'quoteCharacter', 'useHeadersInDisplayName', 'ignoreLeadingAndTrailingWhitespace', 'maxCharsPerColumn'];

/** TestNG: `@Test(dataProvider = "rows")` takes its cases from the method with `@DataProvider(name = "rows")`, or the method named `rows`. */
export const DATA_PROVIDER_ELEMENT = 'dataProvider';
export const DATA_PROVIDER_ANNOTATION = `${TESTNG}.DataProvider`;
export const DATA_PROVIDER_NAME_ELEMENT = 'name';

/** JUnit 4: `@RunWith(Parameterized.class)` on a class runs each of its tests once for every row of its `@Parameters` method. */
export const RUN_WITH_ANNOTATION = `${JUNIT4}.runner.RunWith`;
export const PARAMETERIZED_RUNNERS: readonly string[] = ['Parameterized'];
export const PARAMETERS_ANNOTATION = `${JUNIT4}.runners.Parameterized.Parameters`;
/** Calls that only wrap the rows of a data method: `Arrays.asList(new Object[][] { ... })`. */
export const ROW_WRAPPERS: readonly string[] = ['Arrays.asList', 'List.of', 'Stream.of'];

/**
 * A class with one of these endings in its name is meant to hold tests. When it has none, and
 * has methods that look like tests with no annotation, the file is still a test file, so that
 * the review can say that no test was found in it.
 */
export const TEST_CLASS_SUFFIXES: readonly string[] = ['Test', 'Tests', 'IT'];
/** `TestCart` tests `Cart` too. */
export const TEST_CLASS_PREFIX = 'Test';
/** JUnit 3 finds tests by the name of the method. Such a class is left alone. */
export const JUNIT3_BASES: readonly string[] = ['TestCase', 'junit.framework.TestCase'];

// ---------------------------------------------------------------------------------------
// What a body checks.
// ---------------------------------------------------------------------------------------

/** How a method name is read as a check. `swap`: the expected value comes first. `operator`: what the value must be next to the expected one. */
export interface Check { kind: AssertionKind; negated?: true; swap?: true; operator?: ComparisonOperator }
const check = (kind: AssertionKind, more: Omit<Check, 'kind'> = {}): Check => ({ kind, ...more });
const NOT = { negated: true } as const;

/**
 * The assertion classes of JUnit and TestNG. Their methods have the same names and differ in
 * the order of the arguments: JUnit takes the expected value first and TestNG the actual one,
 * and JUnit 4 takes a message as the first argument where the others take it as the last.
 */
export const ASSERT_CLASSES: Readonly<Record<string, { library: string; expectedFirst: boolean; messageFirst: boolean; runner: FrameworkId }>> = {
  'org.junit.jupiter.api.Assertions': { library: 'junit', expectedFirst: true, messageFirst: false, runner: 'junit5' },
  'org.junit.Assert': { library: 'junit', expectedFirst: true, messageFirst: true, runner: 'junit4' },
  'org.testng.Assert': { library: 'testng', expectedFirst: false, messageFirst: false, runner: 'testng' },
  'org.testng.AssertJUnit': { library: 'testng', expectedFirst: true, messageFirst: true, runner: 'testng' },
};
/** The methods of those classes. `operands` is the number of values a check takes before a delta or a message. */
export const ASSERT_METHODS: Readonly<Record<string, Check & { operands: 1 | 2 }>> = {
  assertEquals: { kind: 'equality', operands: 2 },
  assertNotEquals: { kind: 'equality', operands: 2, ...NOT },
  assertSame: { kind: 'equality', operands: 2 },
  assertNotSame: { kind: 'equality', operands: 2, ...NOT },
  assertArrayEquals: { kind: 'equality', operands: 2 },
  assertIterableEquals: { kind: 'equality', operands: 2 },
  assertLinesMatch: { kind: 'equality', operands: 2 },
  assertEqualsNoOrder: { kind: 'equality', operands: 2 },
  assertEqualsDeep: { kind: 'equality', operands: 2 },
  assertTrue: { kind: 'truthiness', operands: 1 },
  assertFalse: { kind: 'truthiness', operands: 1, ...NOT },
  assertNull: { kind: 'nullness', operands: 1 },
  assertNotNull: { kind: 'nullness', operands: 1, ...NOT },
  assertInstanceOf: { kind: 'type', operands: 2 },
  assertThrows: { kind: 'throws', operands: 2 },
  assertThrowsExactly: { kind: 'throws', operands: 2 },
  expectThrows: { kind: 'throws', operands: 2 },
  assertDoesNotThrow: { kind: 'throws', operands: 1, ...NOT },
  assertTimeout: { kind: 'other', operands: 2 },
  assertTimeoutPreemptively: { kind: 'other', operands: 2 },
};
/** `assertAll(() -> ..., () -> ...)` and `assertSoftly(softly -> ...)` group other assertions and check nothing themselves. */
export const GROUPING_METHODS: readonly string[] = ['assertAll', 'assertSoftly'];
/** Calls that fail the test: `fail("why")` of JUnit, TestNG and AssertJ. */
export const FAIL_METHODS: readonly string[] = ['fail'];
export const FAIL_CLASSES: readonly string[] = [...Object.keys(ASSERT_CLASSES), 'org.assertj.core.api.Assertions'];

/** A method that starts with this is an assertion by its name, when nothing else is known about it: `assertCartIsEmpty(cart)`. */
export const ASSERT_METHOD_PREFIX = 'assert';

/** Lambdas given to these calls always run, so a check inside them is not conditional. */
export const ALWAYS_RUN_CALLBACKS: readonly string[] = [
  'assertAll', 'assertTimeout', 'assertTimeoutPreemptively', 'assertDoesNotThrow', 'assertThrows', 'assertThrowsExactly', 'expectThrows', 'assertSoftly',
  'step', 'assertThatCode', 'assertThatThrownBy', 'catchThrowable',
];
/** `dynamicTest(name, () -> ...)` in a `@TestFactory` method: the lambda is a test of its own, whatever loop or `map` it is made in. */
export const DYNAMIC_TEST_CALL = 'dynamicTest';
/** The same for methods called on an object: `assertThat(cart).satisfies(c -> ...)`, `await().untilAsserted(() -> ...)`. */
export const ALWAYS_RUN_METHODS: readonly string[] = ['satisfies', 'untilAsserted'];
/** A loop over one of these, written out with elements, always runs its body: `for (String user : List.of("a", "b"))`. */
export const LISTING_CALLS: readonly string[] = ['List.of', 'Set.of', 'Arrays.asList'];

/** Where the fluent `assertThat` of a file comes from. Each library reads the chain after it in its own way. */
export const ASSERT_THAT_HOMES: Readonly<Record<string, 'assertj' | 'hamcrest' | 'playwright' | 'truth'>> = {
  'org.assertj.core.api.Assertions': 'assertj',
  'org.assertj.core.api.AssertionsForClassTypes': 'assertj',
  'org.assertj.core.api.BDDAssertions': 'assertj',
  'org.hamcrest.MatcherAssert': 'hamcrest',
  'org.junit.Assert': 'hamcrest',
  'com.microsoft.playwright.assertions.PlaywrightAssertions': 'playwright',
  'com.google.common.truth.Truth': 'truth',
};
/** The calls that start a fluent chain on a value. `then` is the BDD name of AssertJ, and counts only when it is imported from there. */
export const ASSERT_THAT_NAMES: readonly string[] = ['assertThat', 'then'];

/**
 * AssertJ: the calls that start a check on code that should throw, or should not. `needs` is the
 * method without which the chain checks nothing. `negated`: the code must not throw.
 */
export const ASSERTJ_THROW_ROOTS: Readonly<Record<string, { needs?: string; negated?: true }>> = {
  assertThatThrownBy: {},
  assertThatExceptionOfType: { needs: 'isThrownBy' },
  assertThatIllegalArgumentException: { needs: 'isThrownBy' },
  assertThatIllegalStateException: { needs: 'isThrownBy' },
  assertThatNullPointerException: { needs: 'isThrownBy' },
  assertThatIOException: { needs: 'isThrownBy' },
  assertThatNoException: { needs: 'isThrownBy', ...NOT },
  assertThatCode: { needs: 'doesNotThrowAnyException', ...NOT },
};
/** AssertJ methods that are checks, by kind. Any other method on `assertThat(x)` is a check of kind `other`. */
export const ASSERTJ_METHODS: Readonly<Record<string, Check>> = {
  isEqualTo: check('equality'), isNotEqualTo: check('equality', NOT), isSameAs: check('equality'), isNotSameAs: check('equality', NOT), isEqualToIgnoringCase: check('equality'),
  isEqualByComparingTo: check('equality'), hasToString: check('equality'), isCloseTo: check('equality'), isZero: check('equality'), isNotZero: check('equality', NOT),
  isTrue: check('truthiness'), isFalse: check('truthiness', NOT), isPresent: check('truthiness'), isNotPresent: check('truthiness', NOT),
  isNull: check('nullness'), isNotNull: check('nullness', NOT),
  contains: check('contains'), containsExactly: check('contains'), containsExactlyInAnyOrder: check('contains'), containsOnly: check('contains'), containsAnyOf: check('contains'),
  doesNotContain: check('contains', NOT), containsKey: check('contains'), containsEntry: check('contains'), containsValue: check('contains'), containsIgnoringCase: check('contains'),
  startsWith: check('contains'), endsWith: check('contains'), isIn: check('contains'), isNotIn: check('contains', NOT),
  hasSize: check('count'), isEmpty: check('count'), isNotEmpty: check('count', NOT), isNullOrEmpty: check('count'), hasSameSizeAs: check('count'),
  isGreaterThan: check('comparison', { operator: '>' }), isGreaterThanOrEqualTo: check('comparison', { operator: '>=' }),
  isLessThan: check('comparison', { operator: '<' }), isLessThanOrEqualTo: check('comparison', { operator: '<=' }),
  isPositive: check('comparison'), isNegative: check('comparison'), isBetween: check('comparison'),
  isInstanceOf: check('type'), isNotInstanceOf: check('type', NOT), isExactlyInstanceOf: check('type'), hasSameClassAs: check('type'),
  // The matchers of Playwright for Java, which are read on a locator or a page.
  isVisible: check('ui-state'), isHidden: check('ui-state'), isEnabled: check('ui-state'), isDisabled: check('ui-state'), isChecked: check('ui-state'), isEditable: check('ui-state'),
  isFocused: check('ui-state'), isAttached: check('ui-state'), isInViewport: check('ui-state'), hasText: check('ui-state'), containsText: check('ui-state'), hasValue: check('ui-state'),
  hasAttribute: check('ui-state'), hasClass: check('ui-state'), hasCSS: check('ui-state'), hasId: check('ui-state'), hasURL: check('ui-state'), hasTitle: check('ui-state'),
  hasCount: check('count'),
};
/** Methods on `assertThat(x)` that describe the check or set it up, and check nothing by themselves. */
export const ASSERTJ_NON_CHECKS: readonly string[] = [
  'as', 'describedAs', 'withFailMessage', 'overridingErrorMessage', 'usingRecursiveComparison', 'usingComparator', 'usingDefaultComparator', 'usingElementComparator',
  'ignoringFields', 'withRepresentation', 'inHexadecimal', 'withThreadDumpOnError',
];
/** Methods that move on to another value: after `assertThat(cart).extracting("owner")` the checks are about the owner, not the cart. */
export const ASSERTJ_NAVIGATIONS: readonly string[] = ['extracting', 'flatExtracting', 'asString', 'asList', 'asInstanceOf', 'first', 'last', 'element', 'singleElement', 'filteredOn', 'map', 'size'];
/** `assertThat(locator).not().isVisible()` in Playwright: the next check is turned around. */
export const NEGATING_LINKS: readonly string[] = ['not'];

/** AssertJ and TestNG objects that collect failures and report them later, with the method that reports them. */
export const SOFT_TYPES: readonly string[] = ['SoftAssertions', 'BDDSoftAssertions', 'AutoCloseableSoftAssertions', 'JUnitSoftAssertions', 'JUnitJupiterSoftAssertions', 'SoftAssert'];
export const SOFT_REPORT_METHOD = 'assertAll';

/** Hamcrest matchers that only wrap another matcher or a value. `not` turns the check around. */
export const HAMCREST_WRAPPERS: Readonly<Record<string, { negated?: true }>> = { is: {}, not: NOT, describedAs: {} };
export const HAMCREST_MATCHERS: Readonly<Record<string, Check>> = {
  equalTo: check('equality'), sameInstance: check('equality'), equalToIgnoringCase: check('equality'), closeTo: check('equality'),
  nullValue: check('nullness'), notNullValue: check('nullness', NOT),
  containsString: check('contains'), startsWith: check('contains'), endsWith: check('contains'), hasItem: check('contains'), hasItems: check('contains'), contains: check('contains'),
  containsInAnyOrder: check('contains'), hasKey: check('contains'), hasEntry: check('contains'), hasValue: check('contains'), oneOf: check('contains'),
  hasSize: check('count'), empty: check('count'), emptyIterable: check('count'), emptyString: check('count'), emptyArray: check('count'),
  greaterThan: check('comparison', { operator: '>' }), greaterThanOrEqualTo: check('comparison', { operator: '>=' }),
  lessThan: check('comparison', { operator: '<' }), lessThanOrEqualTo: check('comparison', { operator: '<=' }),
  instanceOf: check('type'), isA: check('type'),
};

/** REST Assured: the checks of a response after `.then()`. A matcher as the last argument decides the kind of a `body` check. */
export const RESTASSURED_PACKAGE = 'io.restassured';
export const RESTASSURED_THEN = 'then';
export const RESTASSURED_CHECKS: Readonly<Record<string, AssertionKind>> = {
  statusCode: 'status', statusLine: 'equality', body: 'other', content: 'other', header: 'equality', headers: 'equality', contentType: 'equality', cookie: 'equality', cookies: 'equality',
  time: 'comparison', spec: 'other',
};
/** Spring: `mockMvc.perform(...).andExpect(status().isOk())` and the `expect...` methods of WebTestClient are checks of a response. */
export const RESPONSE_CHECK_METHODS: readonly string[] = ['andExpect', 'andExpectAll', 'expectStatus', 'expectHeader', 'expectBody', 'expectBodyList', 'expectCookie'];
/** Reactor: `StepVerifier.create(flux).expectNext(1).verifyComplete()`. Nothing is checked until a `verify...` call at the end runs it. */
export const STEP_VERIFIER = 'StepVerifier';
export const STEP_VERIFIER_RUN_PREFIX = 'verify';
/** Calls that read the status of a response: a comparison with one of these is a status check. */
export const STATUS_READERS: readonly string[] = ['statusCode', 'getStatusCode', 'getStatus', 'status', 'code', 'getStatusCodeValue'];

/** Mockito: checks that a mock was called. `verify(mock)` with no method called on it checks nothing. */
export const MOCKITO_PACKAGE = 'org.mockito';
export const MOCKITO_CLASSES: readonly string[] = ['org.mockito.Mockito', 'org.mockito.BDDMockito'];
/** Packages of the Java platform: an import from them is never a file of the project. */
export const PLATFORM_PACKAGES: readonly string[] = ['java', 'javax', 'jakarta'];
export const VERIFY_CALL = 'verify';
export const VERIFY_WHOLE_CALLS: readonly string[] = ['verifyNoInteractions', 'verifyNoMoreInteractions', 'verifyZeroInteractions'];
/** `verify(mock, never())`: the call must not have happened. */
export const NEVER_MODES: readonly string[] = ['never'];
/** BDD style: `then(mock).should().send(...)`, `then(mock).shouldHaveNoInteractions()`. */
export const BDD_THEN_HOME = 'org.mockito.BDDMockito';
export const BDD_SHOULD = 'should';
export const BDD_WHOLE_CALLS: readonly string[] = ['shouldHaveNoInteractions', 'shouldHaveNoMoreInteractions', 'shouldHaveZeroInteractions'];

/** Snapshot checks: ApprovalTests and java-snapshot-testing. */
export const SNAPSHOT_CALLS: readonly string[] = ['Approvals.verify', 'Approvals.verifyAll', 'Approvals.verifyAsJson', 'Approvals.verifyHtml', 'Approvals.verifyXml', 'JsonApprovals.verifyAsJson'];
export const SNAPSHOT_METHODS: readonly string[] = ['toMatchSnapshot'];

/** `@Test(expected = X.class)` in JUnit 4 and `@Test(expectedExceptions = X.class)` in TestNG: the test passes when that is thrown. */
export const EXPECTED_EXCEPTION_ELEMENTS: readonly string[] = ['expected', 'expectedExceptions'];
/** The JUnit 4 rule: `thrown.expect(X.class)` on a field of this type. */
export const EXPECTED_EXCEPTION_TYPE = 'ExpectedException';
export const EXPECTED_EXCEPTION_METHODS: readonly string[] = ['expect', 'expectMessage', 'expectCause'];

/** What a `catch` has to name to catch a failed assertion. `catch (Exception e)` does not: an assertion failure is an `Error` in Java. */
export const ASSERTION_CATCHERS: readonly string[] = ['Throwable', 'Error', 'AssertionError', 'AssertionFailedError', 'MultipleFailuresError', 'ComparisonFailure'];

/** Calls and fields that give an element or a list of elements: Selenium, then Playwright for Java. */
export const LOCATOR_METHODS: readonly string[] = ['findElement', 'findElements', 'locator', 'getByRole', 'getByText', 'getByLabel', 'getByPlaceholder', 'getByTestId', 'getByAltText', 'getByTitle', 'frameLocator'];
export const LOCATOR_REFINERS: readonly string[] = ['first', 'last', 'nth', 'filter'];
/** Types whose values stand for an element and are never null. An `ElementHandle` is not one: `querySelector` gives null when nothing matches. */
export const LOCATOR_TYPES: readonly string[] = ['WebElement', 'Locator', 'SelenideElement'];
/** `@FindBy(id = "x") WebElement button;`: a field that Selenium fills with an element. */
export const LOCATOR_FIELD_ANNOTATIONS: readonly string[] = ['FindBy', 'FindBys', 'FindAll'];
/** Calls and fields that give the number of something. */
export const COUNT_METHODS: readonly string[] = ['size', 'length', 'count'];
export const COUNT_FIELDS: readonly string[] = ['length'];
/** Calls and annotations that make a mock or a spy. */
export const MOCK_FACTORIES: readonly string[] = ['mock', 'spy', 'mockStatic', 'mockConstruction'];
export const MOCK_FIELD_ANNOTATIONS: readonly string[] = ['Mock', 'Spy', 'MockBean', 'SpyBean', 'MockitoBean', 'MockitoSpyBean'];

// What a body does (SPEC.md Sections 8.1 and 9.3): waits.

/** The units of `TimeUnit`, and what one of each is in milliseconds: `TimeUnit.SECONDS.sleep(2)`, `implicitlyWait(10, TimeUnit.SECONDS)`. */
export const TIME_UNITS: Readonly<Record<string, number>> = { NANOSECONDS: 0.000001, MICROSECONDS: 0.001, MILLISECONDS: 1, SECONDS: 1000, MINUTES: 60_000, HOURS: 3_600_000 };
/** `Duration.ofSeconds(2)`: the same for the methods that make a `Duration`. */
export const DURATION_FACTORIES: Readonly<Record<string, number>> = { ofNanos: 0.000001, ofMillis: 1, ofSeconds: 1000, ofMinutes: 60_000, ofHours: 3_600_000 };
/** Calls that sleep, by class and method, with what one unit of a plain number is in milliseconds. */
export const FIXED_SLEEPS: Readonly<Record<string, number>> = { 'Thread.sleep': 1, 'Selenide.sleep': 1, 'Uninterruptibles.sleepUninterruptibly': 1 };
/** `TimeUnit.SECONDS.sleep(2)`: a sleep called on a unit. */
export const UNIT_SLEEP_METHOD = 'sleep';
/** Methods that sleep: Playwright's `page.waitForTimeout(500)` takes milliseconds. */
export const FIXED_WAIT_METHODS: Readonly<Record<string, number>> = { waitForTimeout: 1 };
/** Selenium: `driver.manage().timeouts().implicitlyWait(...)` applies to every lookup. */
export const IMPLICIT_WAIT_METHODS: readonly string[] = ['implicitlyWait'];
/** Any other method that starts like this waits for a condition: `waitForSelector`, `waitForURL`, `locator.waitFor()`. */
export const CONDITION_WAIT_PREFIX = 'waitFor';
/** Selenium: `new WebDriverWait(driver, timeout).until(condition)`. Awaitility: `await().atMost(...).until(...)`. */
export const WAIT_TYPES: readonly string[] = ['WebDriverWait', 'FluentWait', 'Wait'];
export const WAIT_METHODS: readonly string[] = ['until', 'untilAsserted', 'untilTrue', 'untilFalse', 'untilAtomic'];
export const AWAIT_ROOTS: readonly string[] = ['await', 'waitAtMost'];

// Selectors.

/** Selenium: the methods of `By`, with the strategy each one is. Null: the strategy is read from the selector itself. */
export const SELENIUM_BY = 'By';
export const BY_METHODS: Readonly<Record<string, SelectorStrategy | null>> = {
  xpath: 'xpath', cssSelector: null, className: 'class', id: 'id', name: 'name', linkText: 'link-text', partialLinkText: 'link-text', tagName: 'css',
};
/** `@FindBy(xpath = "...")`: the elements of the annotation. `@FindBy(how = How.XPATH, using = "...")` names the strategy as a constant. */
export const FIND_BY_ANNOTATION = 'FindBy';
export const FIND_BY_ELEMENTS: Readonly<Record<string, SelectorStrategy | null>> = {
  xpath: 'xpath', css: null, className: 'class', id: 'id', name: 'name', linkText: 'link-text', partialLinkText: 'link-text', tagName: 'css',
};
export const FIND_BY_HOW_ELEMENT = 'how';
export const FIND_BY_USING_ELEMENT = 'using';
export const FIND_BY_HOW: Readonly<Record<string, SelectorStrategy | null>> = {
  XPATH: 'xpath', CSS: null, CLASS_NAME: 'class', ID: 'id', NAME: 'name', LINK_TEXT: 'link-text', PARTIAL_LINK_TEXT: 'link-text', TAG_NAME: 'css',
};
/** Calls whose first argument is a selector: Playwright on a page or a locator, and the `$` calls of Selenide. */
export const SELECTOR_CALLS: Readonly<Record<string, SelectorStrategy | null>> = {
  locator: null, frameLocator: null, querySelector: null, querySelectorAll: null, waitForSelector: null,
  getByRole: 'role', getByTestId: 'test-id', getByLabel: 'label', getByText: 'text', getByPlaceholder: 'other', getByAltText: 'other', getByTitle: 'other',
};
export const SELENIDE_SELECTORS: Readonly<Record<string, SelectorStrategy | null>> = { $: null, $$: null, $x: 'xpath', $$x: 'xpath' };
/** Selenide checks an element with `shouldHave(...)`, `shouldBe(...)` and `shouldNotBe(...)`: they wait, and fail when the condition never holds. */
export const SELENIDE_CHECK_PREFIX = 'should';
export const SELENIDE_NEGATED_PREFIX = 'shouldNot';
/** Page methods that take a selector first when they are given at least this many arguments: `page.click("#buy")`, `page.fill("#name", "Ada")`. */
export const SELECTOR_ACTIONS: Readonly<Record<string, number>> = { click: 1, dblclick: 1, hover: 1, check: 1, uncheck: 1, fill: 2, type: 2, press: 2, selectOption: 2, isVisible: 1, textContent: 1, innerText: 1 };
/** An object is a page when it has one of these names or is declared with one of these types. On a locator the first argument is a value, not a selector. */
export const PAGE_OBJECTS: readonly string[] = ['page', 'frame', 'popup'];
export const PAGE_TYPES: readonly string[] = ['Page', 'Frame'];
/** Attribute names that mark a test id in a CSS selector. The configured `testIdAttribute` is added to them. */
export const TEST_ID_ATTRIBUTES: readonly string[] = ['data-testid', 'data-test', 'data-qa', 'data-cy'];
/** A pick by position: `.first()`, `.last()`, `.nth(2)`, and `.get(2)` on a list of elements: `findElements(...).get(2)`, `$$(".row").get(2)`. */
export const POSITIONAL: Readonly<Record<string, 'nth' | 'first' | 'last'>> = { first: 'first', last: 'last', nth: 'nth' };
export const LIST_PICK_METHOD = 'get';
export const LIST_FINDERS: readonly string[] = ['findElements', '$$', '$$x'];

// Steps and data.

export const STEP_METHODS: Readonly<Record<string, NStep['kind']>> = {
  navigate: 'navigate', reload: 'navigate', goBack: 'navigate',
  click: 'action', dblclick: 'action', fill: 'action', type: 'action', press: 'action', check: 'action', uncheck: 'action', selectOption: 'action', hover: 'action',
  sendKeys: 'action', clear: 'action', submit: 'action',
};
/** Selenium: `driver.get(url)` and `driver.navigate().to(url)` on something named or declared as a driver. */
export const DRIVER_TYPE = 'WebDriver';
export const DRIVER_NAVIGATION: Readonly<Record<string, string | null>> = { get: null, to: 'navigate' };
/** HTTP verbs, and what each one does to data. */
export const HTTP_METHODS: Readonly<Record<string, NDataOp['op']>> = { get: 'read', head: 'read', post: 'create', put: 'update', patch: 'update', delete: 'delete' };
/** REST Assured: a request is a chain that starts at one of these, or one of the verbs called by itself. */
export const REST_STARTERS: readonly string[] = ['given', 'when', 'with'];
/** An object is an HTTP client when it has one of these names. Spring `RestTemplate` has method names of its own. */
export const HTTP_CLIENT_NAMES: readonly string[] = ['client', 'httpClient', 'http', 'api', 'apiClient', 'restTemplate', 'rest', 'webClient', 'webTestClient'];
export const REST_TEMPLATE_METHODS: Readonly<Record<string, NDataOp['op']>> = { getForObject: 'read', getForEntity: 'read', postForObject: 'create', postForEntity: 'create', postForLocation: 'create' };
/** JDBC and Spring: `jdbc.update("DELETE FROM orders")`. The first word of the SQL says what it does. */
export const SQL_METHODS: readonly string[] = ['update', 'execute', 'executeUpdate', 'executeQuery', 'query', 'queryForObject', 'queryForList', 'createNativeQuery'];
export const SQL_VERBS: Readonly<Record<string, NDataOp['op']>> = { insert: 'create', update: 'update', delete: 'delete', select: 'read' };
/** A store of records: an object whose name ends like this, with what the start of a method name does. `orders.deleteAll()` on `orderRepository`. */
export const REPOSITORY_SUFFIXES: readonly string[] = ['Repository', 'Repo', 'Dao'];
export const REPOSITORY_METHODS: Readonly<Record<string, NDataOp['op']>> = { save: 'create', insert: 'create', persist: 'create', delete: 'delete', remove: 'delete' };

// Mocks.

/** Mocks that keep the real behavior until they are given a reply: `@Spy`, `spy(cart)`. */
export const SPY_NAMES: readonly string[] = ['Spy', 'SpyBean', 'MockitoSpyBean', 'spy'];
/** `mock(Cart.class, CALLS_REAL_METHODS)` keeps the real behavior too. */
export const PASSTHROUGH_ANSWER = 'CALLS_REAL_METHODS';
/** `@InjectMocks Checkout checkout;` is the real object under test, with the mocks of the class put into it. */
export const INJECT_MOCKS_ANNOTATION = 'InjectMocks';
/** `when(mock.call()).thenReturn(x)` and the BDD form `given(mock.call()).willReturn(x)`: the reply follows the call. */
export const STUB_CALLS: readonly string[] = ['when', 'given'];
export const STUB_REPLY_PREFIXES: readonly string[] = ['then', 'will'];
/** `doReturn(x).when(mock).call()` and `willReturn(x).given(mock).call()`: the reply comes first. */
export const STUB_REPLIES_FIRST: readonly string[] = ['doReturn', 'doThrow', 'doAnswer', 'doNothing', 'willReturn', 'willThrow', 'willAnswer', 'willDoNothing'];
/** Replies that run the real method, so nothing is replaced. */
export const REAL_METHOD_REPLIES: readonly string[] = ['thenCallRealMethod', 'willCallRealMethod'];
/** WireMock: `stubFor(get(urlEqualTo("/orders")).willReturn(...))`. `any(anyUrl())` answers every request. */
export const WIREMOCK_STUB = 'stubFor';
export const WIREMOCK_ANY_VERB = 'any';
export const WIREMOCK_ANY_URL = 'anyUrl';
export const WIREMOCK_REPLY = 'willReturn';
/** WireMock: `verify(postRequestedFor(urlEqualTo("/orders")))` checks that a request was made. */
export const WIREMOCK_REQUESTED_SUFFIX = 'RequestedFor';
/** Playwright: `page.route(pattern, route -> route.fulfill(...))`. `route.resume()` lets the call through. */
export const ROUTE_METHOD = 'route';
export const ROUTE_FULFILL = 'fulfill';
export const ROUTE_CONTINUE: readonly string[] = ['resume', 'fallback'];
export const ROUTE_OWNER_TYPES: readonly string[] = ['Page', 'BrowserContext'];
export const MATCH_ALL_PATTERNS: readonly string[] = ['*', '**', '**/*', '.*', '/.*'];

// Resources and how they are released (SPEC.md Section 10.14). A release is a token: a resource is
// released when one of its tokens is released in its own body or in a hook that covers it.

/** `new ChromeDriver()`: classes whose objects must be released. */
export const RESOURCE_TYPES: Readonly<Record<string, NResource['kind']>> = {
  ChromeDriver: 'driver', FirefoxDriver: 'driver', EdgeDriver: 'driver', SafariDriver: 'driver', RemoteWebDriver: 'driver', AndroidDriver: 'driver', IOSDriver: 'driver', AppiumDriver: 'driver',
  WireMockServer: 'server', MockWebServer: 'server',
};
/** Calls that make a resource, by class and method, or `.method` for a method of any object. */
export const RESOURCE_CALLS: Readonly<Record<string, NResource['kind']>> = {
  'Playwright.create': 'browser', '.launch': 'browser', '.launchPersistentContext': 'context', '.newContext': 'context', '.newPage': 'page', 'DriverManager.getConnection': 'connection',
};
/** `WebDriverManager.chromedriver().create()` starts a driver. */
export const DRIVER_MANAGER: Readonly<{ root: string; method: string }> = { root: 'WebDriverManager', method: 'create' };
/** `mockStatic(Prices.class)` replaces the class until it is closed. In a try-with-resources the block closes it. */
export const SCOPED_MOCK_FACTORIES: readonly string[] = ['mockStatic', 'mockConstruction'];
/** Calling one of these on the variable that holds a resource releases it. */
export const RELEASE_METHODS: readonly string[] = ['quit', 'close', 'stop', 'shutdown'];
/** System properties: a write changes them for every test that runs after. */
export const PROPERTY_SET = 'System.setProperty';
export const PROPERTY_CLEAR = 'System.clearProperty';
/** A page made from a browser context that the framework hands to the test is closed with it. */
export const AUTO_CLOSED_KINDS: ReadonlyArray<NResource['kind']> = ['page'];

// The lexical fallback (SPEC.md Section 7.2): line patterns for a file that cannot be parsed.

export const LEXICAL_TEST = /^\s*@(?:[\w.]+\.)?(?:Test|ParameterizedTest|RepeatedTest|TestFactory|TestTemplate)\b/;
export const LEXICAL_ANNOTATION = /^\s*@[\w.]+/;
export const LEXICAL_CLASS = /(?<![\w.@])(?:class|interface|record|enum)\s+(\w+)/;
/** `@Disabled`, `@Ignore`, and `@Test(enabled = false)` of TestNG. A skip on a condition is not read. */
export const LEXICAL_SKIP = /^\s*@(?:[\w.]+\.)?(?:Disabled|Ignore)\b|\benabled\s*=\s*false\b/;
export const LEXICAL_ASSERTION = /\bassert\w*\s*\(|^\s*assert\b|(?<![\w.])fail\s*\(|\bverify\w*\s*\(|\.then\s*\(\s*\)|\.(?:andExpect|expect|should)\w*\s*\(|\bStepVerifier\b/;
export const LEXICAL_FIXED_WAIT = /\bThread\.sleep\s*\(\s*(\d[\d_]*)?|\.waitForTimeout\s*\(\s*(\d[\d_]*)?/;

const simple = (name: string): string => name.slice(name.lastIndexOf('.') + 1);
const written = (names: readonly string[]): string[] => names.map((name) => `@${simple(name)}`);

/**
 * Every vocabulary entry in the form it has in source code. A test checks that each one is in
 * at least one golden fixture (CLAUDE.md, "Testing rules for adapters"). An annotation is
 * listed as `@Name`, and once more by the import that tells two frameworks apart.
 */
export const JAVA_VOCAB_SURFACE: readonly string[] = [...new Set([
  ...Object.keys(FRAMEWORK_PACKAGES), ...SHARED_JUNIT_PACKAGES, ...TEST_LIBRARY_PACKAGES,
  ...Object.keys(TEST_ANNOTATIONS), ...written(Object.keys(TEST_ANNOTATIONS)), ...Object.keys(HOOK_ANNOTATIONS), ...written(Object.keys(HOOK_ANNOTATIONS)),
  NESTED_ANNOTATION, DISPLAY_NAME_ANNOTATION, ...Object.keys(SKIP_ANNOTATIONS), ...written(Object.keys(SKIP_ANNOTATIONS)),
  `${ENABLED_ELEMENT} = false`, `${DESCRIPTION_ELEMENT} = `, ...CONDITION_ANNOTATIONS.map((name) => `@${name}`), `${CONDITION_REASON_ELEMENT} = `,
  ...Object.keys(SKIP_CALLS).map((name) => `${simple(name)}(`), 'Assumptions.', 'Assume.', ...THROWN_SKIPS.map((name) => `new ${simple(name)}(`),
  ...written(Object.keys(ARGUMENT_SOURCES)), ...UNCOUNTED_SOURCE_ELEMENTS.map((name) => `${name} = `), ...SOURCE_SETTING_ELEMENTS.map((name) => `${name} = `),
  `${DATA_PROVIDER_ELEMENT} = `, `@${simple(DATA_PROVIDER_ANNOTATION)}`, `@${simple(DATA_PROVIDER_ANNOTATION)}(${DATA_PROVIDER_NAME_ELEMENT} = `,
  `@${simple(RUN_WITH_ANNOTATION)}(${PARAMETERIZED_RUNNERS[0]}.class)`, '@Parameters', '@Parameterized.Parameters', ...ROW_WRAPPERS.map((name) => `${name}(`),
  // What a body checks.
  ...Object.keys(ASSERT_CLASSES), ...[...Object.keys(ASSERT_METHODS), ...GROUPING_METHODS, ...FAIL_METHODS, ...ALWAYS_RUN_CALLBACKS, DYNAMIC_TEST_CALL, ...Object.keys(ASSERTJ_THROW_ROOTS), ...VERIFY_WHOLE_CALLS].map((name) => `${name}(`),
  ...LISTING_CALLS.map((name) => `${name}(`), ...Object.keys(ASSERT_THAT_HOMES), ...ASSERT_THAT_NAMES.map((name) => `${name}(`),
  ...[...Object.keys(ASSERTJ_METHODS), ...ASSERTJ_NON_CHECKS, ...ASSERTJ_NAVIGATIONS, ...NEGATING_LINKS, ...Object.keys(RESTASSURED_CHECKS), ...RESPONSE_CHECK_METHODS, ...STATUS_READERS, ...BDD_WHOLE_CALLS, ...SNAPSHOT_METHODS, ...LOCATOR_METHODS, ...COUNT_METHODS, ...ALWAYS_RUN_METHODS].map((name) => `.${name}(`),
  ...SOFT_TYPES, `.${SOFT_REPORT_METHOD}()`, ...[...Object.keys(HAMCREST_WRAPPERS), ...Object.keys(HAMCREST_MATCHERS), ...NEVER_MODES, ...MOCK_FACTORIES].map((name) => `${name}(`),
  RESTASSURED_PACKAGE, `.${RESTASSURED_THEN}()`, STEP_VERIFIER, `.${STEP_VERIFIER_RUN_PREFIX}Complete(`, MOCKITO_PACKAGE, ...MOCKITO_CLASSES, ...PLATFORM_PACKAGES.map((name) => `import ${name}.`), `${VERIFY_CALL}(`, `.${BDD_SHOULD}(`, ...SNAPSHOT_CALLS.map((name) => `${name}(`),
  ...EXPECTED_EXCEPTION_ELEMENTS.map((name) => `${name} = `), EXPECTED_EXCEPTION_TYPE, ...EXPECTED_EXCEPTION_METHODS.map((name) => `.${name}(`),
  ...ASSERTION_CATCHERS.map((name) => `catch (${name} `), ...LOCATOR_REFINERS.map((name) => `.${name}(`), ...LOCATOR_TYPES, ...LOCATOR_FIELD_ANNOTATIONS.map((name) => `@${name}`),
  ...COUNT_FIELDS.map((name) => `.${name}`), ...MOCK_FIELD_ANNOTATIONS.map((name) => `@${name}`), `${ASSERT_METHOD_PREFIX}Cart`,
  // What a body does.
  ...Object.keys(TIME_UNITS).map((name) => `TimeUnit.${name}`), ...Object.keys(DURATION_FACTORIES).map((name) => `Duration.${name}(`), ...Object.keys(FIXED_SLEEPS).map((name) => `${name}(`),
  ...[UNIT_SLEEP_METHOD, ...Object.keys(FIXED_WAIT_METHODS), ...IMPLICIT_WAIT_METHODS, `${CONDITION_WAIT_PREFIX}URL`, ...WAIT_METHODS].map((name) => `.${name}(`), ...WAIT_TYPES, ...AWAIT_ROOTS.map((name) => `${name}(`),
  ...Object.keys(BY_METHODS).map((name) => `${SELENIUM_BY}.${name}(`), ...Object.keys(FIND_BY_ELEMENTS).map((name) => `@${FIND_BY_ANNOTATION}(${name} = `),
  `${FIND_BY_HOW_ELEMENT} = `, `${FIND_BY_USING_ELEMENT} = `, ...Object.keys(FIND_BY_HOW).map((name) => `How.${name}`),
  ...[...Object.keys(SELECTOR_CALLS), ...Object.keys(SELECTOR_ACTIONS), ...Object.keys(POSITIONAL), LIST_PICK_METHOD, LIST_FINDERS[0]!, ...Object.keys(STEP_METHODS), ...Object.keys(DRIVER_NAVIGATION)].map((name) => `.${name}(`),
  ...Object.keys(SELENIDE_SELECTORS).map((name) => `${name}(`), `.${SELENIDE_CHECK_PREFIX}Have(`, `.${SELENIDE_NEGATED_PREFIX}Be(`, ...PAGE_OBJECTS.map((name) => `${name}.`), ...PAGE_TYPES, ...TEST_ID_ATTRIBUTES, DRIVER_TYPE,
  ...[...Object.keys(HTTP_METHODS), ...Object.keys(REST_TEMPLATE_METHODS), ...SQL_METHODS, ...Object.keys(REPOSITORY_METHODS)].map((name) => `.${name}(`), ...REST_STARTERS.map((name) => `${name}(`),
  ...HTTP_CLIENT_NAMES.map((name) => `${name}.`), ...Object.keys(SQL_VERBS).map((verb) => `"${verb.toUpperCase()} `), ...REPOSITORY_SUFFIXES.map((suffix) => `order${suffix}.`),
  PASSTHROUGH_ANSWER, `@${INJECT_MOCKS_ANNOTATION}`, ...[...STUB_CALLS, ...STUB_REPLIES_FIRST].map((name) => `${name}(`), ...STUB_REPLY_PREFIXES.map((prefix) => `.${prefix}Return(`),
  ...REAL_METHOD_REPLIES.map((name) => `.${name}(`), `${WIREMOCK_STUB}(`, `${WIREMOCK_ANY_VERB}(${WIREMOCK_ANY_URL}())`, `.${WIREMOCK_REPLY}(`, `post${WIREMOCK_REQUESTED_SUFFIX}(`,
  ...[ROUTE_METHOD, ROUTE_FULFILL, ...ROUTE_CONTINUE].map((name) => `.${name}(`), ...ROUTE_OWNER_TYPES, ...MATCH_ALL_PATTERNS.map((pattern) => `"${pattern}"`),
  ...Object.keys(RESOURCE_TYPES).map((name) => `new ${name}(`), ...Object.keys(RESOURCE_CALLS).map((name) => `${name}(`), `${DRIVER_MANAGER.root}.`, `.${DRIVER_MANAGER.method}()`,
  ...RELEASE_METHODS.map((name) => `.${name}()`), `${PROPERTY_SET}(`, `${PROPERTY_CLEAR}(`,
])];
