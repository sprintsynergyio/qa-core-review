// The `review` command (SPEC.md Sections 11.1 to 11.3): run the static rules over the test
// files, write report.json, print the result, and exit 1 when a finding is at or above the
// --fail-on level.
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../config/load.js';
import type { FailOn, ResolvedConfig } from '../config/types.js';
import type { PathSelection } from '../discover/files.js';
import { changedLines, DiffError, type ChangedLines } from '../discover/diff.js';
import { runReview } from '../engine/run.js';
import { failsAt } from '../engine/verdict.js';
import { FRAMEWORK_IDS, LANGUAGE_IDS } from '../model/types.js';
import { formatJunit } from '../report/junit.js';
import { formatMarkdown } from '../report/markdown.js';
import { formatPretty, formatSummary, useColor } from '../report/pretty.js';
import { formatSarif } from '../report/sarif.js';
import { builtinRules } from '../rules/index.js';
import type { Report } from '../rules/types.js';
import { choiceFlag, listFlag, parse, UsageError, type OptionName } from './args.js';

export const REVIEW_USAGE = `Usage: qa-core-review review [paths...] [flags]
       qa-core-review [paths...] [flags]

Reviews test files with the static rules and writes report.json. With no paths it reviews
every test file under the root. Paths can be files, folders or globs.

Flags:
  --diff <base>         Review only the tests whose lines changed since the branch left <base>, plus changes
                        that are not committed and untracked test files. --diff HEAD: only uncommitted changes.
  --staged              Like --diff, for what git add has staged. Made for pre-commit hooks.
  --fail-on <level>     error, warn, info or never. Exit 1 when a finding is at or above the level. Default: error.
  --rules <list>        Only run these rule ids (comma separated).
  --disable <list>      Skip these rule ids.
  --language <list>     Only review these languages, for example typescript,python.
  --framework <name>    Use this runner for every reviewed file.
  --format <list>       Comma list of pretty, json, sarif, markdown, junit. Default: pretty. pretty is the text view,
                        the others are files: report.json (always written), report.sarif, report.md, report.junit.xml.
  --stdout <format>     Print json, sarif, markdown or junit to stdout instead of the text view, for piping.
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

export const REVIEW_FLAGS = ['help', 'diff', 'staged', 'format', 'root', 'config', 'output', 'stdout', 'fail-on', 'rules', 'disable', 'language', 'framework', 'dump-model', 'max-findings', 'no-color', 'quiet'] as const;
const FILE_FORMATS = ['json', 'sarif', 'markdown', 'junit'] as const;
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

/** A finished review: the report, the files written for it, and what the flags asked for. */
export interface ReviewRun {
  root: string;
  config: ResolvedConfig;
  report: Report;
  outputDir: string;
  /** The report files that were written, as they are shown: relative to the root when inside it. */
  written: string[];
  formats: readonly string[];
  maxFindings: number;
  /** The report in one of the file formats, for --stdout. */
  texts: Record<(typeof FILE_FORMATS)[number], () => string>;
  /** A path as it is shown to the user. */
  shown(file: string): string;
}

/** Runs the review that the flags and paths ask for and writes report.json and the other report files. Used by `review` and `ui`. */
export async function runFromFlags(values: Partial<Record<OptionName, string | boolean>>, positionals: readonly string[]): Promise<ReviewRun> {
  const root = path.resolve(typeof values.root === 'string' ? values.root : '.');
  if (!fs.statSync(root, { throwIfNoEntry: false })?.isDirectory()) throw new UsageError(`--root is not a folder: ${String(values.root)}`);

  const ruleIds = builtinRules.map((rule) => rule.id);
  const onlyRules = listFlag('rules', values.rules, ruleIds, 'rule id');
  const disabledRules = listFlag('disable', values.disable, ruleIds, 'rule id');
  const languages = listFlag('language', values.language, LANGUAGE_IDS, 'language');
  const framework = choiceFlag('framework', values.framework, FRAMEWORK_IDS);
  const failOn = choiceFlag<FailOn>('fail-on', values['fail-on'], ['error', 'warn', 'info', 'never']);
  const formatFlag = listFlag('format', values.format, ['pretty', ...FILE_FORMATS], 'format');
  choiceFlag('stdout', values.stdout, FILE_FORMATS);
  const maxFindings = typeof values['max-findings'] === 'string' ? Number(values['max-findings']) : 200;
  if (!Number.isInteger(maxFindings) || maxFindings < 0) throw new UsageError(`--max-findings must be a whole number, 0 or more, not "${String(values['max-findings'])}"`);

  // Diff mode. A folder that is not a git repo, or a base git does not know, is a usage error.
  if (typeof values.diff === 'string' && values.staged) throw new UsageError('use --diff or --staged, not both');
  let diff: { base: string; lines: ChangedLines } | undefined;
  try {
    if (typeof values.diff === 'string') diff = { base: values.diff, lines: changedLines(root, { base: values.diff }) };
    else if (values.staged) diff = { base: 'staged', lines: changedLines(root, { staged: true }) };
  } catch (error) {
    if (error instanceof DiffError) throw new UsageError(error.message);
    throw error;
  }

  const loaded = loadConfig({ root, ...(typeof values.config === 'string' ? { configPath: values.config } : {}) });
  for (const warning of loaded.warnings) process.stderr.write(`qa-core-review: warning: ${warning}\n`);
  const config = { ...loaded.config, ...(languages ? { languages } : {}), ...(framework ? { framework } : {}), ...(failOn ? { failOn } : {}) };
  const paths = selectPaths(positionals, root);
  const { report, models, notices } = await runReview({
    root, config, ...(paths ? { paths } : {}), ...(onlyRules ? { onlyRules } : {}), ...(disabledRules ? { disabledRules } : {}), ...(diff ? { diff } : {}),
  });
  for (const notice of notices) process.stderr.write(`qa-core-review: ${notice}\n`);

  // report.json is always written. Paths are shown relative to the root when they are inside it.
  const outputDir = path.resolve(root, typeof values.output === 'string' ? values.output : config.output.dir);
  const shown = (file: string): string => {
    const relative = posix(path.relative(root, file));
    return relative.startsWith('..') || path.isAbsolute(relative) ? posix(file) : relative;
  };
  const write = (name: string, text: string): string => {
    const file = path.join(outputDir, name);
    try {
      fs.mkdirSync(outputDir, { recursive: true });
      fs.writeFileSync(file, text);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOTDIR' || code === 'EEXIST' || code === 'EACCES' || code === 'EPERM' || code === 'EROFS') throw new UsageError(`cannot write to --output ${shown(outputDir)} (${code})`);
      throw error;
    }
    return shown(file);
  };
  const json = (data: unknown): string => `${JSON.stringify(data, null, 2)}\n`;
  const formats = formatFlag ?? config.output.formats;
  const reportJson = shown(path.join(outputDir, 'report.json'));
  const texts = {
    json: (): string => json(report),
    sarif: (): string => json(formatSarif(report, builtinRules)),
    markdown: (): string => formatMarkdown(report, { reportPath: reportJson }),
    junit: (): string => formatJunit(report, config.failOn),
  };
  const names = { sarif: 'report.sarif', markdown: 'report.md', junit: 'report.junit.xml' } as const;
  const written = [write('report.json', texts.json())];
  for (const format of ['sarif', 'markdown', 'junit'] as const) {
    if (formats.includes(format)) written.push(write(names[format], texts[format]()));
  }
  if (values['dump-model']) written.push(write('model.json', json(models)));
  return { root, config, report, outputDir, written, formats, maxFindings, texts, shown };
}

export async function review(argv: string[]): Promise<number> {
  const { values, positionals } = parse(argv, REVIEW_FLAGS);
  if (values.help) {
    process.stdout.write(REVIEW_USAGE);
    return 0;
  }
  const stdout = choiceFlag('stdout', values.stdout, FILE_FORMATS);
  const { config, report, written, formats, maxFindings, texts } = await runFromFlags(values, positionals);
  if (stdout) process.stdout.write(texts[stdout]());
  // Only files were asked for: the text view is left out, and two lines say what happened and where the files are.
  else if (!formats.includes('pretty')) process.stdout.write(`${formatSummary(report)}\nReports: ${written.join(', ')}\n`);
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
