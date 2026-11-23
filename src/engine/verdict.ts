// Verdicts and the exit code (SPEC.md Sections 8.2 and 11.3). Suppressed findings count for
// neither.
import type { FailOn } from '../config/types.js';
import type { Finding, Severity, Verdict } from '../rules/types.js';

const RANK: Readonly<Record<Severity, number>> = { info: 1, warn: 2, error: 3 };

/** 'fail' with any error, 'review' with any warning, else 'pass'. Info does not lower a verdict. */
export function verdictOf(findings: readonly Finding[]): Verdict {
  const open = findings.filter((finding) => !finding.suppressed);
  if (open.some((finding) => finding.severity === 'error')) return 'fail';
  return open.some((finding) => finding.severity === 'warn') ? 'review' : 'pass';
}

/** True when a finding that is not suppressed is at or above the level. 'never' never fails. */
export function failsAt(findings: readonly Finding[], failOn: FailOn): boolean {
  return failOn !== 'never' && findings.some((finding) => !finding.suppressed && RANK[finding.severity] >= RANK[failOn]);
}
