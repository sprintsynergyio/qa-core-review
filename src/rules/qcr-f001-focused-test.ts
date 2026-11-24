// QCR-F001 focused-test (SPEC.md Section 10.9): a test or a suite marked to run alone. Left in
// by mistake, it makes the runner skip every other test while the run stays green.
import { fixFor } from './fix-text.js';
import type { Rule } from './types.js';
import { atStart, suitesOf } from './util.js';

export const focusedTest: Rule = {
  id: 'QCR-F001',
  name: 'focused-test',
  defaultSeverity: 'error',
  scope: 'framework',
  requires: ['modifiers'],
  description: 'A focused test or suite (.only, fit, fdescribe): the runner skips every other test.',
  check({ file }) {
    const fix = fixFor('QCR-F001', file.language);
    return [
      ...suitesOf(file).filter((suite) => suite.modifiers.includes('only')).map((suite) => ({
        message: 'This suite is focused, so the runner skips every test outside it.', evidence: suite.title, span: atStart(suite.span), testId: null, ...fix,
      })),
      ...file.tests.filter((test) => test.modifiers.includes('only')).map((test) => ({
        message: 'This test is focused, so the runner skips every other test.', evidence: test.title, span: atStart(test.span), testId: test.id, ...fix,
      })),
    ];
  },
};
