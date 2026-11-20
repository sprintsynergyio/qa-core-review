// The normalized test model (SPEC.md Section 8.1).
//
// Every language adapter turns a test file into one NFile. Rules read only these types, so a
// rule written once works for every language. `schemas/model.schema.json` mirrors this file,
// and tests/model-schema.test.mjs checks that the value lists below match the schema.

/** Languages the model can name. `generic` is Tier 3; the real name is in `NFile.languageHint`. */
export const LANGUAGE_IDS = [
  'javascript', 'typescript', 'python', 'java',
  'csharp', 'go', 'ruby', 'kotlin', 'php',
  'robot', 'gherkin', 'jmeter', 'postman',
  'generic',
] as const;
export type LanguageId = (typeof LANGUAGE_IDS)[number];

/** Test runners and libraries. A runner runs tests (pytest); a library is used inside them (selenium). */
export const FRAMEWORK_IDS = [
  'playwright', 'cypress', 'jest', 'vitest', 'mocha', 'webdriverio', 'node-test',
  'pytest', 'unittest', 'playwright-python', 'selenium',
  'junit4', 'junit5', 'testng', 'restassured', 'playwright-java',
  'nunit', 'xunit', 'mstest', 'playwright-dotnet',
  'go-testing', 'testify', 'rspec', 'capybara', 'kotest', 'phpunit',
  'robot', 'cucumber', 'k6', 'jmeter', 'postman',
  'unknown',
] as const;
export type FrameworkId = (typeof FRAMEWORK_IDS)[number];

/**
 * What an adapter fills in reliably. A rule lists the capabilities it needs in `requires`, and
 * the engine skips the rule for a file that does not have them all (SPEC.md Section 7.3).
 */
export const CAPABILITIES = [
  'tests', 'suites', 'hooks', 'modifiers', 'parameterized',
  'assertions', 'assertion-operands', 'waits', 'selectors',
  'try-blocks', 'mocks', 'subject', 'network', 'data', 'resources',
  'body-hash', 'helpers', 'reachability',
] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const MODIFIERS = ['only', 'skip', 'todo', 'fixme', 'fail', 'xfail', 'concurrent', 'serial'] as const;
export type Modifier = (typeof MODIFIERS)[number];

export const ASSERTION_KINDS = [
  'equality', 'truthiness', 'nullness', 'comparison', 'contains', 'type',
  'throws', 'status', 'snapshot', 'visual', 'mock-call', 'ui-state', 'count',
  'fail-call', 'other',
] as const;
export type AssertionKind = (typeof ASSERTION_KINDS)[number];

export const SELECTOR_STRATEGIES = [
  'css', 'xpath', 'role', 'test-id', 'label', 'text', 'id', 'name', 'class', 'link-text', 'other',
] as const;
export type SelectorStrategy = (typeof SELECTOR_STRATEGIES)[number];

export const PARSE_STATUSES = ['ok', 'partial', 'failed', 'llm-only'] as const;
export type ParseStatus = (typeof PARSE_STATUSES)[number];

export type Tier = 1 | 2 | 3;

/**
 * A source range. Lines and columns are 1-based, on the LF-normalized text. The end is exclusive:
 * `endColumn` is the column just after the last character. Columns count UTF-16 code units.
 */
export interface Span {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

/** One operand of an assertion. */
export interface NExpr {
  /** Source text, at most 200 characters. */
  text: string;
  /** Whitespace collapsed, comments removed. */
  normalized: string;
  kind: 'literal' | 'identifier' | 'member' | 'call' | 'collection' | 'other';
  literal?: { type: 'bool' | 'number' | 'string' | 'null' | 'empty-collection'; value: string };
  /** A UI element handle or locator (Playwright Locator, Selenium WebElement, Cypress chain). */
  isLocator: boolean;
  /** A length, size or count of something. */
  isCount: boolean;
  /** Refers to a mock or spy. */
  isMock: boolean;
}

export interface NAssertion {
  span: Span;
  /** Evidence, at most 200 characters. */
  text: string;
  kind: AssertionKind;
  /** 'expect', 'node-assert', 'chai', 'pytest-assert', 'unittest', 'junit', 'assertj', and so on. */
  library: string;
  actual: NExpr | null;
  expected: NExpr | null;
  /** 'toBe', 'assertEquals', 'is_visible', and so on. */
  matcher: string | null;
  negated: boolean;
  /** expect.soft, SoftAssertions, pytest-check. */
  soft: boolean;
  /** False when the assertion is started but never finished, for example expect(x) with no matcher. */
  complete: boolean;
  /** Async assertions only. */
  awaited: 'yes' | 'no' | 'not-needed';
  /** Inside an if, switch, ternary, short-circuit, loop or callback within the test body. */
  guarded: boolean;
  /** False after an unconditional return, throw or fail in the same block. */
  reachable: boolean;
  /** The helper name when the assertion is counted through a helper call. */
  viaHelper: string | null;
  /** For 'status' assertions. */
  statusCodes?: number[];
}

export interface NWait {
  span: Span;
  text: string;
  /** 'pacing' is load-test think time, which is not a hard wait. */
  kind: 'fixed-sleep' | 'condition' | 'fake-timer' | 'implicit-wait-config' | 'pacing';
  /** Milliseconds, when the amount is a literal. */
  ms: number | null;
}

export interface NSelector {
  span: Span;
  text: string;
  /** 'locator', 'By.xpath', 'cy.get', 'find_element', and so on. */
  api: string;
  strategy: SelectorStrategy;
  /** The literal selector, when it is a literal. */
  value: string | null;
  positional?: { kind: 'nth' | 'first' | 'last'; index: number | null; baseStrategy: SelectorStrategy };
}

export interface NTryBlock {
  span: Span;
  kind: 'try-catch' | 'promise-catch' | 'rescue' | 'recover' | 'expected-exception-block';
  /** Assertions in the protected part, one helper deep. */
  assertionsInside: number;
  /** Caught types: 'AssertionError', 'Throwable', or '*' for a bare catch or except. */
  catches: string[];
  /** Decided by the adapter from `catches` and the language's exception tree. */
  catchesAssertionFailures: boolean;
  handlerRethrows: boolean;
  /** The handler calls fail(), pytest.fail, Assert.Fail, expect.fail and so on. */
  handlerFails: boolean;
  handlerAsserts: boolean;
}

export interface NMock {
  span: Span;
  text: string;
  kind: 'module' | 'function' | 'object' | 'class' | 'network' | 'global';
  /** Module path, qualified name or URL pattern. */
  target: string;
  /** Null when the adapter cannot tell. Never guess true. */
  targetsSubject: boolean | null;
  /** importActual, requireActual, wraps= or a spy that keeps the real behavior. */
  passthrough: boolean;
  /** mockReturnValue, return_value=, when().thenReturn(). */
  stubbedReturn: boolean;
  /** page.route('**\/*') with fulfill, cy.intercept('*'), and so on. */
  fulfillsAllNetwork: boolean;
}

export interface NResource {
  span: Span;
  text: string;
  kind:
    | 'browser' | 'context' | 'page' | 'driver' | 'api-context' | 'fake-timers' | 'spy' | 'env'
    | 'global' | 'patch' | 'file' | 'connection' | 'server';
  acquiredIn: 'test' | 'hook' | 'file';
  /** Released in the same test, a matching after hook, a fixture teardown, try-with-resources, `with`, defer or using. */
  released: boolean;
  /** Framework fixtures that clean up after themselves (page, tmp_path, monkeypatch, @TempDir). */
  autoManaged: boolean;
}

export interface NDataOp {
  span: Span;
  text: string;
  op: 'create' | 'update' | 'delete' | 'read';
  via: 'http' | 'db' | 'fs' | 'other';
}

export interface NStep {
  span: Span;
  text: string;
  kind: 'navigate' | 'action' | 'request' | 'call' | 'other';
}

export interface NHook {
  span: Span;
  kind: 'beforeAll' | 'beforeEach' | 'afterEach' | 'afterAll' | 'fixture-teardown';
  scope: 'file' | 'suite' | 'global';
  /** Normalized targets released here: 'driver', 'mocks', 'timers', 'env:API_URL', and so on. */
  releases: string[];
  assertions: NAssertion[];
}

export interface NTest {
  /** See `testId` in src/model/hash.ts. */
  id: string;
  title: string;
  /** 'Suite > Nested > test'. */
  fullTitle: string;
  suitePath: string[];
  kind: 'test' | 'scenario' | 'request' | 'load-scenario' | 'keyword-test';
  /** The whole declaration, including decorators and annotations. */
  span: Span;
  bodySpan: Span;
  modifiers: Modifier[];
  skip: { unconditional: boolean; conditional: boolean; reason: string | null } | null;
  /** Tests generated by each, parametrize or a data provider are one NTest with this set. */
  parameterized: {
    source: 'each' | 'parametrize' | 'ParameterizedTest' | 'DataProvider' | 'loop' | 'examples' | 'table';
    cases: number | null;
  } | null;
  assertions: NAssertion[];
  /** expect.assertions(n) and expect.hasAssertions(). */
  assertionGuards: { expectedCount: boolean; hasAssertions: boolean };
  /** @Test(expected=...), assertThrows, pytest.raises, toThrow, the ExpectedException rule. */
  expectsException: boolean;
  waits: NWait[];
  selectors: NSelector[];
  tryBlocks: NTryBlock[];
  mocks: NMock[];
  resources: NResource[];
  data: NDataOp[];
  steps: NStep[];
  statementCount: number;
  /** sha1 of the body token stream with comments and whitespace removed. */
  bodyHash: string | null;
  /** Gherkin: the matched step definitions (v0.2). */
  linkedSteps?: Array<{ file: string; span: Span }>;
}

export interface NSuite {
  title: string;
  span: Span;
  modifiers: Modifier[];
  hooks: NHook[];
  testIds: string[];
  suites: NSuite[];
}

export interface NImport {
  span: Span;
  source: string;
  names: string[];
  typeOnly: boolean;
  framework: boolean;
}

export interface NSuppression {
  span: Span;
  scope: 'next-line' | 'file';
  rules: string[];
  reason: string | null;
}

export interface NFile {
  /** Root-relative, with '/' separators on every OS. */
  path: string;
  language: LanguageId;
  /** Generic adapter only, for example 'scala'. */
  languageHint: string | null;
  adapter: string;
  tier: Tier;
  runner: FrameworkId;
  libraries: FrameworkId[];
  role: 'test' | 'support';
  parseStatus: ParseStatus;
  /** What was filled in for this file. The lexical fallback gives a smaller set than the adapter's. */
  capabilities: Capability[];
  suites: NSuite[];
  tests: NTest[];
  fileHooks: NHook[];
  fileMocks: NMock[];
  fileResources: NResource[];
  imports: NImport[];
  subject: { module: string; via: 'filename' | 'subjectMap' | 'class-under-test' } | null;
  suppressions: NSuppression[];
}
