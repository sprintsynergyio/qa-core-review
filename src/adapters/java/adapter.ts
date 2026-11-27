// The Java adapter (SPEC.md Section 9.3): JUnit 4, JUnit 5 and TestNG, with Selenium,
// REST Assured and Playwright for Java as libraries.
import { JAVA_LEXICAL, scanLines } from '../../parse/lexical.js';
import type { LanguageAdapter, SourceFile } from '../types.js';
import { javaProfile } from './detect.js';
import { detectJavaFrameworks } from './frameworks.js';
import { collectJavaBases, collectJavaHelpers, fileContext, supportFilesOf } from './helpers.js';
import { normalizeJavaLexical } from './lexical.js';
import { JAVA_CAPABILITIES, normalizeJava, readImports } from './normalize.js';
import { TEST_ANNOTATIONS } from './vocab.js';

const TEST_NAMES = [...new Set(Object.keys(TEST_ANNOTATIONS).map((name) => name.slice(name.lastIndexOf('.') + 1)))];
/** `@Test`, `@ParameterizedTest(...)`, `@org.junit.jupiter.api.Test`: a test annotation as it is written. */
const DECLARES = new RegExp(`@(?:[\\w.]+\\.)?(?:${TEST_NAMES.join('|')})\\b`);

/** A quick look at the text, before any parsing: does the file have a test annotation? Strings and comments do not count. */
const declaresTests = (file: SourceFile): boolean => scanLines(file.text, JAVA_LEXICAL).some((line) => DECLARES.test(line.codeNoStrings));

export const javaAdapter: LanguageAdapter = {
  ...javaProfile,
  grammars: ['java'],
  commentSyntax: { line: ['//'], block: [['/*', '*/']] },
  capabilities: [...JAVA_CAPABILITIES],

  /** A file under `src/test` with no test method is a support file: a base class, a page object, a utility. */
  classifyFile: (file) => (declaresTests(file) ? 'test' : 'support'),

  detectFrameworks: (file) => detectJavaFrameworks(file),

  async parse(file, ctx) {
    const result = await ctx.parser.parseForReview('java', file.text);
    // No tree: the grammar is unavailable or the file is too broken.
    if (!result.tree) return { file, tree: null, tokens: null, parseStatus: 'failed' };
    return { file, tree: result.tree, tokens: null, parseStatus: result.tree.rootNode.hasError ? 'partial' : 'ok' };
  },

  normalize(parsed, ctx) {
    const frameworks = detectJavaFrameworks(parsed.file);
    // With no tree the lexical scanner still finds the test methods, the lines that assert and the fixed sleeps.
    return parsed.tree ? normalizeJava(parsed, frameworks, ctx) : normalizeJavaLexical(parsed.file, frameworks, ctx, declaresTests(parsed.file) ? 'test' : 'support');
  },

  /** For the helper index: the methods of any file, test or support, that contain an assertion, and what each class hands down to the classes that extend it. */
  collectHelpers(parsed) {
    if (!parsed.tree) return [];
    const root = parsed.tree.rootNode;
    const frameworks = detectJavaFrameworks(parsed.file);
    const names = readImports(root, frameworks.runner);
    const shared = fileContext(root, frameworks, names);
    return [...collectJavaHelpers(root, parsed.file.path, shared), ...collectJavaBases(root, parsed.file.path, names, shared)];
  },

  supportFiles(parsed) {
    if (!parsed.tree) return [];
    const root = parsed.tree.rootNode;
    return supportFilesOf(parsed.file, root, readImports(root, detectJavaFrameworks(parsed.file).runner));
  },
};
