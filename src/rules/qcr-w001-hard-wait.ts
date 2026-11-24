// QCR-W001 hard-wait (SPEC.md Section 10.6): a fixed sleep in a test or a hook. Waits for a
// condition, fake timers and load-test pacing are not hard waits.
import type { NWait } from '../model/types.js';
import { fixFor } from './fix-text.js';
import type { FindingDraft, Rule } from './types.js';
import { hooksOf } from './util.js';

/** An implicit wait above this is reported, as info. */
const LONG_IMPLICIT_MS = 5000;

export const hardWait: Rule = {
  id: 'QCR-W001',
  name: 'hard-wait',
  defaultSeverity: 'warn',
  scope: 'universal',
  requires: ['waits'],
  description: 'A fixed sleep: it slows every run down and still fails when the page is slower than the sleep.',
  check({ file, options }) {
    const maxMs = typeof options.maxMs === 'number' ? options.maxMs : 0;
    const drafts: FindingDraft[] = [];
    const scan = (waits: readonly NWait[], testId: string | null): void => {
      for (const wait of waits) {
        const common = { evidence: wait.text, span: wait.span, testId };
        if (wait.kind === 'fixed-sleep' && (wait.ms === null || wait.ms > maxMs)) {
          drafts.push({ ...common, message: wait.ms === null ? 'Hard wait: the test sleeps for a fixed time.' : `Hard wait of ${wait.ms} ms.`, ...fixFor('QCR-W001', file.language) });
        } else if (wait.kind === 'implicit-wait-config' && wait.ms !== null && wait.ms > LONG_IMPLICIT_MS) {
          drafts.push({
            ...common, severity: 'info', ...fixFor('QCR-W001/implicit', file.language),
            message: `Implicit wait of ${wait.ms} ms. Mixed with explicit waits, the two add up and a missing element takes that long to fail.`,
          });
        }
      }
    };
    for (const test of file.tests) scan(test.waits, test.id);
    for (const hook of hooksOf(file)) scan(hook.waits, null);
    return drafts;
  },
};
