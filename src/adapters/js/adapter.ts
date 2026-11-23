// The JS/TS adapter (SPEC.md Section 9.1): Playwright, Cypress, Jest, Vitest, Mocha, WebdriverIO
// and node:test, in JavaScript, TypeScript, JSX and TSX.
import { JS_LEXICAL, scanLines } from '../../parse/lexical.js';
import type { LanguageAdapter } from '../types.js';
import { jsProfile } from './detect.js';
import { detectJsFrameworks } from './frameworks.js';
import { collectJsHelpers, fileContext } from './helpers.js';
import { normalizeJsLexical } from './lexical.js';
import { JS_CAPABILITIES, normalizeJs, readImports } from './normalize.js';
import { ALIASES, SUITE_CALLEES, TEST_CALLEES } from './vocab.js';

/** The grammar for a file, from its extension. */
export function jsGrammarFor(filePath: string): 'javascript' | 'typescript' | 'tsx' {
  if (/\.tsx$/i.test(filePath)) return 'tsx';
  return /\.[cm]?ts$/i.test(filePath) ? 'typescript' : 'javascript';
}

const DECLARES = new RegExp(`(?<![\\w$.])(${[...TEST_CALLEES, ...SUITE_CALLEES, ...Object.keys(ALIASES)].join('|')})(\\.\\w+)*\\s*[(\`]`);

export const jsAdapter: LanguageAdapter = {
  ...jsProfile,
  grammars: ['javascript', 'typescript', 'tsx'],
  commentSyntax: { line: ['//'], block: [['/*', '*/']] },
  capabilities: [...JS_CAPABILITIES],

  /** A quick look at the text, before any parsing: does the file declare a test or a suite? */
  classifyFile(file) {
    if (/\.d\.[cm]?ts$/i.test(file.path)) return 'ignore';
    return scanLines(file.text, JS_LEXICAL).some((line) => DECLARES.test(line.codeNoStrings)) ? 'test' : 'support';
  },

  detectFrameworks: (file) => detectJsFrameworks(file),

  async parse(file, ctx) {
    const result = await ctx.parser.parseForReview(jsGrammarFor(file.path), file.text);
    // No tree: the grammar is unavailable or the file is too broken. `normalize` then uses the
    // lexical scanner, which decides between 'partial' (tests found) and 'failed'.
    if (!result.tree) return { file, tree: null, tokens: null, parseStatus: 'failed' };
    return { file, tree: result.tree, tokens: null, parseStatus: result.tree.rootNode.hasError ? 'partial' : 'ok' };
  },

  normalize(parsed, ctx) {
    const frameworks = detectJsFrameworks(parsed.file);
    return parsed.tree ? normalizeJs(parsed, frameworks, ctx) : normalizeJsLexical(parsed.file, frameworks, ctx);
  },

  /** For the helper index: the functions and methods of any file, test or support, that contain an assertion. */
  collectHelpers(parsed) {
    if (!parsed.tree) return [];
    const root = parsed.tree.rootNode;
    return collectJsHelpers(root, parsed.file.path, fileContext(root, detectJsFrameworks(parsed.file), readImports(root).imports));
  },
};
