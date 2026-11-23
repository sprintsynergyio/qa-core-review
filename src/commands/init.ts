// `init` (SPEC.md Section 11.1): so far it writes a config file with every key at its
// default. The targets for agents, CI and pre-commit arrive in later milestones.
import fs from 'node:fs';
import path from 'node:path';
import { stringify } from 'yaml';
import { defaultConfigFile } from '../config/defaults.js';
import { CONFIG_FILE_NAMES } from '../config/load.js';
import { choiceFlag, parse, UsageError } from './args.js';

export const INIT_USAGE = `Usage: qa-core-review init [--config [json|yaml]] [--force] [--root <dir>]

Writes qa-core-review.config.json (or .yaml) with every key at its default value.

Flags:
  --config [json|yaml]   The format of the config file. Default: json.
  --force                Replace a config file that is already there, also one in the other format.
  --root <dir>           Where to write it. Default: the current folder.
  --help, -h             Print this help.
`;

const SCHEMA_URL = 'https://raw.githubusercontent.com/sprintsynergyio/qa-core-review/main/schemas/config.schema.json';
const LATER_TARGETS = ['--claude', '--cursor', '--codex', '--ci', '--pre-commit'];

export function init(argv: string[]): number {
  const later = argv.find((argument) => LATER_TARGETS.includes(argument));
  if (later) throw new UsageError(`init ${later} is not available yet in this development build`);
  // `--config` may come with no value. parseArgs wants one, so give it the default.
  const args = argv.flatMap((argument, index) => (argument === '--config' && (argv[index + 1] ?? '-').startsWith('-') ? [argument, 'json'] : [argument]));
  const { values, positionals } = parse(args, ['help', 'config', 'force', 'root']);
  if (values.help) return process.stdout.write(INIT_USAGE), 0;
  if (positionals.length > 0) throw new UsageError(`init takes no arguments (got "${positionals[0]}")`);
  const format = choiceFlag('config', values.config, ['json', 'yaml']) ?? 'json';
  const root = path.resolve(typeof values.root === 'string' ? values.root : '.');
  if (!fs.statSync(root, { throwIfNoEntry: false })?.isDirectory()) throw new UsageError(`--root is not a folder: ${String(values.root)}`);

  const existing = CONFIG_FILE_NAMES.filter((name) => fs.existsSync(path.join(root, name)));
  if (existing.length > 0 && !values.force) throw new UsageError(`${existing[0]} is already there. Use --force to replace it`);
  const config = defaultConfigFile();
  const name = `qa-core-review.config.${format}`;
  // With --force an older config under another name goes too: left in place it could be the one that is found first.
  for (const old of existing.filter((candidate) => candidate !== name)) {
    fs.rmSync(path.join(root, old));
    process.stdout.write(`Removed ${old}\n`);
  }
  const text = format === 'json'
    ? `${JSON.stringify({ $schema: SCHEMA_URL, ...config }, null, 2)}\n`
    : `# qa-core-review config. Every key is at its default value. Schema: ${SCHEMA_URL}\n${stringify(config)}`;
  fs.writeFileSync(path.join(root, name), text);
  process.stdout.write(`Wrote ${name}\n`);
  return 0;
}
