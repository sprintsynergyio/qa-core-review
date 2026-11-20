#!/usr/bin/env node
// Command line entry point (SPEC.md Section 11). So far: --version, --help and `detect`.
// The review commands arrive in later milestones.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { ConfigError, loadConfig } from './config/load.js';
import { buildDetectReport, formatDetectPretty } from './detect/report.js';
import { discover } from './discover/files.js';
import { VERSION } from './version.js';

const HELP_HINT = 'Run qa-core-review --help';
const ISSUES_URL = 'https://github.com/sprintsynergyio/qa-core-review/issues';

const USAGE = `qa-core-review ${VERSION}
Review AI-written tests before merge, in any language.

Usage:
  qa-core-review detect [flags]    Show the detected projects, frameworks and test file counts.
  qa-core-review --version | -v    Print the version.
  qa-core-review --help | -h       Print this help. Also: qa-core-review <command> --help

Status: in development. The review commands are not available yet.
`;

const DETECT_USAGE = `Usage: qa-core-review detect [flags]

Shows what a review would cover: the projects found, their frameworks with the evidence for
each, and the number of test files per adapter. It reads files and runs nothing.

Flags:
  --format <pretty|json>   Output format. Default: pretty.
  --root <dir>             Project root. Default: the current folder.
  --config <file>          Config file. Default: found from the root upward.
  --help, -h               Print this help.
`;

/** Exit codes from SPEC.md Section 11.3. */
const EXIT_OK = 0;
const EXIT_USAGE = 2;
const EXIT_INTERNAL = 3;

/** A mistake in how the tool was called. Printed on one line with a pointer to --help. Exit 2. */
class UsageError extends Error {}

const OPTIONS = {
  version: { type: 'boolean', short: 'v' },
  help: { type: 'boolean', short: 'h' },
  format: { type: 'string' },
  root: { type: 'string' },
  config: { type: 'string' },
} as const;

function parse(argv: string[], names: ReadonlyArray<keyof typeof OPTIONS>) {
  try {
    return parseArgs({ args: argv, options: Object.fromEntries(names.map((name) => [name, OPTIONS[name]])), allowPositionals: true, strict: true });
  } catch (error) {
    // parseArgs explains itself in one or more sentences. Keep only the first one.
    throw new UsageError((error as Error).message.split('. ')[0]!.replace(/\.$/, ''));
  }
}

function detect(argv: string[]): number {
  const { values, positionals } = parse(argv, ['help', 'format', 'root', 'config']);
  if (values.help) {
    process.stdout.write(DETECT_USAGE);
    return EXIT_OK;
  }
  if (positionals.length > 1) throw new UsageError(`detect takes no paths (got "${positionals[1]}"). Use --root <dir>`);
  const format = (values.format as string | undefined) ?? 'pretty';
  if (format !== 'pretty' && format !== 'json') throw new UsageError(`--format must be pretty or json for detect, not "${format}"`);
  const root = path.resolve((values.root as string | undefined) ?? '.');
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) throw new UsageError(`--root is not a folder: ${values.root as string}`);

  const loaded = loadConfig({ root, ...(values.config ? { configPath: values.config as string } : {}) });
  for (const warning of loaded.warnings) process.stderr.write(`qa-core-review: warning: ${warning}\n`);
  const shownConfig = loaded.file === null ? null : path.relative(root, loaded.file).split(path.sep).join('/');
  const report = buildDetectReport(discover(root, loaded.config), shownConfig);
  process.stdout.write(format === 'json' ? `${JSON.stringify(report, null, 2)}\n` : formatDetectPretty(report));
  return EXIT_OK;
}

function main(argv: string[]): number {
  // A first, lenient pass only to find the command word among the flags.
  const command = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true, strict: false }).positionals[0];
  if (command === 'detect') return detect(argv);
  if (command !== undefined) throw new UsageError(`the "${command}" command is not available yet in this development build`);

  const { values } = parse(argv, ['version', 'help']);
  process.stdout.write(values.version ? `${VERSION}\n` : USAGE);
  return EXIT_OK;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  if (error instanceof UsageError) {
    process.stderr.write(`qa-core-review: ${error.message}\n${HELP_HINT}\n`);
    process.exitCode = EXIT_USAGE;
  } else if (error instanceof ConfigError) {
    process.stderr.write(`qa-core-review: ${error.message}\n`);
    process.exitCode = EXIT_USAGE;
  } else {
    const detail = process.env.QA_CORE_REVIEW_DEBUG === '1' && error instanceof Error ? `\n${error.stack}` : '';
    process.stderr.write(`Internal error, please open an issue at ${ISSUES_URL}${detail}\n`);
    process.exitCode = EXIT_INTERNAL;
  }
}
