// The Python vocabulary (SPEC.md Section 9.2), as data. Every name the adapter knows about
// pytest, unittest and their helper libraries is in a table here, not in the code that reads
// the syntax tree. Names are fully qualified: `@mark.skip` after `from pytest import mark` is
// looked up as `pytest.mark.skip`.
//
// This file holds the structure of a test file. The names for assertions, waits, selectors,
// mocks and resources join it with the parts of the adapter that read them.
import type { FrameworkId, Modifier, NHook } from '../../model/types.js';

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
])];
