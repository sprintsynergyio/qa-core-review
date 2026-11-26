// QCR-A003 cannot-fail-assertion (SPEC.md Section 10.4): an assertion that looks real and can
// never go red. Each sub-case has its own message and fix. One finding per assertion: the
// first sub-case that matches.
import type { NAssertion } from '../model/types.js';
import { fixFor } from './fix-text.js';
import type { FindingDraft, Rule } from './types.js';
import { hooksOf } from './util.js';

const EXISTENCE_KINDS: ReadonlyArray<NAssertion['kind']> = ['truthiness', 'nullness'];

const SUB_CASES: ReadonlyArray<{ key: string; message: string; matches(assertion: NAssertion): boolean }> = [
  {
    // `mock.called_once_with(42)` in Python, where a mock accepts any name, or a real method that is named and never called.
    key: 'mock', message: 'This is not a check on the mock: the assertion method does not exist or is never called, so nothing is checked.',
    matches: (a) => !a.complete && a.kind === 'mock-call',
  },
  { key: 'incomplete', message: 'This assertion is never finished: no matcher is called, so nothing is checked.', matches: (a) => !a.complete },
  { key: 'unreachable', message: 'This assertion is never reached: the code before it always returns or throws.', matches: (a) => !a.reachable },
  { key: 'unawaited', message: 'This assertion is not awaited, so the test can end before it fails.', matches: (a) => a.awaited === 'no' },
  {
    key: 'locator', message: 'A locator object always exists, so this check passes even when the element is missing.',
    matches: (a) => a.actual?.isLocator === true && EXISTENCE_KINDS.includes(a.kind),
  },
  {
    // "At least 0", written directly or as "not below 0".
    key: 'count', message: 'A count is never below zero, so this check always passes.',
    matches: (a) => a.actual?.isCount === true && a.expected?.literal?.type === 'number' && Number(a.expected.literal.value) === 0
      && ((a.operator === '>=' && !a.negated) || (a.operator === '<' && a.negated)),
  },
  {
    key: 'collection', message: 'A list or an object that is written out with items is always truthy, so this check always passes.',
    matches: (a) => a.actual?.kind === 'collection' && a.kind === 'truthiness' && !a.negated,
  },
  {
    // `self.assertTrue(total, 29.99)`: a second value that is no message. The author meant an equality check.
    key: 'second-value', message: 'This check looks only at the first value. The second one is taken as the failure message, so the two are never compared.',
    matches: (a) => a.kind === 'truthiness' && a.expected !== null,
  },
];

export const cannotFailAssertion: Rule = {
  id: 'QCR-A003',
  name: 'cannot-fail-assertion',
  defaultSeverity: 'error',
  scope: 'universal',
  requires: ['assertions', 'assertion-operands', 'reachability'],
  description: 'An assertion that cannot fail: not finished, not awaited, never reached, or true by its nature.',
  check({ file }) {
    const drafts: FindingDraft[] = [];
    const scan = (assertions: readonly NAssertion[], testId: string | null): void => {
      for (const assertion of assertions) {
        const found = assertion.viaHelper === null ? SUB_CASES.find((subCase) => subCase.matches(assertion)) : undefined;
        if (found) drafts.push({ message: found.message, evidence: assertion.text, span: assertion.span, testId, ...fixFor(`QCR-A003/${found.key}`, file.language) });
      }
    };
    for (const test of file.tests) scan(test.assertions, test.id);
    for (const hook of hooksOf(file)) scan(hook.assertions, null);
    return drafts;
  },
};
