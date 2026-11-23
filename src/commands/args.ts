// Shared pieces of the command line: the flags every command picks from, strict parsing, and
// the error for a mistake in how the tool was called (SPEC.md Sections 11.2 and 11.3).
import { parseArgs } from 'node:util';

/** A mistake in how the tool was called. Printed on one line with a pointer to --help. Exit 2. */
export class UsageError extends Error {}

export const OPTIONS = {
  version: { type: 'boolean', short: 'v' },
  help: { type: 'boolean', short: 'h' },
  format: { type: 'string' },
  root: { type: 'string' },
  config: { type: 'string' },
  output: { type: 'string' },
  stdout: { type: 'string' },
  'fail-on': { type: 'string' },
  rules: { type: 'string' },
  disable: { type: 'string' },
  language: { type: 'string' },
  framework: { type: 'string' },
  'dump-model': { type: 'boolean' },
  'max-findings': { type: 'string' },
  'no-color': { type: 'boolean' },
  quiet: { type: 'boolean' },
  force: { type: 'boolean' },
} as const;

export type OptionName = keyof typeof OPTIONS;

/** Parses with only the named flags allowed. An unknown flag is a usage error. */
export function parse(argv: string[], names: readonly OptionName[]): { values: Partial<Record<OptionName, string | boolean>>; positionals: string[] } {
  try {
    return parseArgs({ args: argv, options: Object.fromEntries(names.map((name) => [name, OPTIONS[name]])), allowPositionals: true, strict: true });
  } catch (error) {
    // parseArgs explains itself in one or more sentences. Keep only the first one.
    throw new UsageError((error as Error).message.split(/\.\s/)[0]!.replace(/\.$/, ''));
  }
}

/** A comma list flag as its items, each checked against the allowed values. */
export function listFlag<T extends string>(flag: string, value: string | boolean | undefined, allowed: readonly T[], what: string): T[] | undefined {
  if (typeof value !== 'string') return undefined;
  const items = value.split(',').map((item) => item.trim()).filter((item) => item !== '');
  const unknown = items.filter((item) => !(allowed as readonly string[]).includes(item));
  if (unknown.length > 0 || items.length === 0) throw new UsageError(`--${flag}: ${unknown.length > 0 ? `unknown ${what} "${unknown[0]}"` : `give at least one ${what}`}. Known: ${allowed.join(', ')}`);
  return items as T[];
}

/** A flag that takes one of a few words. */
export function choiceFlag<T extends string>(flag: string, value: string | boolean | undefined, allowed: readonly T[]): T | undefined {
  if (typeof value !== 'string') return undefined;
  if (!(allowed as readonly string[]).includes(value)) throw new UsageError(`--${flag} must be ${allowed.join(', ').replace(/, ([^,]*)$/, ' or $1')}, not "${value}"`);
  return value as T;
}
