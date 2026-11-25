// QCR-X002 suppression-without-reason (SPEC.md Sections 10.15 and 10.17): a suppression
// comment that does not say why. It is ignored, so the finding it was meant for still shows.
import { fixFor } from './fix-text.js';
import type { Rule } from './types.js';

export const suppressionWithoutReason: Rule = {
  id: 'QCR-X002',
  name: 'suppression-without-reason',
  defaultSeverity: 'info',
  scope: 'universal',
  requires: [],
  description: 'A suppression comment with no reason. It is ignored until it says why.',
  check({ file }) {
    return file.suppressions.filter((suppression) => suppression.reason === null).map((suppression) => {
      const directive = `qa-core-review-disable${suppression.scope === 'next-line' ? '-next-line' : ''} ${suppression.rules.join(', ')}`.trim();
      return {
        message: 'This suppression has no reason, so it is ignored. Write the reason after " -- ".', evidence: directive, span: suppression.span, testId: null,
        ...fixFor('QCR-X002', file.language),
      };
    });
  },
};
