// The Python adapter (SPEC.md Section 9.2): pytest and unittest, with Playwright for Python and
// Selenium as libraries.
import { PYTHON_LEXICAL, scanLines } from '../../parse/lexical.js';
import type { LanguageAdapter } from '../types.js';
import { pythonProfile } from './detect.js';
import { detectPythonFrameworks } from './frameworks.js';
import { collectPythonHelpers, fileContext, supportFilesOf } from './helpers.js';
import { normalizePythonLexical } from './lexical.js';
import { PYTHON_CAPABILITIES, normalizePython, readImports } from './normalize.js';
import { SUPPORT_FILE_NAMES, TESTCASE_SUFFIX, TEST_CLASS_PREFIX, TEST_FUNCTION_PREFIX } from './vocab.js';

const DECLARES = new RegExp(`^\\s*(?:(?:async\\s+)?def\\s+${TEST_FUNCTION_PREFIX}\\w*\\s*\\(|class\\s+(?:${TEST_CLASS_PREFIX}\\w*\\b|\\w+\\s*\\([^)]*${TESTCASE_SUFFIX}\\b))`);

export const pythonAdapter: LanguageAdapter = {
  ...pythonProfile,
  grammars: ['python'],
  commentSyntax: { line: ['#'] },
  capabilities: [...PYTHON_CAPABILITIES],

  /** A quick look at the text, before any parsing: does the file declare a test or a test class? */
  classifyFile(file) {
    if (SUPPORT_FILE_NAMES.includes(file.path.slice(file.path.lastIndexOf('/') + 1))) return 'support';
    return scanLines(file.text, PYTHON_LEXICAL).some((line) => DECLARES.test(line.codeNoStrings)) ? 'test' : 'support';
  },

  detectFrameworks: (file) => detectPythonFrameworks(file),

  async parse(file, ctx) {
    const result = await ctx.parser.parseForReview('python', file.text);
    // No tree: the grammar is unavailable or the file is too broken.
    if (!result.tree) return { file, tree: null, tokens: null, parseStatus: 'failed' };
    return { file, tree: result.tree, tokens: null, parseStatus: result.tree.rootNode.hasError ? 'partial' : 'ok' };
  },

  normalize(parsed, ctx) {
    const frameworks = detectPythonFrameworks(parsed.file);
    // With no tree the lexical scanner still finds the tests, the lines that assert and the fixed sleeps.
    return parsed.tree ? normalizePython(parsed, frameworks, ctx) : normalizePythonLexical(parsed.file, frameworks, ctx);
  },

  /** For the helper index: the functions and methods of any file, test or support, that contain an assertion. */
  collectHelpers(parsed) {
    if (!parsed.tree) return [];
    const root = parsed.tree.rootNode;
    const { imports, aliases } = readImports(root);
    return collectPythonHelpers(root, parsed.file.path, fileContext(root, detectPythonFrameworks(parsed.file), imports, aliases));
  },

  supportFiles(parsed) {
    return parsed.tree ? supportFilesOf(parsed.file, readImports(parsed.tree.rootNode).imports) : [];
  },
};
