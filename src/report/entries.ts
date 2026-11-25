// What the Markdown and JUnit reports list: every test with its findings, and for each file the
// findings that belong to no test (a hook, a suite, the file itself). Suppressed findings are
// left out.
import type { FileResult, Finding, Report, TestResult } from '../rules/types.js';

export interface ReportEntry {
  file: FileResult;
  /** Null for the findings of a file that belong to no test. */
  test: TestResult | null;
  /** The line shown for the entry: the start of the test, or the first file finding. */
  line: number;
  findings: Finding[];
}

/** The entries of one file: its tests in order, then one entry for its file findings, if any. */
export function entriesOf(report: Report, file: FileResult): ReportEntry[] {
  const open = report.findings.filter((finding) => !finding.suppressed && finding.location.file === file.file);
  const byId = new Map(open.map((finding) => [finding.id, finding]));
  const entries: ReportEntry[] = file.tests.map((test) => ({ file, test, line: test.location.startLine, findings: test.findingIds.flatMap((id) => byId.get(id) ?? []) }));
  const own = open.filter((finding) => finding.testId === null);
  if (own.length > 0) entries.push({ file, test: null, line: own[0]!.location.startLine, findings: own });
  return entries;
}

/** The title of an entry. File findings are shown as "(file)". */
export const titleOf = (entry: ReportEntry): string => entry.test?.fullTitle ?? '(file)';
