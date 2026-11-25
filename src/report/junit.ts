// The JUnit XML report (SPEC.md Section 11.7), for CI systems that show test results natively.
// Every reviewed test is a test case. A finding at or above the --fail-on level is a failure.
import type { FailOn } from '../config/types.js';
import type { Finding, Report, Severity } from '../rules/types.js';
import { entriesOf, titleOf } from './entries.js';

const RANK: Readonly<Record<Severity, number>> = { info: 1, warn: 2, error: 3 };
/** Characters that XML 1.0 does not allow, lone halves of a surrogate pair included. */
const INVALID_XML = /[^\t\n\r -퟿-�\u{10000}-\u{10FFFF}]/gu;

/** Text between tags. */
export function xmlText(value: string): string {
  return value.replace(INVALID_XML, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r/g, '&#13;');
}

/** An attribute value. Line breaks and tabs are written as references, or a reader would turn them into spaces. */
export function xmlAttribute(value: string): string {
  return xmlText(value).replace(/"/g, '&quot;').replace(/\n/g, '&#10;').replace(/\t/g, '&#9;');
}

const attributes = (pairs: Record<string, string | number>): string => Object.entries(pairs).map(([name, value]) => ` ${name}="${xmlAttribute(String(value))}"`).join('');

/** 'tests/cart.spec.ts' gives 'tests.cart.spec'. */
const classNameOf = (file: string): string => file.replace(/\.[^./]*$/, '').split('/').join('.');

function details(finding: Finding): string {
  const { location } = finding;
  return [`${location.file}:${location.startLine}:${location.startColumn}`, ...(finding.evidence === '' ? [] : [`Evidence: ${finding.evidence}`]), ...(finding.fix === '' ? [] : [`Fix: ${finding.fix}`]), `Docs: ${finding.docsUrl}`].join('\n');
}

export function formatJunit(report: Report, failOn: FailOn): string {
  const fails = (finding: Finding): boolean => failOn !== 'never' && RANK[finding.severity] >= RANK[failOn];
  const suites: string[] = [];
  let tests = 0;
  let failures = 0;
  for (const file of report.files) {
    const cases: string[] = [];
    let failed = 0;
    let skipped = 0;
    const entries = entriesOf(report, file);
    // A file with no static adapter and nothing else to say: one skipped case, so that the file is seen.
    const noAdapter = file.parseStatus === 'llm-only' && entries.every((entry) => entry.findings.every((finding) => finding.ruleId === 'QCR-X003'));
    if (noAdapter) {
      skipped = 1;
      cases.push(`    <testcase${attributes({ name: '(file)', classname: classNameOf(file.file), file: file.file, line: 1, time: 0 })}>\n      <skipped message="No static adapter"/>\n    </testcase>`);
    }
    for (const entry of noAdapter ? [] : entries) {
      const failing = entry.findings.filter(fails);
      const notes = entry.findings.filter((finding) => !fails(finding));
      if (failing.length > 0) failed += 1;
      const inner = [
        ...failing.map((finding) => `      <failure${attributes({ type: finding.ruleId, message: finding.message })}>${xmlText(details(finding))}</failure>`),
        ...(notes.length > 0 ? [`      <system-out>${xmlText(notes.map((finding) => `${finding.ruleId} ${finding.severity}: ${finding.message}\n${details(finding)}`).join('\n\n'))}</system-out>`] : []),
      ];
      const open = `    <testcase${attributes({ name: titleOf(entry), classname: classNameOf(file.file), file: file.file, line: entry.line, time: 0 })}`;
      cases.push(inner.length === 0 ? `${open}/>` : `${open}>\n${inner.join('\n')}\n    </testcase>`);
    }
    tests += cases.length;
    failures += failed;
    const open = `  <testsuite${attributes({ name: file.file, tests: cases.length, failures: failed, errors: 0, skipped, time: 0 })}`;
    suites.push(cases.length === 0 ? `${open}/>` : `${open}>\n${cases.join('\n')}\n  </testsuite>`);
  }
  const root = `<testsuites${attributes({ name: 'qa-core-review', tests, failures, time: 0 })}`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n${suites.length === 0 ? `${root}/>` : `${root}>\n${suites.join('\n')}\n</testsuites>`}\n`;
}
