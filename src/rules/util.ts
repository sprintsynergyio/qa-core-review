// Small helpers shared by the rules. Like the rules, they read only the normalized model.
import type { NFile, NHook, NSuite, NTest, Span } from '../model/types.js';

/** A one-character span at the start of a span: where a finding about a whole test is reported. */
export const atStart = (span: Span): Span => ({ startLine: span.startLine, startColumn: span.startColumn, endLine: span.startLine, endColumn: span.startColumn + 1 });

const NOT_RUN = ['skip', 'todo', 'fixme'] as const;

/** Every suite of a file, nested ones included. */
export function suitesOf(file: NFile): NSuite[] {
  const walk = (suites: readonly NSuite[]): NSuite[] => suites.flatMap((suite) => [suite, ...walk(suite.suites)]);
  return walk(file.suites);
}

/** Every hook of a file: file level and inside suites. */
export const hooksOf = (file: NFile): NHook[] => [...file.fileHooks, ...suitesOf(file).flatMap((suite) => suite.hooks)];

/** True for a test that is not run: skipped, todo or fixme, by itself or through one of its suites. */
export function isNotRun(file: NFile, test: NTest): boolean {
  if (test.skip?.unconditional || test.modifiers.some((modifier) => (NOT_RUN as readonly string[]).includes(modifier))) return true;
  // A suite holds the ids of its own tests, and a nested suite's tests belong to its parents too.
  const within = (suite: NSuite): boolean => suite.testIds.includes(test.id) || suite.suites.some(within);
  return suitesOf(file).some((suite) => suite.modifiers.some((modifier) => (NOT_RUN as readonly string[]).includes(modifier)) && within(suite));
}
