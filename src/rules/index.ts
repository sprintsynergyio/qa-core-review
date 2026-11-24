// The rule registry (SPEC.md Section 10): every rule that ships with the tool, in the order
// they are listed and run. The rules of the later milestones are added here.
import { noAssertion } from './qcr-a001-no-assertion.js';
import { trivialAssertion } from './qcr-a002-trivial-assertion.js';
import { cannotFailAssertion } from './qcr-a003-cannot-fail-assertion.js';
import { conditionalAssertion } from './qcr-a004-conditional-assertion.js';
import { parseError } from './qcr-x001-parse-error.js';
import type { Rule } from './types.js';

export const builtinRules: readonly Rule[] = [noAssertion, trivialAssertion, cannotFailAssertion, conditionalAssertion, parseError];

/** Where a rule is documented. */
export function docsUrlFor(ruleId: string): string {
  return `https://github.com/sprintsynergyio/qa-core-review/blob/main/docs/rules.md#${ruleId.toLowerCase()}`;
}
