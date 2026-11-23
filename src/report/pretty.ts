// The text a review prints (SPEC.md Section 11.4). So far the closing lines: the summary and
// where the report was written. The per-test layout is added with the pretty reporter.
import type { Report } from '../rules/types.js';

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

/** `Summary: 10 pass, 2 review, 2 fail. 3 errors, 4 warnings, 2 info. 0 suppressed.` */
export function formatSummary(report: Report): string {
  const { summary } = report;
  return `Summary: ${summary.pass} pass, ${summary.review} review, ${summary.fail} fail. `
    + `${plural(summary.errors, 'error', 'errors')}, ${plural(summary.warnings, 'warning', 'warnings')}, ${summary.infos} info. ${summary.suppressed} suppressed.`;
}

/** The lines printed after a review: the counts, then the report files. */
export function formatClosing(report: Report, reportPaths: readonly string[]): string {
  const counted = `${plural(report.summary.files, 'file', 'files')}, ${plural(report.summary.tests, 'test', 'tests')}`;
  return `qa-core-review ${report.tool.version}: ${counted}\n${formatSummary(report)}\nReports: ${reportPaths.join(', ')}\n`;
}
