// QCR-A004 conditional-assertion (SPEC.md Section 10.5): every assertion of a test sits inside
// a condition, a loop or a callback, so the test can pass with zero checks.
import { fixFor } from './fix-text.js';
import type { Rule } from './types.js';

export const conditionalAssertion: Rule = {
  id: 'QCR-A004',
  name: 'conditional-assertion',
  defaultSeverity: 'warn',
  scope: 'universal',
  requires: ['assertions'],
  description: 'Every assertion of a test is inside a condition, a loop or a callback, so the test can pass with zero checks.',
  check({ file }) {
    return file.tests
      // One assertion that always runs is enough, and so is a promise that assertions will run (expect.assertions).
      .filter((test) => test.assertions.length > 0 && test.assertions.every((assertion) => assertion.guarded) && !test.assertionGuards.expectedCount && !test.assertionGuards.hasAssertions)
      .map((test) => ({
        message: `${test.assertions.length === 1 ? 'The only assertion' : `All ${test.assertions.length} assertions`} of this test ${test.assertions.length === 1 ? 'is' : 'are'} inside a condition, a loop or a callback, so the test can pass with zero checks.`,
        evidence: test.assertions[0]!.text, span: test.assertions[0]!.span, testId: test.id, ...fixFor('QCR-A004', file.language),
      }));
  },
};
