// QCR-F002 skipped-test (SPEC.md Section 10.9): a test or a suite that is switched off with no
// condition, a to-do with no body, or a test marked fixme. A skip that depends on a condition is
// a decision someone wrote down, and it is not reported.
import type { Modifier, NTest } from '../model/types.js';
import { fixFor } from './fix-text.js';
import type { FindingDraft, Rule } from './types.js';
import { atStart, suitesOf } from './util.js';

/** Ends a message with the reason of the skip, when the test gives one. */
const withReason = (message: string, reason: string | null | undefined, none = '.'): string => (reason ? `${message}: ${reason.replace(/[.\s]+$/, '')}.` : `${message}${none}`);

function testMessage(test: NTest): string | null {
  if (test.modifiers.includes('todo')) return 'This test is a to-do, so it checks nothing that can fail the run.';
  if (test.modifiers.includes('fixme')) return withReason('This test is marked fixme, so it does not run', test.skip?.reason);
  if (test.skip?.unconditional) return withReason('This test is skipped', test.skip.reason, ', and no reason is given.');
  return null;
}

const SUITE_MESSAGES: Array<[Modifier, string]> = [
  ['todo', 'This suite is a to-do, so none of its tests run.'],
  ['fixme', 'This suite is marked fixme, so none of its tests run.'],
  ['skip', 'This suite is skipped, so none of its tests run.'],
];

export const skippedTest: Rule = {
  id: 'QCR-F002',
  name: 'skipped-test',
  defaultSeverity: 'warn',
  scope: 'universal',
  requires: ['modifiers'],
  description: 'A test or suite that is skipped with no condition, a to-do, or a fixme. An expected failure is reported as info.',
  check({ file }) {
    const fix = fixFor('QCR-F002', file.language);
    const drafts: FindingDraft[] = [];
    for (const suite of suitesOf(file)) {
      const message = SUITE_MESSAGES.find(([modifier]) => suite.modifiers.includes(modifier))?.[1];
      if (message) drafts.push({ message, evidence: suite.title, span: atStart(suite.span), testId: null, ...fix });
    }
    for (const test of file.tests) {
      const message = testMessage(test);
      const common = { evidence: test.title, span: atStart(test.span), testId: test.id };
      if (message) drafts.push({ ...common, message, ...fix });
      else if (test.modifiers.some((modifier) => modifier === 'xfail' || modifier === 'fail')) {
        drafts.push({ ...common, severity: 'info', message: 'Expected failure: make sure this is tracked.', ...fixFor('QCR-F002/expected-failure', file.language) });
      }
    }
    return drafts;
  },
};
