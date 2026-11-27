#!/usr/bin/env node
// Command line entry point (SPEC.md Section 11). So far: `review` (the default command),
// `detect`, `rules`, `explain`, `adapters`, `init`, --version and --help. The other commands
// arrive in later milestones.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { OPTIONS, parse, UsageError } from './commands/args.js';
import { adapters, explain, rules } from './commands/info.js';
import { init } from './commands/init.js';
import { review } from './commands/review.js';
import { ConfigError, loadConfig } from './config/load.js';
import { buildDetectReport, formatDetectPretty } from './detect/report.js';
import { discover } from './discover/files.js';
import { VERSION } from './version.js';

const HELP_HINT = 'Run qa-core-review --help';
const ISSUES_URL = 'https://github.com/sprintsynergyio/qa-core-review/issues';

const USAGE = `qa-core-review ${VERSION}
Review AI-written tests before merge, in any language.

Usage:
  qa-core-review review [paths...] [flags]   Review test files. This is the default command:
  qa-core-review [paths...] [flags]          the word "review" can be left out.
  qa-core-review detect [flags]              Show the detected projects, frameworks and test file counts.
  qa-core-review rules [--language <id>]     List the rules.
  qa-core-review explain <ruleId>            Describe one rule.
  qa-core-review adapters                    List the language adapters and what they read.
  qa-core-review init [flags]                Write a config file, a CI file or a pre-commit hook entry.
  qa-core-review --version | -v              Print the version.
  qa-core-review --help | -h                 Print this help. Also: qa-core-review <command> --help

Status: in development. Most rules and the ui, hook and comment commands are not available yet.
`;

/** Commands from SPEC.md Section 11.1 that later milestones add. */
const LATER_COMMANDS = ['ui', 'hook', 'comment'];
const COMMANDS: Readonly<Record<string, (argv: string[]) => number | Promise<number>>> = { review, rules, explain, adapters, init };

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

async function main(argv: string[]): Promise<number> {
  // A first, lenient pass only to find the command word among the flags.
  const first = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true, strict: false, tokens: true });
  const word = first.tokens.find((token) => token.kind === 'positional');
  const command = word?.kind === 'positional' ? word.value : undefined;
  if (command === 'detect') return detect(argv);
  if (command !== undefined && LATER_COMMANDS.includes(command)) throw new UsageError(`the "${command}" command is not available yet in this development build`);
  const run = command === undefined ? undefined : COMMANDS[command];
  if (run && Object.hasOwn(COMMANDS, command!)) return run(argv.filter((_, index) => index !== word!.index));

  // No command word: --version, --help, or a review of the given paths.
  if (first.values.version || (first.values.help && command === undefined)) {
    const { values } = parse(argv, ['version', 'help']);
    process.stdout.write(values.version ? `${VERSION}\n` : USAGE);
    return EXIT_OK;
  }
  return review(argv);
}

try {
  process.exitCode = await main(process.argv.slice(2));
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
