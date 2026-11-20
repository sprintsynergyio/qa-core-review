// The part of the resolved config that adapters and rules read.
// Milestone 3 adds config loading and the rest of the keys from SPEC.md Section 12.
import type { LanguageId } from '../model/types.js';
import type { Severity } from '../rules/types.js';

/** One entry under `rules` after loading: "off", or a severity plus rule-specific options. */
export interface RuleSetting {
  enabled: boolean;
  severity?: Severity;
  /** Limit the rule to some languages. */
  languages?: LanguageId[];
  options: Record<string, unknown>;
}

export interface ResolvedConfig {
  /** Attribute that marks test ids, for selector rules. Default `data-testid`. */
  testIdAttribute: string;
  /** Extra function names that count as assertions. */
  assertionHelpers: string[];
  /** Keyed by rule id, for example 'QCR-W001'. */
  rules: Record<string, RuleSetting>;
  /** Adapter-specific options, keyed by adapter id. */
  adapters: Record<string, Record<string, unknown>>;
}
