// QCR-E001 swallowed-error (SPEC.md Section 10.8): an assertion inside a try block or a promise
// chain whose handler catches the failure and goes on, so the test passes with a failed check.
import type { NTryBlock, Span } from '../model/types.js';
import { fixFor } from './fix-text.js';
import type { FindingDraft, Rule } from './types.js';
import { atStart } from './util.js';

/** How a message names the handler. A block that expects an exception is not a handler. */
const HANDLERS: Record<NTryBlock['kind'], { name: string; key: string } | null> = {
  'try-catch': { name: 'catch block', key: 'QCR-E001' },
  'promise-catch': { name: '.catch() handler', key: 'QCR-E001/promise' },
  rescue: { name: 'rescue block', key: 'QCR-E001' },
  recover: { name: 'recover block', key: 'QCR-E001' },
  'expected-exception-block': null,
};

const starts = (span: Span): number[] => [span.startLine, span.startColumn];
const ends = (span: Span): number[] => [span.endLine, span.endColumn];
const notAfter = (a: number[], b: number[]): boolean => a[0]! < b[0]! || (a[0] === b[0] && a[1]! <= b[1]!);
const within = (inner: Span, outer: Span): boolean => notAfter(starts(outer), starts(inner)) && notAfter(ends(inner), ends(outer));

export const swallowedError: Rule = {
  id: 'QCR-E001',
  name: 'swallowed-error',
  defaultSeverity: 'error',
  scope: 'universal',
  requires: ['try-blocks'],
  description: 'An assertion failure that is caught and ignored, so the test passes when the check fails.',
  check({ file }) {
    const drafts: FindingDraft[] = [];
    for (const test of file.tests) {
      for (const block of test.tryBlocks) {
        const handler = HANDLERS[block.kind];
        const handled = block.handlerRethrows || block.handlerFails || block.handlerAsserts;
        if (!handler || block.assertionsInside === 0 || !block.catchesAssertionFailures || handled) continue;
        // The evidence is the first check whose failure is lost.
        const hidden = test.assertions.find((assertion) => !assertion.soft && within(assertion.span, block.span));
        drafts.push({
          message: `This ${handler.name} catches the assertion failure and hides it.`, evidence: hidden?.text ?? block.kind,
          span: atStart(block.span), testId: test.id, ...fixFor(handler.key, file.language),
        });
      }
    }
    return drafts;
  },
};
