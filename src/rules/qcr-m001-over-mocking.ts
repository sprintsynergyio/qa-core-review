// QCR-M001 over-mocking (SPEC.md Section 10.12): the code under test is replaced by a mock, so
// the test checks the mock. Five cases: two are errors (the subject itself is mocked), three
// are warnings (the test may still check something real).
import type { NAssertion, NFile, NMock } from '../model/types.js';
import { fixFor } from './fix-text.js';
import type { FindingDraft, Rule } from './types.js';

const REPLACES_CODE: ReadonlyArray<NMock['kind']> = ['module', 'class', 'object'];

/** True when the assertion calls the mocked function itself: `expect(total()).toBe(42)` for a mock named `total`. */
function callsMock(assertion: NAssertion, mock: NMock): boolean {
  const name = mock.target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return assertion.kind !== 'mock-call' && new RegExp(`(^|[^\\w$.])${name}\\s*\\(`).test(assertion.actual?.normalized ?? '');
}

/** A mock that stands in for real code: a mocked module, class or object, a faked network reply, or a function with a fixed reply. */
const replacesCode = (mock: NMock): boolean => !mock.passthrough && (mock.kind !== 'function' || mock.stubbedReturn);

/** `./cart` and `./cart`, or a dotted name inside a module: `shop.cart.get_total` in `shop.cart`. */
const sameModule = (source: string, target: string): boolean => target === source || target.startsWith(`${source}.`);

const isPageCheck = (assertion: NAssertion): boolean => assertion.kind === 'ui-state' || assertion.actual?.isLocator === true;

export const overMocking: Rule = {
  id: 'QCR-M001',
  name: 'over-mocking',
  defaultSeverity: 'error',
  scope: 'universal',
  requires: ['mocks', 'assertions', 'assertion-operands'],
  description: 'The code under test is replaced by a mock (error), or the test checks only mocks, mocks every import or fakes every network request (warn).',
  check({ file }) {
    const drafts: FindingDraft[] = [];
    const fix = (key: string): ReturnType<typeof fixFor> => fixFor(`QCR-M001/${key}`, file.language);

    // 1. The subject itself is mocked.
    const subjectMocked = (mocks: readonly NMock[], testId: string | null): void => {
      for (const mock of mocks) {
        if (mock.targetsSubject !== true || mock.passthrough || !REPLACES_CODE.includes(mock.kind)) continue;
        drafts.push({ message: `The code under test, ${mock.target}, is replaced by a mock, so the tests check the mock.`, evidence: mock.text, span: mock.span, testId, ...fix('subject') });
      }
    };
    subjectMocked(file.fileMocks, null);
    for (const test of file.tests) subjectMocked(test.mocks, test.id);

    for (const test of file.tests) {
      // 2. A function with a fixed reply that the test then calls and checks. Like case 1, it needs a file whose
      // module under test is known: with `targetsSubject` null the adapter could not tell, and we do not guess.
      const stubs = [...file.fileMocks, ...test.mocks].filter((mock) => mock.kind === 'function' && mock.stubbedReturn && mock.targetsSubject !== null);
      for (const assertion of test.assertions) {
        const stub = stubs.find((mock) => callsMock(assertion, mock));
        if (stub) {
          drafts.push({
            message: `${stub.target} is given a fixed reply and is then called and checked, so this assertion checks the mock.`,
            evidence: assertion.text, span: assertion.span, testId: test.id, ...fix('stubbed'),
          });
        }
      }
      // 3. Every assertion checks a call on a mock, in a test where a mock stands in for real code. A test that only
      // watches real code through a plain callback (`const onSave = vi.fn()`) or a spy that calls through is not reported.
      const mocks = [...file.fileMocks, ...test.mocks];
      const watchers = new Set(mocks.filter((mock) => mock.kind === 'function' && !mock.stubbedReturn).map((mock) => mock.target));
      const onlyWatches = test.assertions.every((assertion) => watchers.has(assertion.actual?.normalized ?? ''));
      if (mocks.some(replacesCode) && !onlyWatches && test.assertions.length > 0 && test.assertions.every((assertion) => assertion.kind === 'mock-call')) {
        drafts.push({
          message: test.assertions.length === 1 ? 'The only assertion of this test checks a call on a mock. No real result is checked.' : `All ${test.assertions.length} assertions of this test check calls on mocks. No real result is checked.`,
          evidence: test.assertions[0]!.text, span: test.assertions[0]!.span, testId: test.id, severity: 'warn', ...fix('calls-only'),
        });
      }
      // 5. Every network request is faked, and the test then checks the page.
      const fake = test.mocks.find((mock) => mock.fulfillsAllNetwork);
      if (fake && test.assertions.some(isPageCheck)) {
        drafts.push({
          message: `Every network request is answered by a fake (${fake.target}), so the checks on the page check the fake data.`,
          evidence: fake.text, span: fake.span, testId: test.id, severity: 'warn', ...fix('network'),
        });
      }
    }

    // 4. Every import of the file is mocked. Not said again when case 1 already reported the subject.
    const everythingMocked = allImportsMocked(file);
    if (everythingMocked && !drafts.some((draft) => draft.message.startsWith('The code under test'))) {
      drafts.push({
        message: `Every import of this file is mocked (${everythingMocked.sources.join(', ')}), so no real code runs in these tests.`,
        evidence: everythingMocked.first.text, span: everythingMocked.first.span, testId: null, severity: 'warn', ...fix('everything'),
      });
    }
    return drafts;
  },
};

function allImportsMocked(file: NFile): { sources: string[]; first: NMock } | null {
  const sources = [...new Set(file.imports.filter((entry) => !entry.typeOnly && !entry.framework).map((entry) => entry.source))];
  const mocks = [...file.fileMocks, ...file.tests.flatMap((test) => test.mocks)].filter((mock) => REPLACES_CODE.includes(mock.kind) && !mock.passthrough);
  const mockOf = (source: string): NMock | undefined => mocks.find((mock) => sameModule(source, mock.target));
  return sources.length > 0 && sources.every(mockOf) ? { sources, first: mockOf(sources[0]!)! } : null;
}
