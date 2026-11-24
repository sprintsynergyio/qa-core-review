// QCR-A002 trivial-assertion (SPEC.md Section 10.3): an assertion whose result is fixed by the
// code itself, such as `expect(true).toBe(true)` or `expect(total).toBe(total)`.
import type { NAssertion } from '../model/types.js';
import { fixFor } from './fix-text.js';
import type { FindingDraft, Rule } from './types.js';
import { hooksOf } from './util.js';

const FIXED_KINDS: ReadonlyArray<NAssertion['kind']> = ['equality', 'truthiness', 'nullness'];

/** The message when the assertion is trivial, or null. */
function trivial(assertion: NAssertion): string | null {
  const { actual, expected } = assertion;
  if (!assertion.complete || !actual) return null;
  // A literal checked against nothing, or against another literal. `expect(2).toBe(items.length)` is a real check written backwards.
  if (actual.kind === 'literal' && FIXED_KINDS.includes(assertion.kind) && (!expected || expected.kind === 'literal')) {
    return 'This assertion checks a fixed value, so it gives the same result whatever the code does.';
  }
  // The same expression on both sides. Negated, it would always fail, which is not a silent pass.
  if (expected && !assertion.negated && actual.normalized === expected.normalized) return 'This assertion compares a value with itself, so it always passes.';
  return null;
}

export const trivialAssertion: Rule = {
  id: 'QCR-A002',
  name: 'trivial-assertion',
  defaultSeverity: 'error',
  scope: 'universal',
  requires: ['assertions', 'assertion-operands'],
  description: 'An assertion whose result is fixed by the code itself, such as expect(true).toBe(true).',
  check({ file }) {
    const drafts: FindingDraft[] = [];
    const scan = (assertions: readonly NAssertion[], testId: string | null): void => {
      for (const assertion of assertions) {
        const message = trivial(assertion);
        if (message) drafts.push({ message, evidence: assertion.text, span: assertion.span, testId, ...fixFor('QCR-A002', file.language) });
      }
    };
    for (const test of file.tests) scan(test.assertions, test.id);
    for (const hook of hooksOf(file)) scan(hook.assertions, null);
    return drafts;
  },
};
