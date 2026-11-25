// The JS/TS vocabulary as data (SPEC.md Section 9.1): the names that declare tests, suites and
// hooks, the modifiers, and how a file shows which framework it uses. The normalizer reads
// these tables and holds no framework names of its own. A test checks that every entry here
// appears in at least one fixture under fixtures/adapters/js/.
import type { AssertionKind, ComparisonOperator, FrameworkId, Modifier, NDataOp, NHook, NResource, NStep, NWait, SelectorStrategy } from '../../model/types.js';

/** A file with one of these names is a test file by its name, whatever is in it: `cart.test.ts`, `login.cy.js`. */
export const TEST_FILE_NAME = /\.(spec|test|cy|e2e)\.[cm]?[jt]sx?$/i;

/** Functions that declare a test: `test('title', fn)`. */
export const TEST_CALLEES = ['test', 'it', 'specify'] as const;

/** Functions that declare a suite: `describe('title', fn)`. */
export const SUITE_CALLEES = ['describe', 'context', 'suite'] as const;

/** Jest and Jasmine short names: a test or suite with a modifier built in. */
export const ALIASES: Readonly<Record<string, { kind: 'test' | 'suite'; modifier: Modifier }>> = {
  fit: { kind: 'test', modifier: 'only' },
  fdescribe: { kind: 'suite', modifier: 'only' },
  xit: { kind: 'test', modifier: 'skip' },
  xtest: { kind: 'test', modifier: 'skip' },
  xdescribe: { kind: 'suite', modifier: 'skip' },
};

/** Members that change a declaration: `test.only(...)`, `describe.serial(...)`. */
export const MODIFIER_MEMBERS: Readonly<Record<string, Modifier>> = {
  only: 'only',
  skip: 'skip',
  fixme: 'fixme',
  todo: 'todo',
  fail: 'fail',
  failing: 'fail',
  fails: 'fail',
  concurrent: 'concurrent',
  parallel: 'concurrent',
  serial: 'serial',
  sequential: 'serial',
};

/** `test.describe(...)` is a suite declared through the test function (Playwright). */
export const SUITE_MEMBER = 'describe';

/** Members that take a table and return the declaring function: `test.each(table)('title', fn)`. */
export const EACH_MEMBERS = ['each', 'for'] as const;

/** Members that take a condition and return the declaring function: `test.skipIf(cond)('title', fn)`. */
export const CONDITIONAL_MEMBERS = ['skipIf', 'runIf'] as const;

/** Hook functions, bare (`beforeEach(fn)`) or as a member (`test.beforeEach(fn)`). */
export const HOOK_CALLEES: Readonly<Record<string, NHook['kind']>> = {
  beforeAll: 'beforeAll',
  beforeEach: 'beforeEach',
  afterEach: 'afterEach',
  afterAll: 'afterAll',
  before: 'beforeAll',
  after: 'afterAll',
};

/** Calls inside a test body that skip the test at run time. */
export const IN_BODY_SKIPS = ['test.skip', 'test.fixme', 'this.skip'] as const;

/** Array methods whose callback declares one test per element. */
export const ITERATION_MEMBERS = ['forEach', 'map'] as const;

/** Keys of a test options object that act as modifiers (node:test): `test('t', { skip: true }, fn)`. */
export const OPTION_MODIFIERS: Readonly<Record<string, Modifier>> = { skip: 'skip', todo: 'todo', only: 'only' };

/**
 * An import from one of these modules proves the framework. Checked in this order. Cypress is
 * not here: its tests import nothing and are known by the `cy` global.
 */
export const FRAMEWORK_MODULES: Readonly<Record<string, FrameworkId>> = {
  '@playwright/test': 'playwright',
  vitest: 'vitest',
  '@jest/globals': 'jest',
  'node:test': 'node-test',
  '@wdio/globals': 'webdriverio',
  mocha: 'mocha',
};

/** Other test libraries. An import from one marks the import as test tooling, not as a subject. */
export const TEST_LIBRARY_MODULES = ['node:assert', 'node:assert/strict', 'assert', 'chai', 'sinon', 'expect-webdriverio', '@testing-library/react'] as const;

/**
 * Globals that show a framework without an import. `needsProject` markers are too common to
 * trust on their own (`browser.` is also Puppeteer), so they count only when the project
 * declares the framework.
 */
export const USAGE_MARKERS: ReadonlyArray<{ text: string; framework: FrameworkId; needsProject?: boolean }> = [
  { text: 'cy.', framework: 'cypress' },
  { text: 'Cypress.', framework: 'cypress' },
  { text: 'vi.', framework: 'vitest' },
  { text: 'jest.', framework: 'jest' },
  { text: 'browser.', framework: 'webdriverio', needsProject: true },
  { text: '$(', framework: 'webdriverio', needsProject: true },
];

/** Runners whose `describe` and `it` are globals, so a file can use them with no import at all. */
export const GLOBAL_RUNNERS: readonly FrameworkId[] = ['jest', 'mocha', 'webdriverio', 'cypress'];

// Assertions (SPEC.md Section 9.1).

/**
 * The root of an `expect(...)` chain, and its variants: `expect.soft(x)`, `expect.poll(fn)`,
 * `expect.element(locator)` (Vitest browser mode). The last two retry, so they must be awaited.
 */
export const EXPECT_ROOT = 'expect';
export const EXPECT_VARIANTS = ['soft', 'poll', 'element'] as const;
export const SOFT_VARIANT = 'soft';
export const RETRYING_VARIANTS = ['poll', 'element'] as const;

/** The library behind `expect`, from the module it is imported from, or else from the runner of the file. */
export const EXPECT_LIBRARY_BY_MODULE: Readonly<Record<string, string>> = {
  '@playwright/test': 'playwright', chai: 'chai', '@wdio/globals': 'expect-webdriverio', 'expect-webdriverio': 'expect-webdriverio',
  vitest: 'expect', '@jest/globals': 'expect',
};
export const EXPECT_LIBRARY_BY_RUNNER: Readonly<Partial<Record<FrameworkId, string>>> = { playwright: 'playwright', webdriverio: 'expect-webdriverio', cypress: 'chai' };

/** Calls that promise assertions will run, so a conditional assertion is safe. */
export const ASSERTION_GUARDS: Readonly<Record<string, 'expectedCount' | 'hasAssertions'>> = {
  'expect.assertions': 'expectedCount',
  'expect.hasAssertions': 'hasAssertions',
};

/** Calls that fail the test when reached. */
export const FAIL_CALLS = ['expect.fail', 'expect.unreachable', 'assert.fail', 'fail'] as const;

/**
 * The root of `assert(...)` and `assert.method(...)`. `assert` and `expect` are also read one
 * level down (`sinon.assert.calledOnce(spy)`, `t.assert.equal(a, b)`, `chai.expect(x)`); these
 * owners name the library, any other owner means node's assert.
 */
export const ASSERT_ROOT = 'assert';
export const LIBRARY_OWNERS: Readonly<Record<string, string>> = { sinon: 'sinon', chai: 'chai' };

/** Words in a chain that turn the check around. Assert methods use a prefix instead: `notEqual`, `doesNotThrow`, `isNotOk`. */
export const NEGATIONS = ['not'] as const;
export const NEGATED_ASSERT_METHOD = /^(not|doesNot|isNot)[A-Z]/;

/**
 * Words and matchers that make the check wait for a promise, so it must be awaited or returned.
 * `eventually`, `fulfilled`, `rejected` and `rejectedWith` are chai-as-promised.
 */
export const PROMISE_MODIFIERS = ['resolves', 'rejects', 'eventually'] as const;
export const PROMISE_MATCHERS = ['fulfilled', 'rejected', 'rejectedWith'] as const;

/** Chai words that only make a chain read well. */
export const CHAIN_WORDS = [
  'to', 'be', 'been', 'is', 'that', 'which', 'and', 'has', 'have', 'with', 'at', 'of', 'same', 'but', 'does', 'still', 'also',
  'deep', 'nested', 'own', 'ordered', 'any', 'all', 'itself',
] as const;

/** Chai assertions that are a property, not a call: `expect(x).to.be.true;`. */
export const PROPERTY_MATCHERS = [
  'true', 'false', 'null', 'undefined', 'ok', 'exist', 'empty', 'NaN', 'called', 'calledOnce', 'calledTwice', 'notCalled', 'fulfilled', 'rejected',
] as const;

/** The start of a chai `should` chain (`x.should.equal(y)`) and the Cypress commands that take a chainer (`.should('be.visible')`). */
export const SHOULD_MEMBER = 'should';
export const CYPRESS_ROOT = 'cy';
export const CYPRESS_ASSERT_COMMANDS = ['should', 'and'] as const;
/** A Cypress command that fails when its text is missing. It counts when it is the last command of a test. */
export const CYPRESS_CONTAINS = 'contains';
/** Calls that define a custom Cypress command. One that contains an assertion is a helper: `cy.expectLoggedIn()`. */
export const CYPRESS_COMMAND_DEFINERS = ['Cypress.Commands.add', 'Cypress.Commands.overwrite'] as const;

/** Playwright web-first matchers about the state of the page. They retry, so they must be awaited. */
const PLAYWRIGHT_UI_MATCHERS = [
  'toBeVisible', 'toBeHidden', 'toHaveText', 'toContainText', 'toHaveValue', 'toHaveValues', 'toHaveURL', 'toHaveTitle', 'toBeEnabled', 'toBeDisabled',
  'toBeChecked', 'toHaveAttribute', 'toHaveClass', 'toHaveCSS', 'toBeAttached', 'toBeEditable', 'toBeFocused', 'toBeEmpty', 'toHaveId', 'toHaveJSProperty',
  'toHaveAccessibleName', 'toHaveAccessibleDescription', 'toHaveRole', 'toBeInViewport',
] as const;

/**
 * What a matcher checks. One table for Jest, Vitest, Playwright, jest-dom, expect-webdriverio and
 * Chai matchers, node and Chai assert methods, and the last word of a Cypress chainer. A name
 * that is not here has kind 'other'.
 */
export const MATCHER_KINDS: Readonly<Partial<Record<AssertionKind, readonly string[]>>> = {
  equality: [
    'toBe', 'toEqual', 'toStrictEqual', 'toBeCloseTo', 'equal', 'equals', 'eq', 'eql', 'closeTo',
    'strictEqual', 'deepEqual', 'deepStrictEqual', 'notEqual', 'notStrictEqual', 'notDeepEqual', 'notDeepStrictEqual',
  ],
  truthiness: ['toBeTruthy', 'toBeFalsy', 'ok', 'true', 'false', 'isTrue', 'isFalse', 'isOk', 'isNotOk'],
  nullness: ['toBeNull', 'toBeUndefined', 'toBeDefined', 'toBeNaN', 'null', 'undefined', 'exist', 'NaN', 'isNull', 'isNotNull', 'isUndefined', 'isDefined', 'exists', 'notExists'],
  comparison: [
    'toBeGreaterThan', 'toBeGreaterThanOrEqual', 'toBeLessThan', 'toBeLessThanOrEqual', 'above', 'below', 'least', 'most',
    'gt', 'gte', 'lt', 'lte', 'greaterThan', 'lessThan', 'within', 'isAbove', 'isAtLeast', 'isBelow', 'isAtMost',
  ],
  contains: [
    'toContain', 'toContainEqual', 'toMatch', 'toMatchObject', 'toHaveProperty', 'include', 'includes', 'contain', 'contains',
    'match', 'matches', 'string', 'property', 'keys', 'members', 'oneOf', 'notInclude', 'doesNotMatch',
  ],
  type: ['toBeInstanceOf', 'toBeTypeOf', 'a', 'an', 'instanceof', 'instanceOf', 'typeOf', 'isString', 'isNumber', 'isArray', 'isObject', 'isFunction', 'isBoolean'],
  throws: ['toThrow', 'toThrowError', 'throw', 'throws', 'rejects', 'doesNotThrow', 'doesNotReject', 'rejected', 'rejectedWith'],
  status: ['toBeOK'],
  snapshot: [
    'toMatchSnapshot', 'toMatchInlineSnapshot', 'toMatchFileSnapshot', 'toThrowErrorMatchingSnapshot', 'toThrowErrorMatchingInlineSnapshot', 'toMatchAriaSnapshot',
  ],
  visual: ['toHaveScreenshot', 'toMatchImageSnapshot', 'matchImageSnapshot'],
  'mock-call': [
    'toHaveBeenCalled', 'toHaveBeenCalledTimes', 'toHaveBeenCalledWith', 'toHaveBeenLastCalledWith', 'toHaveBeenNthCalledWith', 'toHaveBeenCalledOnce',
    'toHaveReturned', 'toHaveReturnedWith', 'toBeCalled', 'toBeCalledWith', 'toBeCalledTimes',
    'called', 'calledOnce', 'calledTwice', 'notCalled', 'calledWith', 'calledOnceWith', 'calledWithExactly', 'callCount',
  ],
  'ui-state': [
    ...PLAYWRIGHT_UI_MATCHERS,
    // jest-dom
    'toBeInTheDocument', 'toHaveTextContent', 'toHaveStyle', 'toHaveFocus', 'toBeRequired', 'toBeValid', 'toBeInvalid', 'toHaveDisplayValue',
    // expect-webdriverio
    'toBeDisplayed', 'toExist', 'toBeExisting', 'toBeClickable', 'toBeSelected', 'toBeDisplayedInViewport', 'toHaveElementClass', 'toHaveHref', 'toHaveUrl', 'toHaveHTML',
  ],
  count: ['toHaveLength', 'toHaveCount', 'lengthOf', 'length', 'toBeElementsArrayOfSize'],
};

/** The direction of a comparison matcher: what the value must be, next to the expected one. */
export const COMPARISONS: Readonly<Record<string, ComparisonOperator>> = {
  toBeGreaterThan: '>', toBeGreaterThanOrEqual: '>=', toBeLessThan: '<', toBeLessThanOrEqual: '<=', above: '>', below: '<', least: '>=', most: '<=',
  gt: '>', gte: '>=', lt: '<', lte: '<=', greaterThan: '>', lessThan: '<', isAbove: '>', isAtLeast: '>=', isBelow: '<', isAtMost: '<=',
};

/** In a Cypress chainer these last words are about the page: `should('have.text', 'x')`, `should('not.exist')`. */
export const CYPRESS_UI_WORDS = [
  'visible', 'hidden', 'exist', 'text', 'value', 'class', 'attr', 'css', 'prop', 'html', 'checked', 'disabled', 'enabled', 'selected', 'focused', 'empty', 'id',
] as const;

/**
 * Playwright matchers that retry and return a promise, so they must be awaited
 * (`toPass` and every web-first matcher, whatever its kind).
 */
export const PLAYWRIGHT_ASYNC_MATCHERS: readonly string[] = [
  ...PLAYWRIGHT_UI_MATCHERS, 'toHaveCount', 'toHaveScreenshot', 'toBeOK', 'toMatchAriaSnapshot', 'toPass',
];

/** Assert methods that return a promise. */
export const ASYNC_ASSERT_METHODS = ['rejects', 'doesNotReject'] as const;

/** Matchers and assert methods that show the test expects an error. */
export const EXCEPTION_MATCHERS = ['toThrow', 'toThrowError', 'toThrowErrorMatchingSnapshot', 'toThrowErrorMatchingInlineSnapshot', 'throw', 'throws', 'rejects', 'rejected', 'rejectedWith'] as const;

/** A value read through one of these is an HTTP status: `expect(response.status()).toBe(200)`. */
export const STATUS_MEMBERS = ['status', 'statusCode'] as const;

// Operands.

/** Playwright calls that return a locator, on a page, a frame or another locator. */
export const PLAYWRIGHT_LOCATORS = ['locator', 'getByRole', 'getByTestId', 'getByText', 'getByLabel', 'getByPlaceholder', 'getByAltText', 'getByTitle', 'frameLocator'] as const;
/** Calls that narrow a locator and return a locator. */
export const LOCATOR_REFINERS = ['first', 'last', 'nth', 'filter'] as const;
/** Cypress commands that yield elements. */
export const CYPRESS_LOCATORS = ['get', 'find', 'contains', 'first', 'last', 'eq'] as const;
/** WebdriverIO element queries: `$('a')`, `$$('a')`, `browser.$('a')`, `row.$('a')`. */
export const WDIO_LOCATORS = ['$', '$$'] as const;
/** A TypeScript type that names a locator: `let button: Locator`. */
export const LOCATOR_TYPES = ['Locator', 'FrameLocator'] as const;

/** A length or a count of something: `rows.length`, `set.size`, `await rows.count()`. */
export const COUNT_PROPERTIES = ['length', 'size'] as const;
export const COUNT_METHODS = ['count'] as const;

/** Calls that make a mock or a spy. */
export const MOCK_CREATORS = ['jest.fn', 'vi.fn', 'jest.spyOn', 'vi.spyOn', 'sinon.stub', 'sinon.spy', 'sinon.fake', 'mock.fn', 'mock.method', 'cy.stub', 'cy.spy'] as const;

// Control flow around assertions.

/**
 * Calls whose callback always runs, so an assertion inside is not conditional: `test.step`,
 * a promise's `then`, Cypress `within`, Testing Library `waitFor`, and so on. A callback of
 * any other call might never run, and its assertions are marked as guarded.
 */
export const ALWAYS_RUN_CALLBACKS = ['step', 'then', 'finally', 'within', 'waitFor', 'act', 'should', 'and', 'waitUntil', 'Promise', 'expect', 'poll', 'throws', 'rejects', 'doesNotThrow', 'doesNotReject'] as const;

/** A promise `catch`: its handler swallows a failed assertion in the chain before it. */
export const PROMISE_CATCH = 'catch';
/** Members that end an assertion chain and start promise handling. */
export const PROMISE_MEMBERS = ['then', 'catch', 'finally'] as const;
/** A function given to `.catch(...)` by name that only logs or does nothing, so the failure is lost. */
export const SWALLOWING_HANDLERS = ['console.log', 'console.error', 'console.warn', 'noop'] as const;
/** A call in a catch handler that passes the error on and fails the test: Mocha `done(error)`. */
export const HANDLER_FAIL_CALLS = ['done', 'reject'] as const;

// Support files: where assertion helpers may live outside the test files.

/** What a relative import can point to: `./cart` may be `./cart.ts` or `./cart/index.ts`. In TypeScript `./cart.js` may be `./cart.ts`. */
export const MODULE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts'] as const;
/** Files Cypress loads before every spec, relative to the project. Custom commands are defined there. */
export const CYPRESS_SUPPORT_FILES = ['cypress/support/commands', 'cypress/support/e2e', 'cypress/support/index'] as const;

// Waits (SPEC.md Section 9.1). Method tables are keyed by the name of the method called.

/** A method that sleeps for a fixed time when its first argument is not a function, a string alias or missing. */
export const FIXED_WAIT_METHODS = ['waitForTimeout', 'pause', 'wait'] as const;
/** Bare functions that sleep when awaited: `await sleep(500)`. `setTimeout` is the promise form from node:timers/promises. */
export const FIXED_WAIT_FUNCTIONS = ['sleep', 'delay', 'wait', 'pause', 'setTimeout'] as const;
/** `browser.setTimeout({ implicit: 10000 })` sets a wait that every element lookup then uses (WebdriverIO). */
export const IMPLICIT_WAIT_METHODS = ['setTimeout'] as const;
export const IMPLICIT_WAIT_KEY = 'implicit';
/** `new Promise((resolve) => setTimeout(resolve, 500))`. */
export const TIMER_FUNCTION = 'setTimeout';
/** Methods that wait for a condition, and methods that move a fake clock. Neither is a hard wait. */
export const WAIT_METHODS: Readonly<Record<string, NWait['kind']>> = {
  waitForResponse: 'condition', waitForRequest: 'condition', waitForURL: 'condition', waitForSelector: 'condition', waitForLoadState: 'condition',
  waitForFunction: 'condition', waitForEvent: 'condition', waitUntil: 'condition', waitFor: 'condition', waitForDisplayed: 'condition',
  waitForExist: 'condition', waitForClickable: 'condition', waitForEnabled: 'condition',
  advanceTimersByTime: 'fake-timer', advanceTimersByTimeAsync: 'fake-timer', runAllTimers: 'fake-timer', runAllTimersAsync: 'fake-timer',
  runOnlyPendingTimers: 'fake-timer', clock: 'fake-timer', tick: 'fake-timer',
};

// Selectors.

/** Calls whose first string argument is a selector, with the strategy when the call fixes it (null: read it from the string). */
export const SELECTOR_CALLS: Readonly<Record<string, SelectorStrategy | null>> = {
  locator: null, frameLocator: null, $: null, $$: null, $eval: null, $$eval: null, waitForSelector: null, querySelector: null, querySelectorAll: null,
  get: null, find: null,
  getByRole: 'role', getByTestId: 'test-id', getByLabel: 'label', getByText: 'text', getByPlaceholder: 'other', getByAltText: 'other', getByTitle: 'other',
};
/** `get` and `find` are selectors only on a Cypress chain. */
export const CYPRESS_ONLY_SELECTOR_CALLS = ['get', 'find'] as const;
/** Page methods that take a selector first: `page.click('#buy')`, `page.fill('#name', 'Sam')`. The number is the fewest arguments. */
export const SELECTOR_ACTIONS: Readonly<Record<string, number>> = { click: 1, dblclick: 1, hover: 1, check: 1, fill: 2, type: 2, press: 2, selectOption: 2 };
/** Objects that have those methods. On a locator the first argument is a value, not a selector. */
export const PAGE_OBJECTS = ['page', 'frame'] as const;
/** Calls that pick one element by position. */
export const POSITIONAL_CALLS: Readonly<Record<string, 'nth' | 'first' | 'last'>> = { nth: 'nth', eq: 'nth', first: 'first', last: 'last' };
/** Test id attributes that are always known, next to the `testIdAttribute` of the config. */
export const TEST_ID_ATTRIBUTES = ['data-testid', 'data-test', 'data-qa', 'data-cy'] as const;

// Steps and data operations.

/** Objects that drive a page. A `click` or `fill` on anything else (an array, a map) is not a step. Locators count too. */
export const UI_ROOTS = ['page', 'frame', 'cy', 'browser', 'userEvent', 'user', 'fireEvent'] as const;
/** `browser.url('/cart')` goes to a page. `page.url()` only reads the address. */
export const NEEDS_ARGUMENT = ['url'] as const;
export const STEP_METHODS: Readonly<Record<string, NStep['kind']>> = {
  goto: 'navigate', visit: 'navigate', url: 'navigate', reload: 'navigate', goBack: 'navigate',
  click: 'action', dblclick: 'action', fill: 'action', type: 'action', press: 'action', check: 'action', uncheck: 'action', selectOption: 'action',
  hover: 'action', tap: 'action', clear: 'action', setValue: 'action', addValue: 'action', dragTo: 'action', setInputFiles: 'action', selectFile: 'action',
};
/** HTTP clients: `request.post(url)` (Playwright), `axios.get(url)`. `fetch(url, { method })` and `cy.request(...)` are read apart. */
export const HTTP_CLIENTS = ['request', 'axios'] as const;
export const HTTP_FUNCTION = 'fetch';
export const CYPRESS_REQUEST = 'request';
export const HTTP_METHODS: Readonly<Record<string, NDataOp['op']>> = { get: 'read', head: 'read', post: 'create', put: 'update', patch: 'update', delete: 'delete' };

// Mocks.

/** Calls that replace a whole module. */
export const MODULE_MOCKS = ['vi.mock', 'vi.doMock', 'jest.mock', 'jest.doMock', 'jest.unstable_mockModule'] as const;
/** A module factory that calls one of these keeps the real module. */
export const ACTUAL_MODULE_CALLS = ['importActual', 'requireActual', 'importOriginal'] as const;
/** Calls that replace one function on an object: `vi.spyOn(cart, 'total')`. `passthrough`: the real function still runs unless a reply is stubbed. */
export const FUNCTION_MOCKS: Readonly<Record<string, { passthrough: boolean; autoManaged?: boolean }>> = {
  'vi.spyOn': { passthrough: true }, 'jest.spyOn': { passthrough: true }, 'sinon.spy': { passthrough: true }, 'sinon.stub': { passthrough: false },
  'mock.method': { passthrough: true }, 'cy.spy': { passthrough: true, autoManaged: true }, 'cy.stub': { passthrough: false, autoManaged: true },
};
/** A mock function that replaces nothing by itself: `const save = vi.fn()`. */
export const BARE_MOCKS = ['vi.fn', 'jest.fn', 'sinon.stub', 'sinon.fake', 'mock.fn'] as const;
/** Chained calls that give a mock a fixed reply. */
export const STUB_METHODS = [
  'mockReturnValue', 'mockReturnValueOnce', 'mockResolvedValue', 'mockResolvedValueOnce', 'mockRejectedValue', 'mockRejectedValueOnce',
  'mockImplementation', 'mockImplementationOnce', 'returns', 'resolves', 'rejects', 'callsFake', 'throws',
] as const;
/** Network fakes: `page.route(pattern, handler)` and `cy.intercept(pattern, reply)`. */
export const ROUTE_METHOD = 'route';
export const CYPRESS_INTERCEPT = 'intercept';
/** In a route handler: a canned reply, or the real request going on. */
export const ROUTE_FULFILL = ['fulfill'] as const;
export const ROUTE_CONTINUE = ['continue', 'fallback', 'fetch'] as const;
/** Patterns that match every request. */
export const MATCH_ALL_PATTERNS = ['*', '**', '**/*', '/.*/'] as const;

// Resources and how they are released (SPEC.md Section 10.14). A release is a token: a resource is
// released when one of its tokens is released in the same test or in an after hook.

/** `named`: the first argument names the one thing that changes, so `vi.stubEnv('API_URL', x)` is also released by a write to `process.env.API_URL`. */
export interface ResourceRule { kind: NResource['kind']; releasedBy: string[]; autoManaged?: boolean; named?: boolean }
/** Calls that take hold of something, by their dotted name or by `.method` on any object. */
export const RESOURCE_CALLS: Readonly<Record<string, ResourceRule>> = {
  'vi.useFakeTimers': { kind: 'fake-timers', releasedBy: ['timers'] },
  'jest.useFakeTimers': { kind: 'fake-timers', releasedBy: ['timers'] },
  'sinon.useFakeTimers': { kind: 'fake-timers', releasedBy: ['timers', 'mocks'] },
  'cy.clock': { kind: 'fake-timers', releasedBy: [], autoManaged: true },
  'vi.stubGlobal': { kind: 'global', releasedBy: ['globals'], named: true },
  'vi.stubEnv': { kind: 'env', releasedBy: ['envs'], named: true },
  '.launch': { kind: 'browser', releasedBy: [] },
  '.newContext': { kind: 'context', releasedBy: [] },
  '.newPage': { kind: 'page', releasedBy: [] },
};
/** `request.newContext()` is an API client, not a browser context. */
export const API_CONTEXT_OWNER = 'request';
/** Calls that release every resource of a kind: the token they release. */
export const RELEASE_CALLS: Readonly<Record<string, string>> = {
  'vi.useRealTimers': 'timers', 'jest.useRealTimers': 'timers', 'vi.restoreAllMocks': 'mocks', 'jest.restoreAllMocks': 'mocks', 'sinon.restore': 'mocks',
  'vi.unstubAllGlobals': 'globals', 'vi.unstubAllEnvs': 'envs',
};
/** Methods that release the one thing they are called on: `context.close()`, `spy.mockRestore()`. */
export const RELEASE_METHODS = ['close', 'dispose', 'mockRestore', 'restore'] as const;
/**
 * Assigning to a member of one of these changes state that outlives the test. The release token is
 * the kind, a colon, the prefix and the member: `process.env.API_URL` gives 'env:API_URL', `Date.now` gives 'global:Date.now'.
 */
export const GLOBAL_OBJECTS: Readonly<Record<string, { kind: NResource['kind']; prefix: string }>> = {
  'process.env': { kind: 'env', prefix: '' }, globalThis: { kind: 'global', prefix: '' }, global: { kind: 'global', prefix: '' },
  window: { kind: 'global', prefix: '' }, Date: { kind: 'global', prefix: 'Date.' },
};
/** Playwright fixtures: the runner makes and closes them. */
export const AUTO_FIXTURES: Readonly<Record<string, NResource['kind']>> = { page: 'page', context: 'context', browser: 'browser', request: 'api-context' };

// The lexical fallback (SPEC.md Section 7.2): line patterns for a file that cannot be parsed.

export const LEXICAL_ASSERTION = /(?<![\w$.])(expect|assert)\s*[.(]|\.(should|and)\s*\(\s*['"`]/;
export const LEXICAL_FIXED_WAIT = /\.(waitForTimeout|pause)\s*\(\s*(\d+)?|(?<![\w$.])cy\.wait\s*\(\s*(\d+)|\bawait\s+(?:sleep|delay|wait|pause)\s*\(\s*(\d+)?/;

/** Every vocabulary entry as it is written in a test file, for the coverage test. */
export const VOCAB_SURFACE: readonly string[] = [
  ...TEST_CALLEES,
  ...SUITE_CALLEES,
  ...Object.keys(ALIASES),
  ...Object.keys(MODIFIER_MEMBERS).map((member) => `.${member}`),
  `.${SUITE_MEMBER}`,
  ...EACH_MEMBERS.map((member) => `.${member}`),
  ...CONDITIONAL_MEMBERS.map((member) => `.${member}`),
  ...Object.keys(HOOK_CALLEES),
  ...IN_BODY_SKIPS,
  ...ITERATION_MEMBERS.map((member) => `.${member}`),
  ...Object.keys(OPTION_MODIFIERS).map((key) => `${key}:`),
  ...Object.keys(FRAMEWORK_MODULES),
  ...TEST_LIBRARY_MODULES,
  ...USAGE_MARKERS.map((marker) => marker.text),
  EXPECT_ROOT,
  ...EXPECT_VARIANTS.map((member) => `${EXPECT_ROOT}.${member}`),
  ...Object.keys(ASSERTION_GUARDS),
  ...FAIL_CALLS,
  ...CYPRESS_COMMAND_DEFINERS,
  ASSERT_ROOT,
  ...Object.keys(LIBRARY_OWNERS).map((owner) => `${owner}.`),
  't.assert',
  ...[...NEGATIONS, ...PROMISE_MODIFIERS, ...CHAIN_WORDS, ...PROPERTY_MATCHERS, SHOULD_MEMBER, ...CYPRESS_ASSERT_COMMANDS, CYPRESS_CONTAINS].map((member) => `.${member}`),
  ...Object.values(MATCHER_KINDS).flat().map((member) => `.${member}`),
  ...CYPRESS_UI_WORDS.map((member) => `.${member}`),
  '.toPass',
  ...[...PLAYWRIGHT_LOCATORS, ...LOCATOR_REFINERS, ...CYPRESS_LOCATORS, ...COUNT_PROPERTIES, ...COUNT_METHODS, ...STATUS_MEMBERS].map((member) => `.${member}`),
  ...WDIO_LOCATORS.map((member) => `${member}(`),
  ...LOCATOR_TYPES.map((type) => `: ${type}`),
  ...MOCK_CREATORS,
  ...ALWAYS_RUN_CALLBACKS.map((name) => `${name}(`),
  ...PROMISE_MEMBERS.map((member) => `.${member}`),
  ...HANDLER_FAIL_CALLS.map((name) => `${name}(`),
  ...SWALLOWING_HANDLERS.map((name) => `.${PROMISE_CATCH}(${name})`),
  ...CYPRESS_SUPPORT_FILES,
  ...[...FIXED_WAIT_METHODS, ...Object.keys(WAIT_METHODS), ...Object.keys(SELECTOR_CALLS), ...Object.keys(POSITIONAL_CALLS), ...Object.keys(STEP_METHODS)].map((name) => `.${name}(`),
  ...FIXED_WAIT_FUNCTIONS.map((name) => `await ${name}(`),
  `new Promise((resolve) => ${TIMER_FUNCTION}(`,
  ...IMPLICIT_WAIT_METHODS.map((name) => `.${name}({ ${IMPLICIT_WAIT_KEY}:`),
  ...Object.keys(SELECTOR_ACTIONS).map((name) => `.${name}(`),
  ...[...PAGE_OBJECTS, ...UI_ROOTS, ...HTTP_CLIENTS, ...Object.keys(GLOBAL_OBJECTS)].map((object) => `${object}.`),
  ...TEST_ID_ATTRIBUTES,
  ...Object.keys(HTTP_METHODS).map((method) => `.${method}(`),
  `${HTTP_FUNCTION}(`, `cy.${CYPRESS_REQUEST}(`, `cy.${CYPRESS_INTERCEPT}(`, `.${ROUTE_METHOD}(`,
  ...MODULE_MOCKS, ...Object.keys(FUNCTION_MOCKS), ...BARE_MOCKS.map((name) => `= ${name}(`),
  ...ACTUAL_MODULE_CALLS.map((name) => `${name}(`),
  ...[...STUB_METHODS, ...ROUTE_FULFILL, ...ROUTE_CONTINUE, ...RELEASE_METHODS].map((name) => `.${name}(`),
  ...MATCH_ALL_PATTERNS,
  ...Object.keys(RESOURCE_CALLS), ...Object.keys(RELEASE_CALLS), `${API_CONTEXT_OWNER}.newContext(`,
  ...Object.keys(AUTO_FIXTURES).map((name) => `${name} }`),
];
