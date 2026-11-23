// The JS/TS vocabulary as data (SPEC.md Section 9.1): the names that declare tests, suites and
// hooks, the modifiers, and how a file shows which framework it uses. The normalizer reads
// these tables and holds no framework names of its own. A test checks that every entry here
// appears in at least one fixture under fixtures/adapters/js/.
import type { FrameworkId, Modifier, NHook } from '../../model/types.js';

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
];
