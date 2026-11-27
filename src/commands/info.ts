// The commands that describe the tool itself (SPEC.md Section 11.1): `rules`, `explain` and
// `adapters`. They read no project files.
import { builtinProfiles, createRegistry } from '../adapters/index.js';
import { LANGUAGE_IDS, type LanguageId } from '../model/types.js';
import { languageName } from '../model/languages.js';
import { examplesFor } from '../rules/fix-text.js';
import { builtinRules, docsUrlFor } from '../rules/index.js';
import type { Rule } from '../rules/types.js';
import { choiceFlag, parse, UsageError } from './args.js';

export const RULES_USAGE = `Usage: qa-core-review rules [--language <id>]

Lists the rules with their default severity, scope and a one-line description.

Flags:
  --language <id>   Only the rules that apply to this language, for example typescript.
  --help, -h        Print this help.
`;

export const EXPLAIN_USAGE = `Usage: qa-core-review explain <ruleId> [--language <id>]

Prints what a rule looks for, with a bad and a good example, what it needs from a file,
and where it is documented.

Flags:
  --language <id>   Show the examples in this language. Default: typescript.
  --help, -h        Print this help.
`;

export const ADAPTERS_USAGE = `Usage: qa-core-review adapters

Lists the language adapters with their tier, languages, frameworks and capabilities.

Flags:
  --help, -h        Print this help.
`;

const appliesTo = (rule: Rule, language: LanguageId | undefined): boolean => language === undefined || !rule.appliesTo?.languages || rule.appliesTo.languages.includes(language);
/** Rows as columns padded to the widest cell. The last column is not padded. */
function table(rows: string[][]): string {
  const widths = rows[0]!.map((_, column) => Math.max(...rows.map((row) => row[column]!.length)));
  return rows.map((row) => row.map((cell, column) => (column === row.length - 1 ? cell : cell.padEnd(widths[column]!))).join('  ').trimEnd()).join('\n');
}

export function rules(argv: string[]): number {
  const { values, positionals } = parse(argv, ['help', 'language']);
  if (values.help) return process.stdout.write(RULES_USAGE), 0;
  if (positionals.length > 0) throw new UsageError(`rules takes no arguments (got "${positionals[0]}")`);
  const language = choiceFlag('language', values.language, LANGUAGE_IDS);
  const listed = builtinRules.filter((rule) => appliesTo(rule, language));
  const rows = [['Id', 'Name', 'Severity', 'Scope', 'Description'], ...listed.map((rule) => [rule.id, rule.name, rule.defaultSeverity, rule.scope, rule.description])];
  process.stdout.write(`${table(rows)}\n\n${listed.length} ${listed.length === 1 ? 'rule' : 'rules'}${language ? ` for ${languageName(language)}` : ''}. Run qa-core-review explain <ruleId> for more.\n`);
  return 0;
}

export function explain(argv: string[]): number {
  const { values, positionals } = parse(argv, ['help', 'language']);
  if (values.help) return process.stdout.write(EXPLAIN_USAGE), 0;
  const known = builtinRules.map((rule) => rule.id).join(', ');
  if (positionals.length !== 1) throw new UsageError(`explain needs one rule id. Known: ${known}`);
  const rule = builtinRules.find((candidate) => candidate.id.toLowerCase() === positionals[0]!.toLowerCase());
  if (!rule) throw new UsageError(`unknown rule id "${positionals[0]}". Known: ${known}`);
  const language = choiceFlag('language', values.language, LANGUAGE_IDS);
  const lines = [
    `${rule.id}  ${rule.name}`, '', rule.description, '',
    `Default severity: ${rule.defaultSeverity}`,
    `Scope: ${rule.scope}`,
    `Languages: ${rule.appliesTo?.languages ? rule.appliesTo.languages.map(languageName).join(', ') : 'all'}`,
    ...(rule.appliesTo?.frameworks ? [`Frameworks: ${rule.appliesTo.frameworks.join(', ')}`] : []),
    `Needs from the file: ${rule.requires.length > 0 ? rule.requires.join(', ') : 'nothing'}`,
    ...(language ? [`${languageName(language)}: ${appliesTo(rule, language) ? 'the rule applies' : 'the rule does not apply'}`] : []),
    `Turn it off: "rules": { "${rule.id}": "off" } in the config, or --disable ${rule.id}`,
    `Docs: ${docsUrlFor(rule.id)}`,
  ];
  // The sub-cases of the rule, each with its fix and, when there is one for the language, a bad and a good example.
  const indent = (code: string): string => code.split('\n').map((line) => `    ${line}`).join('\n');
  for (const { title, fix, example } of examplesFor(rule.id, language ?? 'typescript')) {
    lines.push('', title, `  Fix: ${fix}`);
    if (example) lines.push('  Bad:', indent(example.bad), '  Good:', indent(example.good));
    else lines.push(`  No example for ${languageName(language ?? 'typescript')} yet.`);
  }
  process.stdout.write(`${lines.join('\n')}\n`);
  return 0;
}

export function adapters(argv: string[]): number {
  const { values, positionals } = parse(argv, ['help']);
  if (values.help) return process.stdout.write(ADAPTERS_USAGE), 0;
  if (positionals.length > 0) throw new UsageError(`adapters takes no arguments (got "${positionals[0]}")`);
  const registry = createRegistry();
  const blocks = builtinProfiles.map((profile) => {
    const capabilities = registry.get(profile.id)?.capabilities;
    const frameworks = profile.frameworks.map((framework) => framework.id);
    return [
      `${profile.id}  Tier ${profile.tier}`,
      `  Languages: ${profile.languages.map(languageName).join(', ')}`,
      `  Frameworks: ${frameworks.length > 0 ? frameworks.join(', ') : 'none'}`,
      `  Extensions: ${profile.extensions.length > 0 ? profile.extensions.join(' ') : 'any file no other adapter knows'}`,
      // Detection works for every adapter. Reading test files needs the full adapter.
      // A Tier 3 file is listed for the LLM review. It has these capabilities only when the config gives line patterns for it.
      `  Capabilities: ${capabilities ? `${capabilities.join(', ')}${profile.tier === 3 ? ' (only with line patterns in the config, see docs/languages.md)' : ''}` : 'none yet (this build only detects these projects)'}`,
    ].join('\n');
  });
  process.stdout.write(`${blocks.join('\n\n')}\n`);
  return 0;
}
