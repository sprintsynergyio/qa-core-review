// The Java vocabulary (SPEC.md Section 9.3), as data. Every name the adapter knows about
// JUnit 4, JUnit 5 and TestNG is in a table here, not in the code that reads the syntax tree.
// Names are fully qualified: `@Test` after `import org.junit.jupiter.api.Test;` is looked up
// as `org.junit.jupiter.api.Test`.
//
// This first part is the structure of a test file. What a body checks and what it does are
// added by the next parts of the adapter.
import type { FrameworkId, NHook, NTest } from '../../model/types.js';

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
/** JUnit 3 finds tests by the name of the method. Such a class is left alone. */
export const JUNIT3_BASES: readonly string[] = ['TestCase', 'junit.framework.TestCase'];

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
])];
