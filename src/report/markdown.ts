// The Markdown report (SPEC.md Section 11.6): report.md and the body of the PR comment. A table
// of the tests that need changes or review, then the findings of each one in a collapsed block.
import type { FileResult, Report, Verdict } from '../rules/types.js';
import { verdictOf } from '../engine/verdict.js';
import { entriesOf, titleOf, type ReportEntry } from './entries.js';
import { languageName } from './pretty.js';

/** The first line. The `comment` command finds its own comment by it. */
export const MARKDOWN_MARKER = '<!-- qa-core-review -->';
/** A PR comment can hold a little more than this. */
export const MARKDOWN_LIMIT = 60_000;
const FOOTER = 'Reviewed by [qa-core-review](https://github.com/sprintsynergyio/qa-core-review), an open-source tool by SprintSynergy.';
const SHORT_NAMES: Readonly<Record<string, string>> = {
  typescript: 'TS', javascript: 'JS', python: 'Py', java: 'Java', csharp: 'C#', go: 'Go', ruby: 'Rb', kotlin: 'Kt', php: 'PHP',
  robot: 'Robot', gherkin: 'Gherkin', jmeter: 'JMeter', postman: 'Postman',
};

export interface MarkdownOptions {
  /** Where report.json is, as it should be shown when the details are dropped. */
  reportPath?: string;
}

/** The short name of a file's language. A k6 script is shown as k6, a Tier 3 file by its language hint. */
function shortLanguage(file: FileResult): string {
  if (file.runner === 'k6') return 'k6';
  return file.languageHint !== null ? languageName(file.languageHint) : SHORT_NAMES[file.language] ?? languageName(file.language);
}

/**
 * A name on a hosting site is not mentioned by a test title: "@smoke" stays text. The
 * zero-width space after the "@" is what stops the mention.
 */
const noMention = (value: string): string => value.replace(/@/g, '@​');

/** Text from the reviewed code (a title, a message that quotes one) as Markdown text, on one line. */
export function markdownText(value: string): string {
  return noMention(value.replace(/\s+/g, ' ').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/[\\`|*_[\]]/g, '\\$&'));
}

/** The same text inside an HTML tag, where Markdown escapes are not read. */
const htmlText = (value: string): string => noMention(value.replace(/\s+/g, ' ').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));

/** Inline code. The fence is longer than any run of backticks inside, and a "|" cannot end a table cell. */
export function markdownCode(value: string): string {
  const text = value.replace(/\s+/g, ' ').replace(/\|/g, '\\|');
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const fence = '`'.repeat(longest + 1);
  return longest === 0 ? `${fence}${text}${fence}` : `${fence} ${text} ${fence}`;
}

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

/** "2 tests need changes, 2 need review, 5 pass." or "All 9 tests pass review." */
function verdictLine(report: Report, fileEntries: number): string {
  const { summary } = report;
  let line: string;
  if (summary.tests === 0) line = 'No tests were reviewed.';
  else if (summary.fail === 0 && summary.review === 0) line = summary.tests === 1 ? 'The 1 test passes review.' : `All ${summary.tests} tests pass review.`;
  else line = `${plural(summary.fail, 'test needs', 'tests need')} changes, ${plural(summary.review, 'needs', 'need')} review, ${plural(summary.pass, 'passes', 'pass')}.`;
  return fileEntries === 0 ? line : `${line} ${plural(fileEntries, 'file has', 'files have')} findings outside ${fileEntries === 1 ? 'its' : 'their'} tests.`;
}

export function formatMarkdown(report: Report, options: MarkdownOptions = {}): string {
  // Tests that fail or need review, and file findings of the same weight. Fail first, each group in file and line order.
  const listed: Array<[Verdict, ReportEntry]> = [];
  for (const file of report.files) {
    for (const entry of entriesOf(report, file)) {
      const verdict = entry.test?.verdict ?? verdictOf(entry.findings);
      if (verdict !== 'pass') listed.push([verdict, entry]);
    }
  }
  listed.sort(([a], [b]) => (a === b ? 0 : a === 'fail' ? -1 : 1));

  // A row for file findings points at the first one that is more than a note.
  const lineOf = (entry: ReportEntry): number => (entry.test ? entry.line : (entry.findings.find((finding) => finding.severity !== 'info') ?? entry.findings[0]!).location.startLine);
  const head = [MARKDOWN_MARKER, '## Test review', '', verdictLine(report, listed.filter(([, entry]) => entry.test === null).length)];
  const rows = listed.map(([verdict, entry]) => {
    const rules = [...new Set(entry.findings.map((finding) => finding.ruleId))].join(', ');
    return `| ${verdict} | ${markdownCode(`${entry.file.file}:${lineOf(entry)}`)} | ${markdownText(shortLanguage(entry.file))} | ${markdownText(titleOf(entry))} | ${rules} |`;
  });
  const tableHead = ['', '| Verdict | Where | Lang | Test | Rules |', '| --- | --- | --- | --- | --- |'];

  // Files that no static adapter reads.
  const unread = report.files.filter((file) => file.parseStatus === 'llm-only').map((file) => markdownCode(file.file));
  const shownUnread = unread.slice(0, 20);
  const unreadLine = unread.length === 0 ? [] : ['', `${report.mode.llm === 'off' ? 'Not reviewed (no static adapter, and LLM mode is off)' : 'Reviewed by the LLM only (no static adapter)'}: `
    + `${shownUnread.join(', ')}${unread.length > shownUnread.length ? ` and ${unread.length - shownUnread.length} more` : ''}.`];

  const details = listed.flatMap(([verdict, entry]) => ['',
    '<details>', `<summary>${verdict}: ${htmlText(`${entry.file.file}:${lineOf(entry)}`)} ${htmlText(titleOf(entry))}</summary>`, '',
    ...entry.findings.map((finding) => `- **${finding.ruleId}** (${finding.severity}), line ${finding.location.startLine}: ${markdownText(finding.message)}`
      + `${finding.evidence === '' ? '' : ` Evidence: ${markdownCode(finding.evidence)}.`}${finding.fix === '' ? '' : ` Fix: ${markdownText(finding.fix)}`}`),
    '', '</details>']);

  const build = (tableRows: string[], more: string[]): string => [...head, ...(tableRows.length > 0 ? [...tableHead, ...tableRows] : []), ...unreadLine, ...more, '', FOOTER].join('\n') + '\n';
  const full = build(rows, details);
  if (full.length <= MARKDOWN_LIMIT) return full;

  // Too long for a comment: the table stays and the details go. If the table alone is too long, its last rows go too.
  const pointer = `Full report in the job artifact ${markdownCode(options.reportPath ?? '.qa-core/review/report.json')}.`;
  let kept = rows.length;
  let short = build(rows, ['', pointer]);
  while (short.length > MARKDOWN_LIMIT && kept > 0) {
    // Drop enough rows to cover what is over the limit, then check again.
    let over = short.length - MARKDOWN_LIMIT;
    while (over > 0 && kept > 0) {
      kept -= 1;
      over -= rows[kept]!.length + 1;
    }
    short = build(rows.slice(0, kept), ['', `${plural(rows.length - kept, 'more test is', 'more tests are')} not shown here.`, '', pointer]);
  }
  return short;
}
