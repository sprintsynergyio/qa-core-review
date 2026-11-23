// The `review` command (SPEC.md Sections 11.1 to 11.3): run the static rules over the test
// files, write report.json, print the result, and exit 1 when a finding is at or above the
// --fail-on level.
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../config/load.js';
import type { FailOn } from '../config/types.js';
import type { PathSelection } from '../discover/files.js';
import { runReview } from '../engine/run.js';
import { failsAt } from '../engine/verdict.js';
import { FRAMEWORK_IDS, LANGUAGE_IDS } from '../model/types.js';
import { formatPretty, useColor } from '../report/pretty.js';
import { builtinRules } from '../rules/index.js';
import { choiceFlag, listFlag, parse, UsageError } from './args.js';

export const REVIEW_USAGE = `Usage: qa-core-review review [paths...] [flags]
       qa-core-review [paths...] [flags]

Reviews test files with the static rules and writes report.json. With no paths it reviews
every test file under the root. Paths can be files, folders or globs.

Flags:
  --fail-on <level>     error, warn, info or never. Exit 1 when a finding is at or above the level. Default: error.
  --rules <list>        Only run these rule ids (comma separated).
  --disable <list>      Skip these rule ids.
  --language <list>     Only review these languages, for example typescript,python.
  --framework <name>    Use this runner for every reviewed file.
  --format <list>       pretty, json. Default: pretty. report.json is always written.
  --stdout <format>     Print json to stdout instead of the text view.
  --output <dir>        Folder for the report files. Default: .qa-core/review
  --dump-model          Also write model.json, the normalized model of every file.
  --max-findings <n>    Stop printing findings after n. The report file keeps all of them. Default: 200.
  --quiet               Print only the summary line.
  --no-color            No colors. Colors are also off with NO_COLOR set and when the output is not a terminal.
  --root <dir>          Project root. Report paths are relative to it. Default: the current folder.
  --config <file>       Config file. Default: found from the root upward.
  --help, -h            Print this help.

Exit codes: 0 no finding at or above --fail-on, 1 findings, 2 usage or config error, 3 internal error.
`;

const FLAGS = ['help', 'format', 'root', 'config', 'output', 'stdout', 'fail-on', 'rules', 'disable', 'language', 'framework', 'dump-model', 'max-findings', 'no-color', 'quiet'] as const;
const LATER_FORMATS = ['sarif', 'markdown', 'junit'] as const;
const posix = (value: string): string => value.split(path.sep).join('/');

/** Sorts the paths of the command line into files, folders and globs, relative to the root. */
function selectPaths(paths: readonly string[], root: string): PathSelection | undefined {
  if (paths.length === 0) return undefined;
  const selection: PathSelection = { files: [], folders: [], globs: [] };
  for (const given of paths) {
    const absolute = path.resolve(given);
    const relative = posix(path.relative(root, absolute));
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new UsageError(`path is outside the root: ${given}`);
    const stat = fs.statSync(absolute, { throwIfNoEntry: false });
    if (stat?.isDirectory()) selection.folders.push(relative === '' ? '.' : relative);
    else if (stat) selection.files.push(relative);
    else if (/[*?{]/.test(given)) selection.globs.push(relative);
    else throw new UsageError(`path not found: ${given}`);
  }
  return selection;
}

export async function review(argv: string[]): Promise<number> {
  const { values, positionals } = parse(argv, FLAGS);
  if (values.help) {
    process.stdout.write(REVIEW_USAGE);
    return 0;
  }
  const root = path.resolve(typeof values.root === 'string' ? values.root : '.');
  if (!fs.statSync(root, { throwIfNoEntry: false })?.isDirectory()) throw new UsageError(`--root is not a folder: ${String(values.root)}`);

  const ruleIds = builtinRules.map((rule) => rule.id);
  const onlyRules = listFlag('rules', values.rules, ruleIds, 'rule id');
  const disabledRules = listFlag('disable', values.disable, ruleIds, 'rule id');
  const languages = listFlag('language', values.language, LANGUAGE_IDS, 'language');
  const framework = choiceFlag('framework', values.framework, FRAMEWORK_IDS);
  const failOn = choiceFlag<FailOn>('fail-on', values['fail-on'], ['error', 'warn', 'info', 'never']);
  const formats = listFlag('format', values.format, ['pretty', 'json', ...LATER_FORMATS], 'format');
  const stdout = choiceFlag('stdout', values.stdout, ['json', ...LATER_FORMATS]);
  const maxFindings = typeof values['max-findings'] === 'string' ? Number(values['max-findings']) : 200;
  if (!Number.isInteger(maxFindings) || maxFindings < 0) throw new UsageError(`--max-findings must be a whole number, 0 or more, not "${String(values['max-findings'])}"`);
  const later = [...(formats ?? []), ...(stdout ? [stdout] : [])].find((format) => (LATER_FORMATS as readonly string[]).includes(format));
  if (later) throw new UsageError(`the ${later} format is not available yet in this development build`);

  const loaded = loadConfig({ root, ...(typeof values.config === 'string' ? { configPath: values.config } : {}) });
  for (const warning of loaded.warnings) process.stderr.write(`qa-core-review: warning: ${warning}\n`);
  const config = { ...loaded.config, ...(languages ? { languages } : {}), ...(framework ? { framework } : {}), ...(failOn ? { failOn } : {}) };
  const paths = selectPaths(positionals, root);
  const { report, models, notices } = await runReview({
    root, config, ...(paths ? { paths } : {}), ...(onlyRules ? { onlyRules } : {}), ...(disabledRules ? { disabledRules } : {}),
  });
  for (const notice of notices) process.stderr.write(`qa-core-review: ${notice}\n`);

  // report.json is always written. Paths are shown relative to the root when they are inside it.
  const outputDir = path.resolve(root, typeof values.output === 'string' ? values.output : config.output.dir);
  const shown = (file: string): string => {
    const relative = posix(path.relative(root, file));
    return relative.startsWith('..') || path.isAbsolute(relative) ? posix(file) : relative;
  };
  const write = (name: string, data: unknown): string => {
    const file = path.join(outputDir, name);
    try {
      fs.mkdirSync(outputDir, { recursive: true });
      fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOTDIR' || code === 'EEXIST' || code === 'EACCES' || code === 'EPERM' || code === 'EROFS') throw new UsageError(`cannot write to --output ${shown(outputDir)} (${code})`);
      throw error;
    }
    return shown(file);
  };
  const written = [write('report.json', report)];
  if (values['dump-model']) written.push(write('model.json', models));

  if (stdout === 'json') process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else {
    process.stdout.write(formatPretty(report, {
      color: useColor({ noColorFlag: values['no-color'] === true, env: process.env, isTTY: process.stdout.isTTY === true }), quiet: values.quiet === true, maxFindings,
      reportPaths: written,
      // The classic Windows console cannot show the middle dot. Windows Terminal can.
      unicode: process.platform !== 'win32' || process.env.WT_SESSION !== undefined,
    }));
  }
  return failsAt(report.findings, config.failOn) ? 1 : 0;
}
