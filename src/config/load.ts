// Finds, reads, checks and resolves the config (SPEC.md Section 12).
//
// Config is JSON or YAML only, so loading it never runs code. A problem in the file is a
// ConfigError that names the file, the JSON pointer of the value and what is wrong with it.
import fs from 'node:fs';
import path from 'node:path';
import { readAssetText } from '../assets.js';
import type { LanguageId } from '../model/types.js';
import { toLf } from '../parse/positions.js';
import type { Severity } from '../rules/types.js';
import { defaultConfigFile } from './defaults.js';
import type { GenericEntry, ResolvedConfig, RuleSetting } from './types.js';
import { validateSchema } from './validate.js';
import type { SchemaProblem } from './validate.js';
import { parseYaml } from './yaml.js';

/** Searched in this order in each folder. A "qa-core-review" key in package.json comes last. */
export const CONFIG_FILE_NAMES = [
  'qa-core-review.config.json',
  'qa-core-review.config.yaml',
  'qa-core-review.config.yml',
  '.qa-core-review.json',
  '.qa-core-review.yaml',
] as const;
export const PACKAGE_JSON_KEY = 'qa-core-review';

/** A config file that cannot be used. The CLI prints `message` and exits 2. */
export class ConfigError extends Error {
  readonly file: string;
  readonly problems: SchemaProblem[];

  constructor(file: string, problems: SchemaProblem[]) {
    const lines = problems.map((problem) => `  ${problem.pointer === '' ? '/' : problem.pointer}: ${problem.message}`);
    super(`Invalid config: ${file}\n${lines.join('\n')}`);
    this.name = 'ConfigError';
    this.file = file;
    this.problems = problems;
  }
}

export interface LoadConfigOptions {
  /** The project root (`--root`). */
  root: string;
  /** An explicit config file (`--config`), absolute or relative to `root`. */
  configPath?: string;
  /** When given, a rule id in the config that is not in this list gives a warning. */
  knownRuleIds?: readonly string[];
}

export interface LoadedConfig {
  config: ResolvedConfig;
  /** The absolute path of the file the config came from, or null when defaults were used. */
  file: string | null;
  warnings: string[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The folders to search: `root`, then each parent up to the git root. Only `root` outside git. */
function searchFolders(root: string): string[] {
  const chain: string[] = [];
  for (let dir = path.resolve(root); ; dir = path.dirname(dir)) {
    chain.push(dir);
    if (fs.existsSync(path.join(dir, '.git'))) return chain;
    if (path.dirname(dir) === dir) return [chain[0]!];
  }
}

function readPackageKey(file: string): unknown {
  try {
    const pkg: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
    return isObject(pkg) ? pkg[PACKAGE_JSON_KEY] : undefined;
  } catch {
    return undefined; // a package.json that cannot be read is not our config
  }
}

/** The first config file found from `root` upward to the git root, or null. */
export function findConfigFile(root: string): string | null {
  for (const dir of searchFolders(root)) {
    for (const name of CONFIG_FILE_NAMES) {
      const file = path.join(dir, name);
      if (fs.existsSync(file)) return file;
    }
    const pkg = path.join(dir, 'package.json');
    if (fs.existsSync(pkg) && readPackageKey(pkg) !== undefined) return pkg;
  }
  return null;
}

/** Reads a config file into plain data. `shown` is the name used in error messages. */
function readConfigFile(file: string, shown: string): unknown {
  let text: string;
  try {
    text = toLf(fs.readFileSync(file, 'utf8'));
  } catch {
    throw new ConfigError(shown, [{ pointer: '', message: 'the config file was not found or cannot be read' }]);
  }
  const base = path.basename(file).toLowerCase();
  try {
    if (base === 'package.json') {
      const pkg: unknown = JSON.parse(text);
      const value = isObject(pkg) ? pkg[PACKAGE_JSON_KEY] : undefined;
      if (value === undefined) throw new Error(`package.json has no "${PACKAGE_JSON_KEY}" key`);
      return value;
    }
    if (base.endsWith('.json')) return JSON.parse(text);
    if (base.endsWith('.yaml') || base.endsWith('.yml')) return parseYaml(text);
  } catch (error) {
    const kind = base.endsWith('.json') ? 'JSON' : 'YAML';
    // The JSON parser puts a piece of the file, with its line breaks, in the message.
    const detail = (error as Error).message.replace(/\s+/g, ' ').replace(/ is not valid JSON$/, '');
    throw new ConfigError(shown, [{ pointer: '', message: `not valid ${kind}: ${detail}` }]);
  }
  throw new ConfigError(shown, [{ pointer: '', message: 'a config file must end in .json, .yaml or .yml' }]);
}

let schema: object | null = null;

/** The regex strings in the config must compile. The schema cannot check that. */
function regexProblems(generic: GenericEntry[]): SchemaProblem[] {
  const problems: SchemaProblem[] = [];
  generic.forEach((entry, index) => {
    for (const [key, source] of Object.entries(entry.patterns ?? {})) {
      try {
        new RegExp(source as string);
      } catch (error) {
        problems.push({ pointer: `/generic/${index}/patterns/${key}`, message: `not a valid regular expression: ${(error as Error).message}` });
      }
    }
  });
  return problems;
}

/** "off", a severity, or an object with options, merged over the default for that rule. */
function resolveRule(user: unknown, base: RuleSetting | undefined): RuleSetting {
  const setting: RuleSetting = { enabled: true, ...base, options: { ...base?.options } };
  if (user === 'off') setting.enabled = false;
  else if (typeof user === 'string') setting.severity = user as Severity;
  else if (isObject(user)) {
    const { severity, languages, ...options } = user;
    if (severity !== undefined) setting.severity = severity as Severity;
    if (languages !== undefined) setting.languages = languages as LanguageId[];
    Object.assign(setting.options, options);
  }
  return setting;
}

/**
 * Checks the content of a config file and fills in the defaults. Top-level lists and plain
 * values in the file replace the default. The `llm`, `claude`, `ui` and `output` objects, each
 * rule and each adapter are merged key by key.
 */
export function resolveConfig(raw: unknown, shown = 'config', knownRuleIds?: readonly string[]): { config: ResolvedConfig; warnings: string[] } {
  schema ??= JSON.parse(readAssetText('schemas/config.schema.json')) as object;
  const problems = validateSchema(raw, schema);
  if (problems.length === 0) problems.push(...regexProblems(((raw as { generic?: GenericEntry[] }).generic ?? [])));
  if (problems.length > 0) throw new ConfigError(shown, problems);

  const user = raw as Record<string, unknown>;
  const defaults = defaultConfigFile();
  const merged: Record<string, unknown> = { ...defaults };
  for (const [key, value] of Object.entries(user)) {
    if (key === '$schema' || key === 'rules') continue;
    const isSection = isObject(value) && isObject(defaults[key]);
    merged[key] = isSection ? { ...(defaults[key] as object), ...value } : value;
  }

  const rules: Record<string, RuleSetting> = {};
  for (const [id, setting] of Object.entries(defaults.rules as Record<string, unknown>)) rules[id] = resolveRule(setting, undefined);
  for (const [id, setting] of Object.entries((user.rules ?? {}) as Record<string, unknown>)) rules[id] = resolveRule(setting, rules[id]);
  merged.rules = rules;

  const warnings = knownRuleIds
    ? Object.keys((user.rules ?? {}) as object)
        .filter((id) => !knownRuleIds.includes(id))
        .map((id) => `${shown}: unknown rule id "${id}" under "rules" is ignored`)
    : [];
  return { config: merged as unknown as ResolvedConfig, warnings };
}

/** Loads the config for a project: an explicit file, the first one found, or the defaults. */
export function loadConfig(options: LoadConfigOptions): LoadedConfig {
  const root = path.resolve(options.root);
  const file = options.configPath ? path.resolve(root, options.configPath) : findConfigFile(root);
  if (file === null) return { ...resolveConfig({}, 'defaults', options.knownRuleIds), file: null };

  // Show the path the way the user would type it: relative to the root, with '/'.
  const relative = path.relative(root, file).split(path.sep).join('/');
  const shown = relative.startsWith('..') || path.isAbsolute(relative) ? file.split(path.sep).join('/') : relative;
  return { ...resolveConfig(readConfigFile(file, shown), shown, options.knownRuleIds), file };
}
