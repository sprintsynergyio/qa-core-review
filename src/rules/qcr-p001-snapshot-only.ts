// QCR-P001 snapshot-only (SPEC.md Section 10.13): a test whose only checks are snapshots. A
// snapshot passes on the first run whatever the output is, and it is often recorded again
// without a look. Visual checks are a valid choice, so a test with only those is info.
import type { NAssertion } from '../model/types.js';
import { fixFor } from './fix-text.js';
import type { FindingDraft, Rule } from './types.js';

/** `toMatchInlineSnapshot()` with nothing in it: the runner writes whatever the code gives on the next run. */
const isEmptyInline = (assertion: NAssertion): boolean => assertion.kind === 'snapshot' && assertion.expected === null && /inline/i.test(assertion.matcher ?? '');

export const snapshotOnly: Rule = {
  id: 'QCR-P001',
  name: 'snapshot-only',
  defaultSeverity: 'warn',
  scope: 'universal',
  requires: ['assertions'],
  description: 'A test whose only assertions are snapshots, or an inline snapshot recorded empty. Visual checks only are reported as info.',
  check({ file }) {
    const drafts: FindingDraft[] = [];
    for (const test of file.tests) {
      const at = (assertion: NAssertion): Pick<FindingDraft, 'evidence' | 'span' | 'testId'> => ({ evidence: assertion.text, span: assertion.span, testId: test.id });
      const empty = test.assertions.filter(isEmptyInline);
      for (const assertion of empty) {
        drafts.push({ ...at(assertion), message: 'This inline snapshot is empty, so the next run records whatever the code gives.', ...fixFor('QCR-P001/inline', file.language) });
      }
      const others = test.assertions.filter((assertion) => !empty.includes(assertion));
      if (test.assertions.length === 0 || others.length === 0 || !test.assertions.every((assertion) => assertion.kind === 'snapshot' || assertion.kind === 'visual')) continue;
      const count = test.assertions.length === 1 ? 'The only assertion of this test is' : `All ${test.assertions.length} assertions of this test are`;
      if (test.assertions.every((assertion) => assertion.kind === 'visual')) {
        drafts.push({
          ...at(others[0]!), severity: 'info', ...fixFor('QCR-P001/visual', file.language),
          message: `${count} ${test.assertions.length === 1 ? 'a visual check' : 'visual checks'}. That is a valid choice: make sure someone reviews each new baseline image.`,
        });
      } else {
        drafts.push({
          ...at(others[0]!), ...fixFor('QCR-P001', file.language),
          message: `${count} ${test.assertions.length === 1 ? 'a snapshot' : 'snapshots'}, which the first run records whatever the output is.`,
        });
      }
    }
    return drafts;
  },
};
