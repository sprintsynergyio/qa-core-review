// `init` (SPEC.md Sections 11.1, 15.4 and 15.5) sets the tool up in a project: a config file
// with every key at its default, the CI file of one provider, and the hook entry for the
// pre-commit framework. The targets for agents arrive in later milestones.
//
// A file the user already has is never replaced, with one exception under --force: a file
// that only this tool writes (its config file and its own GitHub workflow).
import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml, stringify } from 'yaml';
import { readAssetText } from '../assets.js';
import { defaultConfigFile } from '../config/defaults.js';
import { CONFIG_FILE_NAMES } from '../config/load.js';
import { choiceFlag, parse, UsageError } from './args.js';

export const INIT_USAGE = `Usage: qa-core-review init [--config [json|yaml]] [--ci <provider>] [--pre-commit] [--force] [--root <dir>]

Sets the tool up in a project. With no flag it writes qa-core-review.config.json with every
key at its default value.

Flags:
  --config [json|yaml]   Write the config file, in this format. Default: json.
  --ci <provider>        Write the CI file for github, gitlab, azure, jenkins or bitbucket. A file that is
                         already there is not changed: the template is printed, for you to copy from.
  --pre-commit           Add the hook to .pre-commit-config.yaml, for the pre-commit framework.
  --force                Replace a config file that is already there, also one in the other format, and
                         a .github/workflows/qa-core-review.yml that is already there.
  --root <dir>           The project folder. Default: the current folder.
  --help, -h             Print this help.
`;

const SCHEMA_URL = 'https://raw.githubusercontent.com/sprintsynergyio/qa-core-review/main/schemas/config.schema.json';
const LATER_TARGETS = ['--claude', '--cursor', '--codex'];
const TOOL = 'qa-core-review';

interface CiTarget {
  /** The template, as an asset name. */
  template: string;
  /** Where it goes in the project, with '/' separators. */
  target: string;
  /** The part of the template to copy into a pipeline file that is already there. */
  part: string;
  /** True for a file that only this tool writes, which --force may replace. */
  own: boolean;
}

/** The CI providers of SPEC.md Section 15.5. */
export const CI_TARGETS: Readonly<Record<string, CiTarget>> = {
  github: { template: 'templates/ci/github.yml', target: '.github/workflows/qa-core-review.yml', part: 'job', own: true },
  gitlab: { template: 'templates/ci/gitlab.yml', target: '.gitlab-ci.yml', part: 'job', own: false },
  azure: { template: 'templates/ci/azure.yml', target: 'azure-pipelines.yml', part: 'steps', own: false },
  jenkins: { template: 'templates/ci/Jenkinsfile', target: 'Jenkinsfile', part: 'stage', own: false },
  bitbucket: { template: 'templates/ci/bitbucket.yml', target: 'bitbucket-pipelines.yml', part: 'step', own: false },
};

export const PRE_COMMIT_CONFIG = '.pre-commit-config.yaml';
const PRE_COMMIT_SNIPPET = 'templates/precommit/pre-commit-config.snippet.yaml';
const HOOK_REPO = 'https://github.com/sprintsynergyio/qa-core-review';

const say = (line: string): void => void process.stdout.write(`${line}\n`);
const readIfThere = (file: string): string | null => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null);
const sameText = (a: string, b: string): boolean => a.replace(/\r\n/g, '\n').trimEnd() === b.replace(/\r\n/g, '\n').trimEnd();

function writeConfig(root: string, format: 'json' | 'yaml', force: boolean): void {
  const existing = CONFIG_FILE_NAMES.filter((name) => fs.existsSync(path.join(root, name)));
  if (existing.length > 0 && !force) throw new UsageError(`${existing[0]} is already there. Use --force to replace it`);
  const config = defaultConfigFile();
  const name = `qa-core-review.config.${format}`;
  // With --force an older config under another name goes too: left in place it could be the one that is found first.
  for (const old of existing.filter((candidate) => candidate !== name)) {
    fs.rmSync(path.join(root, old));
    say(`Removed ${old}`);
  }
  const text = format === 'json'
    ? `${JSON.stringify({ $schema: SCHEMA_URL, ...config }, null, 2)}\n`
    : `# qa-core-review config. Every key is at its default value. Schema: ${SCHEMA_URL}\n${stringify(config)}`;
  fs.writeFileSync(path.join(root, name), text);
  say(`Wrote ${name}`);
}

/** Writes the CI file of one provider. A pipeline file that is already there stays as it is, and the template is printed. */
function writeCi(root: string, provider: string, force: boolean): void {
  const { template, target, part, own } = CI_TARGETS[provider]!;
  const text = readAssetText(template);
  const file = path.join(root, ...target.split('/'));
  const current = readIfThere(file);
  if (current === null || (own && force && !sameText(current, text))) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
    say(`Wrote ${target}`);
  } else if (sameText(current, text)) {
    say(`${target} is already there and up to date. Nothing to do.`);
  } else if (current.includes(TOOL)) {
    say(`${target} already runs ${TOOL}. Nothing to do.${own ? ' Use --force to replace it with the template.' : ''}`);
  } else {
    say(`${target} is already there, so it was not changed. Copy the ${TOOL} ${part} from this template into it:\n\n${text.trimEnd()}`);
  }
}

/**
 * The config of the pre-commit framework with the hook added at the end of its `repos` list,
 * or null when that cannot be done by adding lines at the end of the file. The result is
 * parsed again and compared with the old list, so nothing the user wrote can change.
 */
export function withPreCommitHook(current: string, snippet: string): string | null {
  const reposOf = (text: string): unknown[] | null => {
    try {
      const parsed: unknown = parseYaml(text);
      if (parsed === null || typeof parsed !== 'object' || !('repos' in parsed)) return null;
      // `repos:` with nothing under it yet is an empty list.
      return Array.isArray(parsed.repos) ? parsed.repos : parsed.repos === null ? [] : null;
    } catch {
      return null;
    }
  };
  const before = reposOf(current);
  if (before === null) return null;
  const eol = current.includes('\r\n') ? '\r\n' : '\n';
  const lines = current.split(/\r?\n/);
  // New lines at the end of the file join the list only when `repos:` is the last top-level key and is written as a block.
  const topLevel = lines.filter((line) => /^[^\s#-][^#]*:/.test(line));
  if (!/^repos:\s*(#.*)?$/.test(topLevel.at(-1) ?? '')) return null;
  const start = lines.lastIndexOf(topLevel.at(-1)!);
  const firstItem = lines.slice(start + 1).find((line) => /^\s*- /.test(line));
  const indent = firstItem === undefined ? '  ' : /^\s*/.exec(firstItem)![0];
  const added = snippet.replace(/\r\n/g, '\n').trimEnd().split('\n').map((line) => indent + line.replace(/^ {2}/, ''));
  const merged = `${current.replace(/\s*$/, '')}${eol}${added.join(eol)}${eol}`;
  const after = reposOf(merged);
  const kept = after !== null && after.length === before.length + 1 && JSON.stringify(after.slice(0, -1)) === JSON.stringify(before);
  const last = after?.at(-1) as { repo?: unknown; hooks?: Array<{ id?: unknown }> } | undefined;
  return kept && last?.repo === HOOK_REPO && last.hooks?.[0]?.id === TOOL ? merged : null;
}

/** Adds the hook to `.pre-commit-config.yaml`, or prints the lines to add when the file cannot be changed safely. */
function addPreCommit(root: string): void {
  const snippet = readAssetText(PRE_COMMIT_SNIPPET);
  const file = path.join(root, PRE_COMMIT_CONFIG);
  const current = readIfThere(file);
  if (current === null) {
    fs.writeFileSync(file, `repos:\n${snippet}`);
    say(`Wrote ${PRE_COMMIT_CONFIG}`);
  } else if (current.includes(HOOK_REPO)) {
    say(`${PRE_COMMIT_CONFIG} already has the ${TOOL} hook. Nothing to do.`);
  } else {
    const merged = withPreCommitHook(current, snippet);
    if (merged === null) {
      say(`${PRE_COMMIT_CONFIG} was not changed, because the hook cannot be added to it safely. Add these lines under "repos:" yourself:\n\n${snippet.trimEnd()}`);
    } else {
      fs.writeFileSync(file, merged);
      say(`Added the ${TOOL} hook to ${PRE_COMMIT_CONFIG}`);
    }
  }
}

export function init(argv: string[]): number {
  const later = argv.find((argument) => LATER_TARGETS.includes(argument));
  if (later) throw new UsageError(`init ${later} is not available yet in this development build`);
  // `--config` may come with no value. parseArgs wants one, so give it the default.
  const args = argv.flatMap((argument, index) => (argument === '--config' && (argv[index + 1] ?? '-').startsWith('-') ? [argument, 'json'] : [argument]));
  const { values, positionals } = parse(args, ['help', 'config', 'force', 'root', 'ci', 'pre-commit']);
  if (values.help) return process.stdout.write(INIT_USAGE), 0;
  if (positionals.length > 0) throw new UsageError(`init takes no arguments (got "${positionals[0]}")`);
  const format = choiceFlag('config', values.config, ['json', 'yaml']);
  const provider = choiceFlag('ci', values.ci, Object.keys(CI_TARGETS));
  const root = path.resolve(typeof values.root === 'string' ? values.root : '.');
  if (!fs.statSync(root, { throwIfNoEntry: false })?.isDirectory()) throw new UsageError(`--root is not a folder: ${String(values.root)}`);

  // With no target the config file is the target. `--ci` and `--pre-commit` alone leave the config alone.
  if (format !== undefined || (provider === undefined && !values['pre-commit'])) writeConfig(root, format ?? 'json', values.force === true);
  if (provider !== undefined) writeCi(root, provider, values.force === true);
  if (values['pre-commit']) addPreCommit(root);
  return 0;
}
