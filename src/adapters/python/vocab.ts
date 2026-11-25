// The Python vocabulary (SPEC.md Section 9.2), as data. Every name the adapter knows about
// pytest, unittest and their helper libraries is in a table here, not in the code that reads
// the syntax tree. Names are fully qualified: `@mark.skip` after `from pytest import mark` is
// looked up as `pytest.mark.skip`.
//
// The first half holds the structure of a test file, the second half what a body checks. The
// names for waits, selectors, mocks and resources join it with the part of the adapter that
// reads them.
import type { AssertionKind, ComparisonOperator, FrameworkId, Modifier, NHook } from '../../model/types.js';

/** The top-level module of an import, and the framework it proves. */
export const FRAMEWORK_MODULES: Readonly<Record<string, FrameworkId>> = {
  pytest: 'pytest',
  unittest: 'unittest',
  playwright: 'playwright-python',
  selenium: 'selenium',
};

/** Test libraries that are no framework of their own: an import of one is still a test import. */
export const TEST_LIBRARY_MODULES: readonly string[] = ['pytest_asyncio', 'pytest_cases', 'parameterized'];

/** A function or method is a test when its name starts with this, and a class is a pytest suite when its name starts with `Test`. */
export const TEST_FUNCTION_PREFIX = 'test';
export const TEST_CLASS_PREFIX = 'Test';
/** Base classes that make a class a unittest suite whatever its name. */
export const UNITTEST_BASES: readonly string[] = ['unittest.TestCase', 'unittest.IsolatedAsyncioTestCase'];
/** Any other base class whose name ends like this is one too: Django's `TransactionTestCase`, `APITestCase`. */
export const TESTCASE_SUFFIX = 'TestCase';

/** Setup and teardown functions at module level. */
export const HOOK_FUNCTIONS: Readonly<Record<string, NHook['kind']>> = {
  setup_module: 'beforeAll',
  teardown_module: 'afterAll',
  setup_function: 'beforeEach',
  teardown_function: 'afterEach',
  setUpModule: 'beforeAll',
  tearDownModule: 'afterAll',
};

/** Setup and teardown methods of a test class: pytest names, then unittest names. */
export const HOOK_METHODS: Readonly<Record<string, NHook['kind']>> = {
  setup_method: 'beforeEach',
  teardown_method: 'afterEach',
  setup_class: 'beforeAll',
  teardown_class: 'afterAll',
  setUp: 'beforeEach',
  tearDown: 'afterEach',
  setUpClass: 'beforeAll',
  tearDownClass: 'afterAll',
  asyncSetUp: 'beforeEach',
  asyncTearDown: 'afterEach',
};

/** Decorators that make a function a fixture. */
export const FIXTURE_DECORATORS: readonly string[] = ['pytest.fixture', 'pytest_asyncio.fixture'];
/** A fixture with one of these scopes runs once for many tests. Without one it runs for each test. */
export const WIDE_FIXTURE_SCOPES: readonly string[] = ['class', 'module', 'package', 'session'];

/** Marks and decorators that change how a test runs. `conditional` ones depend on their first argument. */
export const MARKS: Readonly<Record<string, { modifier: Modifier; conditional: boolean }>> = {
  'pytest.mark.skip': { modifier: 'skip', conditional: false },
  'pytest.mark.skipif': { modifier: 'skip', conditional: true },
  'pytest.mark.xfail': { modifier: 'xfail', conditional: false },
  'unittest.skip': { modifier: 'skip', conditional: false },
  'unittest.skipIf': { modifier: 'skip', conditional: true },
  'unittest.skipUnless': { modifier: 'skip', conditional: true },
  'unittest.expectedFailure': { modifier: 'xfail', conditional: false },
};

/**
 * Decorators that make one function into many tests, with the position of the argument that
 * lists the cases. Null: the cases are not in the decorator.
 */
export const PARAMETRIZE_DECORATORS: Readonly<Record<string, number | null>> = {
  'pytest.mark.parametrize': 1,
  'pytest_cases.parametrize': 1,
  'pytest_cases.parametrize_with_cases': null,
  'parameterized.parameterized': 0,
  'parameterized.parameterized.expand': 0,
};

/** The module variable (or class attribute) that holds marks for every test below it. */
export const MARK_VARIABLE = 'pytestmark';

/** Calls that skip the test they are in. */
export const IN_BODY_SKIPS: readonly string[] = ['pytest.skip', 'self.skipTest'];
/** Calls that skip only when something is missing. */
export const CONDITIONAL_IN_BODY_SKIPS: readonly string[] = ['pytest.importorskip'];
/** Exceptions that skip the test when raised. */
export const RAISED_SKIPS: readonly string[] = ['unittest.SkipTest'];
/** The keywords that hold the reason of a skip. */
export const REASON_KEYWORDS: readonly string[] = ['reason', 'msg'];

/** One test per loop turn: `for n in [...]: with self.subTest(n=n): ...`. */
export const SUBTEST_CALL = 'self.subTest';

/** Names that mean "only while type checking": imports under `if TYPE_CHECKING:` are type-only. */
export const TYPE_CHECKING_NAMES: readonly string[] = ['typing.TYPE_CHECKING'];

/** Files named like tests keep the role 'test' with no test in them, so the review can say that none was found. */
export const TEST_FILE_NAME = /(^|\/)(test_[^/]*|[^/]*_test)\.py$/;
/** Files that hold fixtures and helpers and never tests of their own. */
export const SUPPORT_FILE_NAMES: readonly string[] = ['conftest.py', '__init__.py'];

// What a body checks.

/** What one matcher or assert method checks. `swap`: the value under test is the second argument. */
export interface Check {
  kind: AssertionKind;
  negated?: true;
  operator?: ComparisonOperator;
  swap?: true;
}

/** The library name of a plain `assert` statement. */
export const ASSERT_LIBRARY = 'pytest-assert';
/** The operators of an `assert` that compare sizes. */
export const COMPARISON_OPERATORS: Readonly<Record<string, ComparisonOperator>> = { '>': '>', '>=': '>=', '<': '<', '<=': '<=' };
/** `assert isinstance(x, T)` checks a type. */
export const TYPE_CHECK_FUNCTIONS: readonly string[] = ['isinstance', 'issubclass'];
/** A name that holds a snapshot: `assert page == snapshot` (syrupy). */
export const SNAPSHOT_FIXTURES: readonly string[] = ['snapshot'];
/** Calls that compare with a stored snapshot (pytest-snapshot). */
export const SNAPSHOT_CALLS: readonly string[] = ['snapshot.assert_match'];
/** An attribute that reads the status of an HTTP response. */
export const STATUS_ATTRIBUTES: readonly string[] = ['status_code', 'status'];
/** Methods of an HTTP response that raise when the status is an error (requests, httpx). */
export const STATUS_CHECK_METHODS: readonly string[] = ['raise_for_status'];
/** Attributes of a mock that say how it was called: `assert send.called`. */
export const MOCK_STATE_ATTRIBUTES: readonly string[] = ['called', 'call_count', 'call_args', 'call_args_list', 'mock_calls', 'await_count'];

/** The object whose `assert*` methods are unittest assertions. */
export const UNITTEST_ROOT = 'self';
export const UNITTEST_ASSERT_PREFIX = 'assert';
/** The unittest assert methods, and `assertMatchSnapshot` of snapshottest. Any other `self.assert*` method is a check of kind 'other'. */
export const UNITTEST_ASSERTS: Readonly<Record<string, Check>> = {
  assertEqual: { kind: 'equality' },
  assertNotEqual: { kind: 'equality', negated: true },
  assertAlmostEqual: { kind: 'equality' },
  assertNotAlmostEqual: { kind: 'equality', negated: true },
  assertCountEqual: { kind: 'equality' },
  assertListEqual: { kind: 'equality' },
  assertDictEqual: { kind: 'equality' },
  assertSetEqual: { kind: 'equality' },
  assertTupleEqual: { kind: 'equality' },
  assertSequenceEqual: { kind: 'equality' },
  assertMultiLineEqual: { kind: 'equality' },
  assertIs: { kind: 'equality' },
  assertIsNot: { kind: 'equality', negated: true },
  assertTrue: { kind: 'truthiness' },
  assertFalse: { kind: 'truthiness', negated: true },
  assertIsNone: { kind: 'nullness' },
  assertIsNotNone: { kind: 'nullness', negated: true },
  assertIn: { kind: 'contains', swap: true },
  assertNotIn: { kind: 'contains', negated: true, swap: true },
  assertRegex: { kind: 'contains' },
  assertNotRegex: { kind: 'contains', negated: true },
  assertIsInstance: { kind: 'type' },
  assertNotIsInstance: { kind: 'type', negated: true },
  assertGreater: { kind: 'comparison', operator: '>' },
  assertGreaterEqual: { kind: 'comparison', operator: '>=' },
  assertLess: { kind: 'comparison', operator: '<' },
  assertLessEqual: { kind: 'comparison', operator: '<=' },
  assertRaises: { kind: 'throws' },
  assertRaisesRegex: { kind: 'throws' },
  assertWarns: { kind: 'throws' },
  assertWarnsRegex: { kind: 'throws' },
  assertMatchSnapshot: { kind: 'snapshot' },
};

/** Calls that expect an exception or a warning, as a `with` block or with a function to call. */
export const EXCEPTION_CALLS: readonly string[] = ['pytest.raises', 'pytest.warns', 'pytest.deprecated_call'];
/** Calls that fail the test on the spot, with their library. */
export const FAIL_CALLS: Readonly<Record<string, string>> = { 'pytest.fail': 'pytest', 'self.fail': 'unittest' };

/** Playwright for Python: `expect(locator).to_be_visible()`. */
export const EXPECT_ROOT = 'expect';
export const PLAYWRIGHT_SYNC_MODULE = 'playwright.sync_api';
export const PLAYWRIGHT_ASYNC_MODULE = 'playwright.async_api';
/** A matcher with this prefix checks the opposite: `not_to_be_visible`. */
export const NEGATED_MATCHER_PREFIX = 'not_';
export const PLAYWRIGHT_MATCHERS: Readonly<Record<string, AssertionKind>> = {
  to_be_attached: 'ui-state', to_be_checked: 'ui-state', to_be_disabled: 'ui-state', to_be_editable: 'ui-state', to_be_empty: 'ui-state', to_be_enabled: 'ui-state',
  to_be_focused: 'ui-state', to_be_hidden: 'ui-state', to_be_in_viewport: 'ui-state', to_be_visible: 'ui-state', to_contain_text: 'ui-state', to_have_accessible_name: 'ui-state',
  to_have_attribute: 'ui-state', to_have_class: 'ui-state', to_have_css: 'ui-state', to_have_id: 'ui-state', to_have_role: 'ui-state', to_have_text: 'ui-state',
  to_have_value: 'ui-state', to_have_values: 'ui-state', to_have_title: 'ui-state', to_have_url: 'ui-state', to_have_count: 'count', to_be_ok: 'status',
};

/** The assert methods a Mock really has. */
export const MOCK_ASSERTS: readonly string[] = [
  'assert_called', 'assert_called_once', 'assert_called_with', 'assert_called_once_with', 'assert_any_call', 'assert_has_calls', 'assert_not_called',
  'assert_awaited', 'assert_awaited_once', 'assert_awaited_with', 'assert_awaited_once_with', 'assert_any_await', 'assert_has_awaits', 'assert_not_awaited',
];
export const NEGATED_MOCK_ASSERTS: readonly string[] = ['assert_not_called', 'assert_not_awaited'];
/**
 * Names that look like a Mock assertion and are none. A Mock makes up any attribute that is
 * asked of it, so `send.called_once_with(1)` returns a new Mock and checks nothing.
 */
export const PSEUDO_MOCK_ASSERTS: readonly string[] = ['called_once', 'called_once_with', 'called_with', 'has_calls', 'not_called', 'any_call'];
/** A function whose name starts like this is taken for an assertion: `np.testing.assert_allclose(a, b)`. */
export const ASSERT_FUNCTION_PREFIX = 'assert_';

/** pytest-check: `check.equal(a, b)` and `with check:` fail the test at its end, not on the spot. */
export const CHECK_ROOTS: readonly string[] = ['pytest_check.check', 'pytest_check'];
export const CHECK_METHODS: Readonly<Record<string, Check>> = {
  equal: { kind: 'equality' }, not_equal: { kind: 'equality', negated: true }, almost_equal: { kind: 'equality' },
  is_true: { kind: 'truthiness' }, is_false: { kind: 'truthiness', negated: true }, is_none: { kind: 'nullness' }, is_not_none: { kind: 'nullness', negated: true },
  is_in: { kind: 'contains', swap: true }, is_not_in: { kind: 'contains', negated: true, swap: true }, is_instance: { kind: 'type' },
  greater: { kind: 'comparison', operator: '>' }, greater_equal: { kind: 'comparison', operator: '>=' }, less: { kind: 'comparison', operator: '<' }, less_equal: { kind: 'comparison', operator: '<=' },
  raises: { kind: 'throws' },
};

/** `assert_that(actual, matcher)` of PyHamcrest, and `assert_that(actual).is_equal_to(expected)` of assertpy. */
export const ASSERT_THAT = 'assert_that';
export const HAMCREST_MODULE = 'hamcrest';
export const ASSERTPY_MODULE = 'assertpy';
/** Hamcrest matchers that only wrap another matcher. True: the wrapper turns it around. */
export const HAMCREST_WRAPPERS: Readonly<Record<string, boolean>> = { is_: false, is_not: true, not_: true };
export const HAMCREST_MATCHERS: Readonly<Record<string, Check>> = {
  equal_to: { kind: 'equality' }, close_to: { kind: 'equality' }, none: { kind: 'nullness' }, not_none: { kind: 'nullness', negated: true },
  has_length: { kind: 'count' }, empty: { kind: 'count' }, contains_string: { kind: 'contains' }, has_item: { kind: 'contains' }, has_items: { kind: 'contains' },
  instance_of: { kind: 'type' }, greater_than: { kind: 'comparison', operator: '>' }, greater_than_or_equal_to: { kind: 'comparison', operator: '>=' },
  less_than: { kind: 'comparison', operator: '<' }, less_than_or_equal_to: { kind: 'comparison', operator: '<=' }, raises: { kind: 'throws' },
};
/** Any other assertpy method with a name like this is a check of kind 'other': `is_close_to`, `has_name`, `matches`. */
export const ASSERTPY_CHECK_NAME = /^(is|has|does|contains|starts|ends|matches)(_|$)/;
export const ASSERTPY_METHODS: Readonly<Record<string, Check>> = {
  is_equal_to: { kind: 'equality' }, is_not_equal_to: { kind: 'equality', negated: true }, is_true: { kind: 'truthiness' }, is_false: { kind: 'truthiness', negated: true },
  is_none: { kind: 'nullness' }, is_not_none: { kind: 'nullness', negated: true }, contains: { kind: 'contains' }, does_not_contain: { kind: 'contains', negated: true },
  is_instance_of: { kind: 'type' }, is_length: { kind: 'count' }, is_empty: { kind: 'count' }, is_not_empty: { kind: 'count', negated: true },
  is_greater_than: { kind: 'comparison', operator: '>' }, is_greater_than_or_equal_to: { kind: 'comparison', operator: '>=' },
  is_less_than: { kind: 'comparison', operator: '<' }, is_less_than_or_equal_to: { kind: 'comparison', operator: '<=' }, raises: { kind: 'throws' },
};

// Operands: what kind of value an expression is.

/** Playwright calls that give a locator or an element handle. */
export const PLAYWRIGHT_LOCATORS: readonly string[] = [
  'locator', 'get_by_role', 'get_by_text', 'get_by_label', 'get_by_placeholder', 'get_by_alt_text', 'get_by_title', 'get_by_test_id', 'frame_locator', 'query_selector',
];
/** A locator narrowed down is still a locator. */
export const LOCATOR_REFINERS: readonly string[] = ['first', 'last', 'nth', 'filter'];
/** Selenium: `find_element` gives an element or raises, so its result always exists. The old `find_element_by_*` calls too. */
export const SELENIUM_LOCATORS: readonly string[] = ['find_element'];
export const SELENIUM_OLD_LOCATOR_PREFIX = 'find_element_by_';
/** Type names that say a variable or a parameter holds a locator or an element. */
export const LOCATOR_TYPES: readonly string[] = ['Locator', 'WebElement', 'ElementHandle'];
/** `len(rows)`, `rows.count()` and `send.call_count` are counts. */
export const COUNT_FUNCTIONS: readonly string[] = ['len'];
export const COUNT_METHODS: readonly string[] = ['count'];
export const COUNT_ATTRIBUTES: readonly string[] = ['call_count', 'await_count'];
/** What makes a mock: the classes and functions of `unittest.mock` (or the older `mock` package), and the `mocker` fixture of pytest-mock. */
export const MOCK_MODULES: readonly string[] = ['unittest.mock', 'mock'];
export const MOCK_FACTORIES: readonly string[] = ['Mock', 'MagicMock', 'AsyncMock', 'patch', 'patch.object', 'create_autospec'];
export const MOCKER_FIXTURE = 'mocker';
export const MOCKER_FACTORIES: readonly string[] = ['patch', 'patch.object', 'Mock', 'MagicMock', 'spy', 'stub'];
/** A parameter with a name like this holds a mock: `mock_send`, `send_mock`. */
export const MOCK_PARAMETER = /^(mock|mocked)(_|$)|_mock$/;

// Try blocks.

/** Catching one of these catches a failed assertion: AssertionError is an Exception. A bare `except:` does too. */
export const ASSERTION_CATCHERS: readonly string[] = ['BaseException', 'Exception', 'AssertionError'];
/** `with contextlib.suppress(Exception):` swallows what its block raises. */
export const SUPPRESS_CALLS: readonly string[] = ['contextlib.suppress'];

/** A qualified name as it is written after `import <module>`: `parameterized.parameterized.expand` is written `parameterized.expand`. */
const written = (name: string): string => name.replace(/^(\w+)\.\1(?=\.|$)/, '$1');

/**
 * Every name above, as it appears in source code. The vocabulary coverage test checks that
 * each one is in at least one golden fixture (CLAUDE.md, "Testing rules for adapters").
 */
export const PYTHON_VOCAB_SURFACE: readonly string[] = [...new Set([
  ...Object.keys(FRAMEWORK_MODULES), ...TEST_LIBRARY_MODULES, ...UNITTEST_BASES, TESTCASE_SUFFIX,
  ...Object.keys(HOOK_FUNCTIONS), ...Object.keys(HOOK_METHODS), ...FIXTURE_DECORATORS, ...WIDE_FIXTURE_SCOPES,
  ...Object.keys(MARKS), ...Object.keys(PARAMETRIZE_DECORATORS).map(written), MARK_VARIABLE,
  ...IN_BODY_SKIPS, ...CONDITIONAL_IN_BODY_SKIPS, ...RAISED_SKIPS, ...REASON_KEYWORDS, SUBTEST_CALL, ...TYPE_CHECKING_NAMES,
  ...TYPE_CHECK_FUNCTIONS, ...SNAPSHOT_FIXTURES, ...SNAPSHOT_CALLS, ...[...STATUS_ATTRIBUTES, ...STATUS_CHECK_METHODS, ...MOCK_STATE_ATTRIBUTES].map((name) => `.${name}`),
  ...Object.keys(UNITTEST_ASSERTS).map((name) => `${UNITTEST_ROOT}.${name}`), ...EXCEPTION_CALLS, ...Object.keys(FAIL_CALLS),
  PLAYWRIGHT_SYNC_MODULE, PLAYWRIGHT_ASYNC_MODULE, ...Object.keys(PLAYWRIGHT_MATCHERS).map((name) => `.${name}(`), `.${NEGATED_MATCHER_PREFIX}${Object.keys(PLAYWRIGHT_MATCHERS)[0]!}(`,
  ...[...MOCK_ASSERTS, ...PSEUDO_MOCK_ASSERTS].map((name) => `.${name}`), ...CHECK_ROOTS, ...Object.keys(CHECK_METHODS).map((name) => `check.${name}(`),
  `${HAMCREST_MODULE} import`, `${ASSERTPY_MODULE} import`, ...[...Object.keys(HAMCREST_WRAPPERS), ...Object.keys(HAMCREST_MATCHERS)].map((name) => `${name}(`),
  ...Object.keys(ASSERTPY_METHODS).map((name) => `.${name}(`),
  ...[...PLAYWRIGHT_LOCATORS, ...SELENIUM_LOCATORS, ...COUNT_METHODS].map((name) => `.${name}(`), ...LOCATOR_REFINERS.map((name) => `.${name}`), `.${SELENIUM_OLD_LOCATOR_PREFIX}id(`,
  ...LOCATOR_TYPES.map((name) => `: ${name}`), ...COUNT_FUNCTIONS.map((name) => `${name}(`), ...COUNT_ATTRIBUTES.map((name) => `.${name}`),
  ...MOCK_MODULES.map((name) => `${name} import`), ...MOCK_FACTORIES.map((name) => `${name}(`), ...MOCKER_FACTORIES.map((name) => `${MOCKER_FIXTURE}.${name}(`),
  ...ASSERTION_CATCHERS.map((name) => `except ${name}`), ...SUPPRESS_CALLS,
])];
