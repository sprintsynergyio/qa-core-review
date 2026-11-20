// The config after loading: every key from SPEC.md Section 12.2, with defaults filled in.
// `schemas/config.schema.json` describes the file a user writes; this is what the code reads.
import type { FrameworkId, LanguageId } from '../model/types.js';
import type { Severity } from '../rules/types.js';

/** One entry under `rules` after loading: "off", or a severity plus rule-specific options. */
export interface RuleSetting {
  enabled: boolean;
  /** Set when the config overrides the rule's default severity. */
  severity?: Severity;
  /** Limit the rule to some languages. */
  languages?: LanguageId[];
  /** Rule-specific options, for example `maxMs` for QCR-W001. */
  options: Record<string, unknown>;
}

/** Overrides detection for the files under `path`. */
export interface ProjectOverride {
  path: string;
  language?: LanguageId;
  runner?: FrameworkId;
  libraries?: FrameworkId[];
  include?: string[];
  exclude?: string[];
}

/** Regex strings for the generic adapter's optional static checks. Validated when the config loads. */
export interface GenericPatterns {
  testPattern?: string;
  assertionPattern?: string;
  sleepPattern?: string;
  skipPattern?: string;
  focusPattern?: string;
}

/** Files for the generic adapter (Tier 3). `language` is a free hint such as 'scala'. */
export interface GenericEntry {
  glob: string;
  language: string;
  framework?: string;
  patterns?: GenericPatterns;
}

export interface ConfigSuppression {
  file: string;
  rules: string[];
  test?: string;
  reason: string;
}

export type FailOn = 'error' | 'warn' | 'info' | 'never';
export type LlmMode = 'off' | 'anthropic' | 'openai' | 'claude-code';
export type OutputFormat = 'pretty' | 'json' | 'sarif' | 'markdown' | 'junit';

export interface ResolvedConfig {
  /** Null means the default include globs of every detected adapter. A list replaces them all. */
  include: string[] | null;
  /** A list in the config replaces the default list. */
  exclude: string[];
  languages: 'auto' | LanguageId[];
  framework: 'auto' | FrameworkId;
  projects: ProjectOverride[];
  generic: GenericEntry[];
  failOn: FailOn;
  /** Attribute that marks test ids, for selector rules. */
  testIdAttribute: string;
  /** Extra function names that count as assertions. */
  assertionHelpers: string[];
  suppressions: ConfigSuppression[];
  /** Keyed by rule id, for example 'QCR-W001'. */
  rules: Record<string, RuleSetting>;
  /** Adapter-specific options, keyed by adapter id. */
  adapters: Record<string, Record<string, unknown>>;
  llm: {
    mode: LlmMode;
    model: string | null;
    includeSubject: boolean;
    includeLlmOnlyFiles: boolean;
    allowErrors: boolean;
    maxFilesPerRun: number;
    maxCharsPerFile: number;
    redact: boolean;
    timeoutMs: number;
  };
  claude: { stopGate: 'off' | 'report' | 'ui' };
  ui: { port: number; open: boolean };
  output: { dir: string; formats: OutputFormat[] };
}
