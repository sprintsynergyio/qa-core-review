// Capability gating (SPEC.md Section 7.3).
//
// A rule runs on a file only when the file has every capability the rule requires and the
// rule applies to the file's language and frameworks. A rule that does not run is reported as
// skipped, with the reason, so a missing fact never turns into a false finding.
import type { Capability, NFile } from '../model/types.js';
import type { Rule, SkippedRule } from '../rules/types.js';

/** The capabilities the rule requires that this file does not have. */
export function missingCapabilities(rule: Rule, file: NFile): Capability[] {
  return rule.requires.filter((capability) => !file.capabilities.includes(capability));
}

function quoted(values: readonly string[]): string {
  return values.map((value) => `"${value}"`).join(', ');
}

/** Why the rule cannot run on this file, or null when it can. */
export function skipReason(rule: Rule, file: NFile): string | null {
  const languages = rule.appliesTo?.languages;
  if (languages && !languages.includes(file.language)) {
    return `does not apply to language "${file.language}"`;
  }

  const frameworks = rule.appliesTo?.frameworks;
  if (frameworks) {
    const used = [file.runner, ...file.libraries];
    if (!used.some((framework) => frameworks.includes(framework))) {
      return `does not apply to ${used.length === 1 ? 'framework' : 'frameworks'} ${quoted(used)}`;
    }
  }

  const missing = missingCapabilities(rule, file);
  if (missing.length > 0) {
    const partly = file.parseStatus === 'partial' ? ' (the file was only partly parsed)' : '';
    return `needs ${missing.length === 1 ? 'a capability' : 'capabilities'} this file does not have: ${missing.join(', ')}${partly}`;
  }
  return null;
}

export interface RuleSelection {
  /** Rules to run on the file, in the order given. */
  run: Rule[];
  /** Rules that will not run, for `FileResult.rulesSkipped`. */
  skipped: SkippedRule[];
}

/** Splits the rules into those that can run on the file and those that are skipped. */
export function selectRules(rules: readonly Rule[], file: NFile): RuleSelection {
  const selection: RuleSelection = { run: [], skipped: [] };
  for (const rule of rules) {
    const reason = skipReason(rule, file);
    if (reason === null) selection.run.push(rule);
    else selection.skipped.push({ ruleId: rule.id, reason });
  }
  return selection;
}
