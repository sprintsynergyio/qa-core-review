// Rules, findings and the report (SPEC.md Sections 7.3 and 8.2).
// `schemas/report.schema.json` will mirror the report types from Milestone 5.
import type { ResolvedConfig } from '../config/types.js';
import type { Capability, FrameworkId, LanguageId, Modifier, NFile, NTest, ParseStatus, Span, Tier } from '../model/types.js';

export type Severity = 'error' | 'warn' | 'info';
export type Source = 'static' | 'llm';
export type Confidence = 'high' | 'medium' | 'low';
/** Per test: 'fail' if any error, 'review' if any warn, else 'pass'. Info does not lower it. */
export type Verdict = 'pass' | 'review' | 'fail';
/** Set by the reviewer in the UI. */
export type Decision = 'pending' | 'approved' | 'rejected';

export interface Location extends Span {
  file: string;
}

export interface Finding {
  /** Fingerprint. It has no line numbers in it, so a UI decision survives edits above the test. */
  id: string;
  /** 'QCR-A001' */
  ruleId: string;
  /** 'no-assertion' */
  ruleName: string;
  severity: Severity;
  source: Source;
  /** One sentence, plain English: what is wrong. */
  message: string;
  /** The exact code or fact that triggered the finding, at most 200 characters. */
  evidence: string;
  /** One or two sentences: what to do instead, in the file's own language and framework. */
  fix: string;
  /** A short code snippet in the file's language. */
  goodExample?: string;
  location: Location;
  /** NTest.id, or null for a file-level finding. */
  testId: string | null;
  confidence: Confidence;
  suppressed: boolean;
  docsUrl: string;
}

/**
 * What a rule returns. The engine adds the rule id and name, the file, the fingerprint, the
 * docs link and the default severity, fix text and confidence when the rule leaves them out.
 */
export interface FindingDraft {
  message: string;
  evidence: string;
  span: Span;
  /** NTest.id, or null for a file-level finding. */
  testId: string | null;
  severity?: Severity;
  confidence?: Confidence;
  fix?: string;
  goodExample?: string;
}

export interface RuleContext {
  file: NFile;
  /** Set when the engine calls the rule once per test. */
  test?: NTest;
  /** Every file in the run, for rules that compare files (duplicates). */
  all: NFile[];
  config: ResolvedConfig;
  /** This rule's own options from the config. */
  options: Record<string, unknown>;
}

export interface Rule {
  /** 'QCR-A001'. Stable forever. */
  id: string;
  /** 'no-assertion' */
  name: string;
  defaultSeverity: Severity;
  scope: 'universal' | 'framework';
  /** When set, the rule only runs for these languages or frameworks. */
  appliesTo?: { languages?: LanguageId[]; frameworks?: FrameworkId[] };
  /** The rule runs only on files that have every one of these. */
  requires: Capability[];
  description: string;
  /** Reads only the normalized model. Never a syntax tree, never an adapter. */
  check(ctx: RuleContext): FindingDraft[];
}

export interface SkippedRule {
  ruleId: string;
  reason: string;
}

export interface TestResult {
  id: string;
  title: string;
  fullTitle: string;
  location: Location;
  bodyLocation: Location;
  modifiers: Modifier[];
  assertionCount: number;
  verdict: Verdict;
  findingIds: string[];
}

export interface FileResult {
  file: string;
  language: LanguageId;
  languageHint: string | null;
  adapter: string;
  tier: Tier;
  runner: FrameworkId;
  libraries: FrameworkId[];
  parseStatus: ParseStatus;
  /** Rules that did not run on this file, and why. */
  rulesSkipped: SkippedRule[];
  tests: TestResult[];
}

export interface Report {
  schemaVersion: 2;
  tool: { name: 'qa-core-review'; version: string };
  /** ISO 8601 UTC. */
  createdAt: string;
  /** Absolute path, for display only. */
  root: string;
  mode: { diffBase: string | null; llm: 'off' | 'anthropic' | 'openai' | 'claude-code' };
  projects: Array<{ dir: string; adapter: string; frameworks: FrameworkId[] }>;
  rulesRun: string[];
  files: FileResult[];
  /** Sorted by file, then start line, then rule id. */
  findings: Finding[];
  summary: {
    files: number;
    tests: number;
    pass: number;
    review: number;
    fail: number;
    errors: number;
    warnings: number;
    infos: number;
    suppressed: number;
    byLanguage: Record<string, { files: number; tests: number; errors: number; warnings: number }>;
    llmOnlyFiles: number;
  };
}
