// One review run (SPEC.md Section 7.1): find the files, read and parse them, collect the
// assertion helpers of each project, normalize, run the rules that each file supports, and
// build the report. It reads files and writes nothing.
import fs from 'node:fs';
import path from 'node:path';
import { createRegistry, builtinProfiles, type AdapterRegistry } from '../adapters/index.js';
import type { AdapterProfile, HelperDef, ParsedFile } from '../adapters/types.js';
import type { ResolvedConfig } from '../config/types.js';
import { discover, readSourceFile, type DiscoveredFile, type PathSelection } from '../discover/files.js';
import { createGlobMatcher } from '../util/glob.js';
import { clipText } from '../model/build.js';
import { createHelperIndex } from '../model/helpers-index.js';
import type { NFile } from '../model/types.js';
import { createTreeSitterService, type TreeSitterService } from '../parse/treesitter.js';
import { builtinRules, docsUrlFor } from '../rules/index.js';
import type { FileResult, Finding, Location, Report, Rule, SkippedRule } from '../rules/types.js';
import { VERSION } from '../version.js';
import { selectRules } from './capabilities.js';
import { fingerprint } from './fingerprint.js';
import { verdictOf } from './verdict.js';

export interface ReviewOptions {
  /** Absolute path of the project root. */
  root: string;
  config: ResolvedConfig;
  /** Limit the review to these paths (root-relative). */
  paths?: PathSelection;
  /** Only run these rule ids, and never these. Both are applied after the config. */
  onlyRules?: readonly string[];
  disabledRules?: readonly string[];
  rules?: readonly Rule[];
  registry?: AdapterRegistry;
  profiles?: readonly AdapterProfile[];
  parser?: TreeSitterService;
  /** Pass false to list files by walking the folder instead of asking git. */
  git?: boolean;
  now?: () => Date;
}

export interface ReviewResult {
  report: Report;
  /** The normalized model of every file that has a static adapter, for `--dump-model`. */
  models: NFile[];
  /** Things the user should know that are not findings: skipped files, languages with no adapter yet. */
  notices: string[];
}

interface Loaded { found: DiscoveredFile; parsed: ParsedFile }

/** How far to follow imports for helpers, and how many such files to read at most. */
const SUPPORT_DEPTH = 2;
const SUPPORT_LIMIT = 500;

/** A model for a file that no adapter in this build can read. It is listed, not reviewed. */
function unread(found: DiscoveredFile, profile: AdapterProfile | undefined, parseStatus: NFile['parseStatus']): NFile {
  return {
    path: found.path, language: found.language, languageHint: found.languageHint, adapter: found.adapterId, tier: profile?.tier ?? 3, runner: 'unknown', libraries: [],
    role: 'test', parseStatus, capabilities: [], suites: [], tests: [], fileHooks: [], fileMocks: [], fileResources: [], imports: [], subject: null, suppressions: [],
  };
}

export async function runReview(options: ReviewOptions): Promise<ReviewResult> {
  const { root, config } = options;
  const registry = options.registry ?? createRegistry();
  const profiles = options.profiles ?? builtinProfiles;
  const parser = options.parser ?? createTreeSitterService();
  const notices: string[] = [];
  const discovery = discover(root, config, { profiles, ...(options.git === undefined ? {} : { git: options.git }), ...(options.paths ? { paths: options.paths } : {}) });
  const files = [...discovery.files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  // Read and parse every file that has an adapter. A file that makes its adapter throw is kept as a failed file.
  const loaded: Loaded[] = [];
  const models = new Map<string, NFile>();
  const failed = (found: DiscoveredFile, error: unknown): void => {
    notices.push(`${found.path}: the ${found.adapterId} adapter stopped with an error (${error instanceof Error ? error.message : String(error)}). The file is reported as not parsed.`);
    models.set(found.path, unread(found, registry.get(found.adapterId), 'failed'));
  };
  const noAdapter = new Map<string, number>();
  for (const found of files) {
    const adapter = registry.get(found.adapterId);
    if (!adapter) {
      const name = found.languageHint ?? found.language;
      noAdapter.set(name, (noAdapter.get(name) ?? 0) + 1);
      models.set(found.path, unread(found, profiles.find((profile) => profile.id === found.adapterId), 'llm-only'));
      continue;
    }
    const source = readSourceFile(root, found);
    if (!source) {
      notices.push(`${found.path}: skipped, because it is larger than 1 MB or cannot be read.`);
      continue;
    }
    try {
      loaded.push({ found, parsed: await adapter.parse(source, { config, helperIndex: createHelperIndex([]), parser }) });
    } catch (error) {
      failed(found, error);
    }
  }
  for (const [name, count] of noAdapter) notices.push(`${count} ${name} ${count === 1 ? 'file is' : 'files are'} listed but not reviewed: this build has no static adapter for ${name}.`);

  // Helpers also live in files that discovery does not pick: a page object in src/pages, Cypress
  // support files. Follow what the reviewed files load, two steps deep (a spec, its fixtures file,
  // the page objects that file imports). These files feed the helper index and are not reviewed.
  const extras: Loaded[] = [];
  const known = new Set(loaded.map(({ found }) => found.path));
  const excluded = createGlobMatcher(config.exclude);
  let frontier = loaded;
  for (let depth = 0; depth < SUPPORT_DEPTH && extras.length < SUPPORT_LIMIT; depth += 1) {
    const next: Loaded[] = [];
    for (const { found, parsed } of frontier) {
      const adapter = registry.get(found.adapterId)!;
      let guesses: string[] = [];
      try {
        guesses = adapter.supportFiles?.(parsed) ?? [];
      } catch {
        // A file whose imports cannot be read brings no helpers from elsewhere. Its own problems are reported when it is normalized.
      }
      for (const guess of guesses) {
        // Each guess is looked at once: many files import the same modules.
        if (known.has(guess)) continue;
        known.add(guess);
        if (excluded(guess) || !adapter.extensions.some((extension) => guess.endsWith(extension)) || !fs.statSync(path.join(root, guess), { throwIfNoEntry: false })?.isFile()) continue;
        const extra: DiscoveredFile = { path: guess, adapterId: found.adapterId, language: adapter.languageOf(guess), languageHint: null, project: found.project };
        const source = readSourceFile(root, extra);
        if (!source) continue;
        try {
          next.push({ found: extra, parsed: await adapter.parse(source, { config, helperIndex: createHelperIndex([]), parser }) });
        } catch {
          // Not a file the review was asked about: leave it out.
        }
      }
    }
    extras.push(...next);
    frontier = next;
  }

  // The helper index of a project holds the assertion helpers of all its files, support files included.
  const projectOf = ({ found }: Loaded): string => `${found.adapterId}\0${found.project?.dir ?? ''}`;
  const helpers = new Map<string, HelperDef[]>();
  for (const entry of [...loaded, ...extras]) {
    try {
      const list = helpers.get(projectOf(entry)) ?? [];
      list.push(...(registry.get(entry.found.adapterId)!.collectHelpers?.(entry.parsed) ?? []));
      helpers.set(projectOf(entry), list);
    } catch (error) {
      notices.push(`${entry.found.path}: its assertion helpers could not be read (${error instanceof Error ? error.message : String(error)}).`);
    }
  }
  for (const entry of loaded) {
    try {
      const helperIndex = createHelperIndex(helpers.get(projectOf(entry)) ?? [], config.assertionHelpers);
      models.set(entry.found.path, registry.get(entry.found.adapterId)!.normalize(entry.parsed, { config, helperIndex, parser }));
    } catch (error) {
      failed(entry.found, error);
    } finally {
      entry.parsed.tree?.delete();
    }
  }
  for (const extra of extras) extra.parsed.tree?.delete();

  // Which rules run at all: the config, then the command line.
  const rules = (options.rules ?? builtinRules).filter((rule) => config.rules[rule.id]?.enabled !== false
    && (!options.onlyRules || options.onlyRules.includes(rule.id)) && !options.disabledRules?.includes(rule.id));
  const all = files.flatMap((found) => models.get(found.path) ?? []);
  const findings: Finding[] = [];
  const results: FileResult[] = [];
  for (const file of all) {
    const selection = selectRules(rules, file);
    const skipped: SkippedRule[] = [...selection.skipped];
    const seen = new Map<string, number>();
    const fileFindings: Finding[] = [];
    // A file read by the lexical scanner has fewer capabilities than its adapter: its findings are less sure.
    const reduced = file.parseStatus === 'partial' && file.capabilities.length < (registry.get(file.adapter)?.capabilities.length ?? 0);
    for (const rule of selection.run) {
      const setting = config.rules[rule.id];
      if (setting?.languages && !setting.languages.includes(file.language)) {
        skipped.push({ ruleId: rule.id, reason: `limited to other languages by the config: ${setting.languages.join(', ')}` });
        continue;
      }
      for (const draft of rule.check({ file, all, config, options: setting?.options ?? {} })) {
        const test = draft.testId === null ? null : file.tests.find((candidate) => candidate.id === draft.testId) ?? null;
        const evidence = clipText(draft.evidence);
        const key = [rule.id, test?.fullTitle ?? '', evidence].join('\0');
        const occurrence = seen.get(key) ?? 0;
        seen.set(key, occurrence + 1);
        const location: Location = { file: file.path, ...draft.span };
        fileFindings.push({
          id: fingerprint(rule.id, file.path, test?.fullTitle ?? null, evidence, occurrence), ruleId: rule.id, ruleName: rule.name,
          severity: setting?.severity ?? draft.severity ?? rule.defaultSeverity, source: 'static', message: draft.message, evidence, fix: draft.fix ?? '',
          ...(draft.goodExample === undefined ? {} : { goodExample: draft.goodExample }),
          location, testId: test?.id ?? null, confidence: reduced ? 'low' : draft.confidence ?? 'high', suppressed: false, docsUrl: docsUrlFor(rule.id),
        });
      }
    }
    findings.push(...fileFindings);
    results.push({
      file: file.path, language: file.language, languageHint: file.languageHint, adapter: file.adapter, tier: file.tier, runner: file.runner, libraries: file.libraries,
      parseStatus: file.parseStatus, rulesSkipped: skipped,
      tests: file.tests.map((test) => {
        const own = fileFindings.filter((finding) => finding.testId === test.id);
        return {
          id: test.id, title: test.title, fullTitle: test.fullTitle, location: { file: file.path, ...test.span }, bodyLocation: { file: file.path, ...test.bodySpan },
          modifiers: test.modifiers, assertionCount: test.assertions.length, verdict: verdictOf(own), findingIds: own.map((finding) => finding.id),
        };
      }),
    });
  }
  findings.sort((a, b) => (a.location.file < b.location.file ? -1 : a.location.file > b.location.file ? 1 : 0)
    || a.location.startLine - b.location.startLine || (a.ruleId < b.ruleId ? -1 : a.ruleId > b.ruleId ? 1 : 0) || a.location.startColumn - b.location.startColumn);

  const tests = results.flatMap((result) => result.tests);
  const open = findings.filter((finding) => !finding.suppressed);
  const count = (severity: Finding['severity'], list = open): number => list.filter((finding) => finding.severity === severity).length;
  const byLanguage: Report['summary']['byLanguage'] = {};
  for (const result of results) {
    const name = result.languageHint ?? result.language;
    const own = open.filter((finding) => finding.location.file === result.file);
    const entry = byLanguage[name] ?? { files: 0, tests: 0, errors: 0, warnings: 0 };
    byLanguage[name] = { files: entry.files + 1, tests: entry.tests + result.tests.length, errors: entry.errors + count('error', own), warnings: entry.warnings + count('warn', own) };
  }
  const report: Report = {
    schemaVersion: 2,
    tool: { name: 'qa-core-review', version: VERSION },
    createdAt: (options.now?.() ?? new Date()).toISOString(),
    root: root.split(path.sep).join('/'),
    mode: { diffBase: null, llm: 'off' },
    // Only the projects that own a reviewed file: a review of one folder does not list the rest of a monorepo.
    projects: discovery.projects.filter((project) => files.some((found) => found.project === project))
      .map((project) => ({ dir: project.dir, adapter: project.adapterId, frameworks: project.frameworks })),
    rulesRun: rules.map((rule) => rule.id),
    files: results,
    findings,
    summary: {
      files: results.length, tests: tests.length,
      pass: tests.filter((test) => test.verdict === 'pass').length, review: tests.filter((test) => test.verdict === 'review').length,
      fail: tests.filter((test) => test.verdict === 'fail').length,
      errors: count('error'), warnings: count('warn'), infos: count('info'), suppressed: findings.length - open.length,
      byLanguage, llmOnlyFiles: results.filter((result) => result.parseStatus === 'llm-only').length,
    },
  };
  return { report, models: all.filter((file) => registry.get(file.adapter) !== undefined), notices };
}
