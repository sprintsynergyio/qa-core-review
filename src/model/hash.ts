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

/**
 * The hash of a test body: sha1 of its tokens joined by one space. The adapter passes the
 * tokens with comments left out, so two bodies that differ only in comments, line breaks or
 * indentation get the same hash.
 */
export function bodyHash(tokens: readonly string[]): string {
  return createHash('sha1').update(tokens.join(' ')).digest('hex');
}
