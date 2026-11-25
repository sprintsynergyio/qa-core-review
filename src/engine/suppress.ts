// Suppression (SPEC.md Section 10.17): comments in a file and entries in the config that
// switch a rule off for one line, one file or one test. A suppression needs a reason. One
// with no reason does nothing, and QCR-X002 reports it.
import type { ConfigSuppression } from '../config/types.js';
import type { NFile } from '../model/types.js';
import type { Finding } from '../rules/types.js';
import { matchGlob } from '../util/glob.js';

/**
 * Marks the findings of one file that a suppression covers. A next-line comment covers the
 * findings that start on the line after it. A suppressed finding stays in the JSON report and
 * counts for nothing else.
 */
export function applySuppressions(file: NFile, findings: Finding[], fromConfig: readonly ConfigSuppression[]): void {
  const inline = file.suppressions.filter((suppression) => suppression.reason !== null);
  const wholeFile = new Set(inline.filter((suppression) => suppression.scope === 'file').flatMap((suppression) => suppression.rules));
  const nextLine = inline.filter((suppression) => suppression.scope === 'next-line');
  const entries = fromConfig.filter((entry) => matchGlob(entry.file, file.path));
  const titleOf = (testId: string | null): string | null => file.tests.find((test) => test.id === testId)?.fullTitle ?? null;
  for (const finding of findings) {
    finding.suppressed = wholeFile.has(finding.ruleId)
      || nextLine.some((suppression) => suppression.span.endLine + 1 === finding.location.startLine && suppression.rules.includes(finding.ruleId))
      || entries.some((entry) => entry.rules.includes(finding.ruleId) && (entry.test === undefined || entry.test === titleOf(finding.testId)));
  }
}
