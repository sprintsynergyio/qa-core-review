// The JS/TS vocabulary as data (SPEC.md Section 9.1): the names that declare tests, suites and
// hooks, the modifiers, and how a file shows which framework it uses. The normalizer reads
// these tables and holds no framework names of its own. A test checks that every entry here
// appears in at least one fixture under fixtures/adapters/js/.
import type { AssertionKind, FrameworkId, Modifier, NHook } from '../../model/types.js';

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
/** A call in a catch handler that passes the error on and fails the test: Mocha `done(error)`. */
export const HANDLER_FAIL_CALLS = ['done', 'reject'] as const;

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
];
