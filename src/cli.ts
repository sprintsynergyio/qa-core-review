#!/usr/bin/env node
// Command line entry point. This is the Milestone 0 stub: it answers --version and --help.
// The review commands arrive in later milestones (SPEC.md Section 11).
import { parseArgs } from 'node:util';
import { VERSION } from './version.js';

const HELP_HINT = 'Run qa-core-review --help';

const USAGE = `qa-core-review ${VERSION}
Review AI-written tests before merge, in any language.

Usage:
  qa-core-review --version | -v    Print the version.
  qa-core-review --help | -h       Print this help.

Status: in development. The review commands are not available yet.
`;

/** Exit codes from SPEC.md Section 11.3 that the stub can return. */
const EXIT_OK = 0;
const EXIT_USAGE = 2;

function usageError(message: string): number {
  process.stderr.write(`qa-core-review: ${message}\n${HELP_HINT}\n`);
  return EXIT_USAGE;
}

function main(argv: string[]): number {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      options: {
        version: { type: 'boolean', short: 'v' },
        help: { type: 'boolean', short: 'h' },
      },
      allowPositionals: true,
      strict: true,
    });
  } catch (error) {
    // parseArgs explains itself in one or more sentences. Keep only the first one.
    const text = error instanceof Error ? error.message : String(error);
    return usageError(text.split('. ')[0]!.replace(/\.$/, ''));
  }

  if (parsed.values.version) {
    process.stdout.write(`${VERSION}\n`);
    return EXIT_OK;
  }
  if (parsed.values.help || parsed.positionals.length === 0) {
    process.stdout.write(USAGE);
    return EXIT_OK;
  }
  return usageError(`the "${parsed.positionals[0]}" command is not available yet in this development build`);
}

process.exitCode = main(process.argv.slice(2));
