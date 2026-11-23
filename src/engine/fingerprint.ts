// The id of a finding (SPEC.md Section 8.3). It is built from the rule, the file, the test and
// the evidence, never from a line number, so a decision made in the review page still matches
// after unrelated edits above the test.
import { createHash } from 'node:crypto';

/**
 * `occurrence` tells apart findings that agree on everything else, such as the same sleep
 * written twice in one test: 0 for the first, 1 for the second. The first one has the plain id.
 */
export function fingerprint(ruleId: string, file: string, testFullTitle: string | null, evidence: string, occurrence = 0): string {
  const parts = [ruleId, file, testFullTitle ?? '', evidence.replace(/\s+/g, ' ').trim()];
  if (occurrence > 0) parts.push(String(occurrence));
  return createHash('sha1').update(parts.join('\0')).digest('hex').slice(0, 16);
}
