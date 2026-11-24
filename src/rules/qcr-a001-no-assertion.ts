// QCR-A001 no-assertion (SPEC.md Section 10.2): a test that runs code and checks nothing.
import { fixFor } from './fix-text.js';
import type { Rule } from './types.js';
import { atStart, isNotRun } from './util.js';

export const noAssertion: Rule = {
  id: 'QCR-A001',
  name: 'no-assertion',
  defaultSeverity: 'error',
  scope: 'universal',
  // Helper calls count as assertions when the adapter can see helpers. The rule also runs
  // without that, on a file read by the lexical scanner, where its findings are less sure.
  requires: ['tests', 'assertions'],
  description: 'A test with no assertion: it passes whatever the code does.',
  check({ file }) {
    return file.tests
      // A test that expects an error has its check in that expectation. A test that is not run, or is empty, is for other rules.
      .filter((test) => test.assertions.length === 0 && !test.expectsException && test.statementCount >= 1 && !isNotRun(file, test))
      .map((test) => ({
        message: 'This test has no assertion, so it passes whatever the code does.', evidence: test.title, span: atStart(test.span), testId: test.id,
        ...fixFor('QCR-A001', file.language),
      }));
  },
};
