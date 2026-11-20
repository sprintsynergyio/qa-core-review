// Stable ids for the normalized model (SPEC.md Section 8.1).
import { createHash } from 'node:crypto';

/**
 * The id of a test: sha1 of file, full title and occurrence index, first 12 hex characters.
 * `occurrenceIndex` is 0 for the first test with that full title in the file, 1 for the next.
 * The id does not depend on line numbers, so it survives edits above the test.
 */
export function testId(file: string, fullTitle: string, occurrenceIndex: number): string {
  return createHash('sha1').update(`${file}\0${fullTitle}\0${occurrenceIndex}`).digest('hex').slice(0, 12);
}
