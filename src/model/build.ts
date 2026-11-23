// Small helpers that every adapter uses to build model values (SPEC.md Section 8.1).
import type { NSuppression, NTest, Span } from './types.js';

const MAX_TEXT = 200;

/** Text and evidence fields hold at most 200 characters, on one line. */
export function clipText(text: string): string {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length <= MAX_TEXT ? oneLine : `${oneLine.slice(0, MAX_TEXT - 3)}...`;
}

/** A test with every list empty. The adapter fills in what it finds. */
export function emptyTest(base: Pick<NTest, 'id' | 'title' | 'fullTitle' | 'suitePath' | 'span' | 'bodySpan'>): NTest {
  return {
    ...base,
    kind: 'test',
    modifiers: [],
    skip: null,
    parameterized: null,
    assertions: [],
    assertionGuards: { expectedCount: false, hasAssertions: false },
    expectsException: false,
    waits: [],
    selectors: [],
    tryBlocks: [],
    mocks: [],
    resources: [],
    data: [],
    steps: [],
    statementCount: 0,
    bodyHash: null,
  };
}

const SUPPRESSION = /qa-core-review-disable(-next-line)?(?=\s|$)([^\n]*)/;

/**
 * Reads a suppression from the text of one comment (SPEC.md Section 10.17), in any language:
 *   qa-core-review-disable-next-line QCR-W001, QCR-S001 -- reason
 *   qa-core-review-disable QCR-S001 -- reason        (whole file)
 * Returns null when the comment is not a suppression. `reason` is null when none is given.
 */
export function parseSuppression(comment: string, span: Span): NSuppression | null {
  const match = SUPPRESSION.exec(comment);
  if (!match) return null;
  const [list = '', ...rest] = match[2]!.replace(/\*\/\s*$/, '').split('--');
  const rules = list.split(/[\s,]+/).filter((id) => id !== '');
  const reason = rest.join('--').trim();
  return { span, scope: match[1] ? 'next-line' : 'file', rules, reason: reason === '' ? null : reason };
}
