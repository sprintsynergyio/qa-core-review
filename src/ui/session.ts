// The review session of the local review page (SPEC.md Sections 8.4 and 13.2): what the reviewer
// decided for each test, saved to `.qa-core/review/session.json` on every change so a page
// refresh or a new run keeps it.
import fs from 'node:fs';
import path from 'node:path';
import type { Decision, Finding, Report } from '../rules/types.js';

export const DECISIONS: readonly Decision[] = ['pending', 'approved', 'rejected'];
export type Outcome = 'approved' | 'changes-requested';

export interface ReviewSession {
  schemaVersion: 1;
  reportCreatedAt: string;
  /** By the id of a test, or of the item that stands for a whole file (`fileItemId`). */
  tests: Record<string, { decision: Decision; comment: string; findings: Record<string, { dismissed: boolean; comment: string }> }>;
  generalComment: string;
  finishedAt: string | null;
  outcome: Outcome | null;
}

/** One thing the reviewer decides on: a test, or a whole file. */
export interface ReviewItem {
  id: string;
  kind: 'test' | 'file';
  file: string;
  /** The findings shown with the item. Suppressed findings are left out. */
  findings: Finding[];
}

/** The longest comment that is kept. A longer one is cut. */
export const MAX_COMMENT_LENGTH = 10_000;

/** The id of the item that stands for a whole file. No test id has a colon after the word `file`. */
export const fileItemId = (file: string): string => `file:${file}`;

/**
 * The items of a report, in its order: every test, and one item for each file that has findings
 * outside any test (a file with no test in it, a mock at the top of a file) or that is listed
 * with no test boundaries (`parseStatus: 'llm-only'`).
 */
export function reviewItems(report: Report): ReviewItem[] {
  const open = report.findings.filter((finding) => !finding.suppressed);
  const items: ReviewItem[] = [];
  const files = [...new Set([...report.files.map((file) => file.file), ...open.map((finding) => finding.location.file)])];
  for (const file of files) {
    const result = report.files.find((candidate) => candidate.file === file);
    for (const test of result?.tests ?? []) items.push({ id: test.id, kind: 'test', file, findings: open.filter((finding) => finding.testId === test.id) });
    const whole = open.filter((finding) => finding.testId === null && finding.location.file === file);
    if (whole.length > 0 || (result?.parseStatus === 'llm-only' && result.tests.length === 0)) items.push({ id: fileItemId(file), kind: 'file', file, findings: whole });
  }
  return items;
}

/** A session with nothing decided yet. */
export function newSession(report: Report): ReviewSession {
  const tests: ReviewSession['tests'] = {};
  for (const item of reviewItems(report)) {
    tests[item.id] = { decision: 'pending', comment: '', findings: Object.fromEntries(item.findings.map((finding) => [finding.id, { dismissed: false, comment: '' }])) };
  }
  return { schemaVersion: 1, reportCreatedAt: report.createdAt, tests, generalComment: '', finishedAt: null, outcome: null };
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): string => (typeof value === 'string' ? value.slice(0, MAX_COMMENT_LENGTH) : '');
const isDecision = (value: unknown): value is Decision => (DECISIONS as readonly unknown[]).includes(value);

/**
 * A session for this report that keeps what an earlier session decided. Decisions are found
 * again by test id and finding id, which do not change when lines move. Ids that the report no
 * longer has are dropped, and so is anything in the saved data that does not have the right shape.
 */
export function restoreSession(report: Report, saved: unknown): ReviewSession {
  const session = newSession(report);
  if (!isRecord(saved) || saved.schemaVersion !== 1 || !isRecord(saved.tests)) return session;
  session.generalComment = text(saved.generalComment);
  for (const [id, entry] of Object.entries(session.tests)) {
    const earlier = saved.tests[id];
    if (!isRecord(earlier)) continue;
    if (isDecision(earlier.decision)) entry.decision = earlier.decision;
    entry.comment = text(earlier.comment);
    for (const [findingId, finding] of Object.entries(entry.findings)) {
      const before = isRecord(earlier.findings) ? earlier.findings[findingId] : undefined;
      if (isRecord(before)) Object.assign(finding, { dismissed: before.dismissed === true, comment: text(before.comment) });
    }
  }
  return session;
}

/** Reads the session file of an earlier run, if there is one, and fits it to this report. */
export function loadSession(file: string, report: Report): ReviewSession {
  let saved: unknown = null;
  try {
    saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    // No session yet, or a file that is not JSON: start fresh.
  }
  return restoreSession(report, saved);
}

/** Writes the session. The file is replaced in one step, so a crash never leaves half a file. */
export function saveSession(file: string, session: ReviewSession): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const draft = `${file}.tmp`;
  fs.writeFileSync(draft, `${JSON.stringify(session, null, 2)}\n`);
  fs.renameSync(draft, file);
}

/** Applies `{ decision?, comment? }` to a test. Returns what is wrong with the request, or null. */
export function updateTest(session: ReviewSession, testId: string, change: unknown): string | null {
  const entry = Object.hasOwn(session.tests, testId) ? session.tests[testId]! : null;
  if (!entry) return `unknown test id: ${testId}`;
  if (!isRecord(change)) return 'the body must be an object';
  if (change.decision !== undefined && !isDecision(change.decision)) return `decision must be one of: ${DECISIONS.join(', ')}`;
  if (change.comment !== undefined && typeof change.comment !== 'string') return 'comment must be a string';
  if (change.decision !== undefined) entry.decision = change.decision;
  if (change.comment !== undefined) entry.comment = text(change.comment);
  return null;
}

/** Applies `{ testId, dismissed?, comment? }` to a finding of a test. */
export function updateFinding(session: ReviewSession, findingId: string, change: unknown): string | null {
  if (!isRecord(change)) return 'the body must be an object';
  const owner = typeof change.testId === 'string' && Object.hasOwn(session.tests, change.testId) ? session.tests[change.testId]! : null;
  const entry = owner && Object.hasOwn(owner.findings, findingId) ? owner.findings[findingId]! : null;
  if (!entry) return `unknown finding id for this test: ${findingId}`;
  if (change.dismissed !== undefined && typeof change.dismissed !== 'boolean') return 'dismissed must be true or false';
  if (change.comment !== undefined && typeof change.comment !== 'string') return 'comment must be a string';
  if (change.dismissed !== undefined) entry.dismissed = change.dismissed;
  if (change.comment !== undefined) entry.comment = text(change.comment);
  return null;
}

/** Applies `{ comment }` as the general comment. */
export function updateGeneral(session: ReviewSession, change: unknown): string | null {
  if (!isRecord(change) || typeof change.comment !== 'string') return 'comment must be a string';
  session.generalComment = text(change.comment);
  return null;
}

/**
 * The outcome rule (SPEC.md Section 13.3): changes are requested when a test is rejected, or
 * when a test that is not approved still has an error finding that is not dismissed.
 */
export function outcomeOf(report: Report, session: ReviewSession): Outcome {
  for (const item of reviewItems(report)) {
    const entry = session.tests[item.id];
    if (entry?.decision === 'rejected') return 'changes-requested';
    if (entry?.decision !== 'approved' && item.findings.some((finding) => finding.severity === 'error' && entry?.findings[finding.id]?.dismissed !== true)) return 'changes-requested';
  }
  return 'approved';
}
