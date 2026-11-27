// The text a review prints (SPEC.md Section 11.4): a header, one block per test (fail first,
// then review, then pass), the findings that belong to a file and not to a test, and the
// closing lines. Paths use '/' on every OS.
import { LANGUAGE_NAMES, languageName } from '../model/languages.js';
import type { FileResult, Finding, Report, TestResult, Verdict } from '../rules/types.js';

export interface PrettyOptions {
  /** Color the verdict words. */
  color: boolean;
  /** Print only the summary line. */
  quiet: boolean;
  /** Stop printing findings after this many. The report file keeps all of them. */
  maxFindings: number;
  /** The report files that were written, as they should be shown. */
  reportPaths: readonly string[];
  /** False on a terminal that cannot show the middle dot of the header. */
  unicode: boolean;
}

export { LANGUAGE_NAMES, languageName };

const COLORS: Readonly<Record<Verdict, string>> = { fail: '\u001b[31m', review: '\u001b[33m', pass: '\u001b[32m' };
const RESET = '\u001b[0m';
const ORDER: readonly Verdict[] = ['fail', 'review', 'pass'];
const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

/** Color is on for a terminal, or when FORCE_COLOR is set, unless --no-color or NO_COLOR says no. */
export function useColor(input: { noColorFlag: boolean; env: Readonly<Record<string, string | undefined>>; isTTY: boolean }): boolean {
  if (input.noColorFlag || (input.env.NO_COLOR ?? '') !== '') return false;
  return input.isTTY || !['', '0', 'false'].includes(input.env.FORCE_COLOR ?? '');
}

/** `Summary: 10 pass, 2 review, 2 fail. 3 errors, 4 warnings, 2 info. 0 suppressed.` */
export function formatSummary(report: Report): string {
  const { summary } = report;
  return `Summary: ${summary.pass} pass, ${summary.review} review, ${summary.fail} fail. `
    + `${plural(summary.errors, 'error', 'errors')}, ${plural(summary.warnings, 'warning', 'warnings')}, ${summary.infos} info. ${summary.suppressed} suppressed.`;
}

/** The languages of a report, the one with the most files first. */
function languages(report: Report): Array<[string, Report['summary']['byLanguage'][string]]> {
  return Object.entries(report.summary.byLanguage).sort(([a, x], [b, y]) => y.files - x.files || (a < b ? -1 : 1));
}

export function formatPretty(report: Report, options: PrettyOptions): string {
  if (options.quiet) return `${formatSummary(report)}\n`;
  const { summary } = report;
  const lines: string[] = [];
  const dot = options.unicode ? '·' : '-';
  const mode = report.mode.llm === 'off' ? 'static rules' : `static rules and ${report.mode.llm}`;
  const names = languages(report).map(([id]) => languageName(id));
  // Diff mode: the counts are of changed files and changed tests only.
  const { diffBase } = report.mode;
  const scope = diffBase === null ? [] : [diffBase === 'staged' ? 'staged changes' : `changes since ${diffBase}`];
  lines.push([`qa-core-review ${report.tool.version}`, ...scope, plural(summary.files, 'file', 'files'), plural(summary.tests, 'test', 'tests'), mode, ...(names.length > 0 ? [names.join(', ')] : [])].join(` ${dot} `), '');

  // QCR-X003 says the same of every file of a language. It is printed for the first file, which also says how many more there are.
  const languageOf = new Map(report.files.map((file) => [file.file, file.languageHint ?? file.language]));
  const unreviewed = new Map<string, number>();
  const open = report.findings.filter((finding) => {
    if (finding.suppressed) return false;
    if (finding.ruleId !== 'QCR-X003') return true;
    const language = languageOf.get(finding.location.file)!;
    unreviewed.set(language, (unreviewed.get(language) ?? 0) + 1);
    return unreviewed.get(language) === 1;
  });
  const byId = new Map(open.map((finding) => [finding.id, finding]));
  let printed = 0;
  const show = (findings: readonly Finding[]): void => {
    for (const finding of findings) {
      if (printed >= options.maxFindings) return;
      printed += 1;
      lines.push(`  ${finding.ruleId}  ${finding.severity.padEnd(5)}  ${finding.location.startLine}:${finding.location.startColumn}  ${finding.message}`);
      if (finding.evidence !== '') lines.push(`    Evidence: ${finding.evidence}`);
      if (finding.fix !== '') lines.push(`    Fix: ${finding.fix}`);
    }
  };
  const word = (verdict: Verdict): string => (options.color ? `${COLORS[verdict]}${verdict}${RESET}` : verdict);

  // Tests: fail, then review, then pass, each in file and line order.
  const tests = report.files.flatMap((file) => file.tests.map((test): [FileResult, TestResult] => [file, test]));
  for (const verdict of ORDER) {
    for (const [file, test] of tests.filter(([, candidate]) => candidate.verdict === verdict)) {
      lines.push(`${word(verdict)}  ${file.file}:${test.location.startLine}  ${test.fullTitle}`);
      show(test.findingIds.flatMap((id) => byId.get(id) ?? []));
      lines.push('');
    }
  }
  // Findings about a whole file.
  for (const file of report.files) {
    const own = open.filter((finding) => finding.testId === null && finding.location.file === file.file);
    if (own.length === 0 || printed >= options.maxFindings) continue; // no heading with nothing under it
    const others = own.some((finding) => finding.ruleId === 'QCR-X003') ? unreviewed.get(languageOf.get(file.file)!)! - 1 : 0;
    lines.push(`file  ${file.file}${others > 0 ? ` (and ${plural(others, `more ${languageName(languageOf.get(file.file)!)} file`, `more ${languageName(languageOf.get(file.file)!)} files`)})` : ''}`);
    show(own);
    lines.push('');
  }
  if (printed < open.length) lines.push(`${plural(open.length - printed, 'more finding is', 'more findings are')} not shown (--max-findings ${options.maxFindings}). The report file has all of them.`, '');

  lines.push(formatSummary(report));
  const perLanguage = languages(report).map(([id, counts]) => {
    const own = report.files.filter((file) => (file.languageHint ?? file.language) === id);
    if (!own.every((file) => file.parseStatus === 'llm-only')) return `${languageName(id)} ${plural(counts.tests, 'test', 'tests')}`;
    // A language of the generic adapter is for the LLM review. Any other one has a static adapter that this build does not have yet.
    return `${languageName(id)} ${plural(counts.files, 'file', 'files')} (${own.every((file) => file.adapter === 'generic') ? 'LLM only' : 'not reviewed in this build'})`;
  });
  if (perLanguage.length > 0) lines.push(`By language: ${perLanguage.join(', ')}.`);
  lines.push(`Reports: ${options.reportPaths.join(', ')}`);
  return `${lines.join('\n')}\n`;
}
