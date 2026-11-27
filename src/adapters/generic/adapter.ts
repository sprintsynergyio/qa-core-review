// The generic adapter (SPEC.md Section 9.5): the fallback for every test file in a language
// that has no static adapter. Such a file is listed in the report with `parseStatus: 'llm-only'`
// and is reviewed in LLM mode. When a `generic` config entry gives line patterns for it, the
// lexical scanner finds its tests and four static rules run, at low confidence.
import { parseSuppression } from '../../model/build.js';
import type { NFile, Span } from '../../model/types.js';
import { scanLines } from '../../parse/lexical.js';
import { matchGlob } from '../../util/glob.js';
import type { LanguageAdapter } from '../types.js';
import { genericProfile, languageHintFor, syntaxFor } from './languages.js';
import { capabilitiesOf, compilePatterns, testsFromPatterns } from './patterns.js';

/** The rules that can say something about a file of this adapter. The rest need facts that line patterns cannot give. */
export const GENERIC_RULES: readonly string[] = ['QCR-A001', 'QCR-W001', 'QCR-F001', 'QCR-F002', 'QCR-X001', 'QCR-X002', 'QCR-X003'];

export const genericAdapter: LanguageAdapter = {
  ...genericProfile,
  grammars: [],
  // Per language, see GENERIC_SYNTAX. These two cover most of the table.
  commentSyntax: { line: ['//', '#'] },
  // What a file can hold when its config entry has every pattern. Without patterns a file has none of these.
  capabilities: ['tests', 'modifiers', 'assertions', 'waits'],
  onlyRules: GENERIC_RULES,

  classifyFile: () => 'test',
  detectFrameworks: () => ({ runner: 'unknown', libraries: [], confidence: 'low' }),
  parse: (file) => Promise.resolve({ file, tree: null, tokens: null, parseStatus: 'llm-only' }),

  normalize({ file }, ctx): NFile {
    const entry = ctx.config.generic.find((candidate) => matchGlob(candidate.glob, file.path));
    const languageHint = entry?.language ?? languageHintFor(file.path);
    const lines = scanLines(file.text, syntaxFor(languageHint));
    const model: NFile = {
      path: file.path, language: 'generic', languageHint, adapter: genericProfile.id, tier: genericProfile.tier, runner: 'unknown', libraries: [],
      role: 'test', parseStatus: 'llm-only', capabilities: [], suites: [], tests: [], fileHooks: [], fileMocks: [], fileResources: [], imports: [], subject: null,
      suppressions: lines.flatMap((line) => line.comments.flatMap((comment) => {
        const span: Span = { startLine: line.line, startColumn: comment.column, endLine: line.line, endColumn: line.text.length + 1 };
        return parseSuppression(comment.text, span) ?? [];
      })),
    };
    const patterns = compilePatterns(entry?.patterns);
    if (patterns) Object.assign(model, { parseStatus: 'partial', capabilities: capabilitiesOf(patterns), tests: testsFromPatterns(file.path, lines, patterns) });
    return model;
  },
};
