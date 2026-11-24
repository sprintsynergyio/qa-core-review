// QCR-D001 duplicate-test (SPEC.md Section 10.10): a test copied from another one. The copy
// adds run time and a second place to fix, and it often hides that a case was never written.
import type { NFile, NTest } from '../model/types.js';
import { fixFor } from './fix-text.js';
import type { FindingDraft, Rule } from './types.js';
import { atStart } from './util.js';

/** A body shorter than this is too small to call a copy. */
const MIN_STATEMENTS = 2;

interface Copy { file: NFile; test: NTest }

/** The first test with each body, per language, over every file of the run. Built once per run. */
const firstCopies = new WeakMap<readonly NFile[], Map<string, Copy>>();

function firstCopiesOf(all: readonly NFile[]): Map<string, Copy> {
  let first = firstCopies.get(all);
  if (!first) {
    first = new Map();
    for (const file of all) {
      for (const test of file.tests) {
        const key = keyOf(file, test);
        if (key !== null && !first.has(key)) first.set(key, { file, test });
      }
    }
    firstCopies.set(all, first);
  }
  return first;
}

/** A test made from a table or a loop is one test with many cases, so it is never a copy. */
function keyOf(file: NFile, test: NTest): string | null {
  return test.bodyHash === null || test.parameterized !== null || test.statementCount < MIN_STATEMENTS ? null : `${file.language}\0${test.bodyHash}`;
}

export const duplicateTest: Rule = {
  id: 'QCR-D001',
  name: 'duplicate-test',
  defaultSeverity: 'warn',
  scope: 'universal',
  requires: ['body-hash'],
  description: 'A test with the same body as another test, or the same title as another test in the file.',
  check({ file, all }) {
    const first = firstCopiesOf(all);
    const drafts: FindingDraft[] = [];
    const titles = new Map<string, NTest>();
    for (const test of file.tests) {
      const key = keyOf(file, test);
      const original = key === null ? undefined : first.get(key);
      // The title of a generated test is a pattern. Its real titles come from the data, so it is not compared.
      const sameTitle = test.parameterized ? undefined : titles.get(test.fullTitle);
      if (!sameTitle && !test.parameterized) titles.set(test.fullTitle, test);
      const common = { span: atStart(test.span), testId: test.id };
      if (original && original.test !== test) {
        const where = original.file === file ? `line ${original.test.span.startLine}` : `${original.file.path}:${original.test.span.startLine}`;
        drafts.push({
          ...common, message: `This test has the same body as "${original.test.title}" (${where}).`,
          evidence: `${original.file.path} > ${original.test.fullTitle}`, ...fixFor('QCR-D001', file.language),
        });
      } else if (sameTitle) {
        drafts.push({
          ...common, message: `This test has the same title as the test on line ${sameTitle.span.startLine}, so a report cannot tell the two apart.`,
          evidence: test.fullTitle, ...fixFor('QCR-D001/title', file.language),
        });
      }
    }
    return drafts;
  },
};
