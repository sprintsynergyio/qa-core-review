// The generic adapter (Tier 3): which files it picks up and what it knows about each language
// (SPEC.md Section 9.5). These files have no static adapter yet. They are listed in the report
// and reviewed in LLM mode. With line patterns in the config, a few static rules run too.
// This file is the vocabulary of the adapter: every fact about a language is a table entry.
import type { LexicalSyntax, StringDelimiter } from '../../parse/lexical.js';
import type { AdapterProfile } from '../types.js';

/** Source extensions the generic adapter knows, with the language hint for each. */
export const GENERIC_LANGUAGES: Readonly<Record<string, string>> = {
  '.scala': 'scala', '.swift': 'swift', '.rs': 'rust', '.dart': 'dart', '.ex': 'elixir', '.exs': 'elixir',
  '.cpp': 'cpp', '.cc': 'cpp', '.c': 'c', '.m': 'objective-c', '.lua': 'lua', '.r': 'r', '.jl': 'julia',
  '.clj': 'clojure', '.sh': 'shell', '.bats': 'bats', '.ps1': 'powershell',
  // Tier 2 languages, until their own adapters arrive in v0.2.0.
  '.cs': 'csharp', '.go': 'go', '.rb': 'ruby', '.kt': 'kotlin', '.kts': 'kotlin', '.php': 'php',
  '.robot': 'robot', '.feature': 'gherkin', '.jmx': 'jmeter', '.postman_collection.json': 'postman',
};

/** The language hint for a file, from its extension, or null when the extension is not known. */
export function languageHintFor(filePath: string): string | null {
  const lower = filePath.toLowerCase();
  const extension = Object.keys(GENERIC_LANGUAGES).find((candidate) => lower.endsWith(candidate));
  return extension ? GENERIC_LANGUAGES[extension]! : null;
}

const DOUBLE: StringDelimiter = { open: '"', close: '"', multiline: false };
const SINGLE: StringDelimiter = { open: "'", close: "'", multiline: false };
const TRIPLE: StringDelimiter = { open: '"""', close: '"""', multiline: true };
const SLASH: Pick<LexicalSyntax, 'line' | 'block'> = { line: ['//'], block: [['/*', '*/']] };

/**
 * Comments and strings per language hint, for the lexical scanner. A single quote is a string
 * only where the language uses it for one: in Rust it starts a lifetime, in Clojure a quoted
 * form. PHP has no `#` here, because `#[Test]` is an attribute and not a comment.
 */
export const GENERIC_SYNTAX: Readonly<Record<string, LexicalSyntax>> = {
  scala: { ...SLASH, strings: [TRIPLE, DOUBLE] },
  swift: { ...SLASH, strings: [TRIPLE, DOUBLE] },
  rust: { ...SLASH, strings: [DOUBLE] },
  dart: { ...SLASH, strings: [TRIPLE, { open: "'''", close: "'''", multiline: true }, DOUBLE, SINGLE] },
  elixir: { line: ['#'], strings: [TRIPLE, DOUBLE, SINGLE] },
  cpp: { ...SLASH, strings: [DOUBLE, SINGLE] },
  c: { ...SLASH, strings: [DOUBLE, SINGLE] },
  'objective-c': { ...SLASH, strings: [DOUBLE, SINGLE] },
  lua: { line: ['--'], block: [['--[[', ']]']], strings: [DOUBLE, SINGLE] },
  r: { line: ['#'], strings: [DOUBLE, SINGLE] },
  julia: { line: ['#'], block: [['#=', '=#']], strings: [TRIPLE, DOUBLE] },
  clojure: { line: [';'], strings: [DOUBLE] },
  shell: { line: ['#'], strings: [DOUBLE, SINGLE] },
  bats: { line: ['#'], strings: [DOUBLE, SINGLE] },
  powershell: { line: ['#'], block: [['<#', '#>']], strings: [DOUBLE, SINGLE] },
  csharp: { ...SLASH, strings: [DOUBLE, SINGLE] },
  go: { ...SLASH, strings: [DOUBLE, { open: '`', close: '`', multiline: true }, SINGLE] },
  ruby: { line: ['#'], strings: [DOUBLE, SINGLE] },
  kotlin: { ...SLASH, strings: [TRIPLE, DOUBLE, SINGLE] },
  php: { ...SLASH, strings: [DOUBLE, SINGLE] },
  robot: { line: ['#'], strings: [] },
  gherkin: { line: ['#'], strings: [DOUBLE] },
  jmeter: { line: [], block: [['<!--', '-->']], strings: [DOUBLE] },
  postman: { line: [], strings: [DOUBLE] },
};

/** For a language hint that is not in the table (a config entry can name any language): nothing is known, so every line is read as code. */
const NO_SYNTAX: LexicalSyntax = { line: [], strings: [] };

export function syntaxFor(hint: string | null): LexicalSyntax {
  return (hint !== null ? GENERIC_SYNTAX[hint.toLowerCase()] : undefined) ?? NO_SYNTAX;
}

/**
 * A line that marks the test below it and is not a statement: `@Disabled`, `@tag :skip`,
 * `#[ignore]`, `[Ignore]`. Skip and focus patterns also look at such lines right above a test.
 */
export const MARKER_LINE = /^\s*(?:@|#\[|\[)/;

export const genericProfile: AdapterProfile = {
  id: 'generic',
  tier: 3,
  languages: ['generic'],
  extensions: Object.keys(GENERIC_LANGUAGES),
  frameworks: [],
  // Common test naming patterns, in any language.
  defaultInclude: ['**/*{Test,Tests,Spec,_test,_spec,.test,.spec}.*', '**/test_*.*', '**/{test,tests,spec,specs}/**/*.*'],
  defaultExclude: [],
  languageOf: () => 'generic',
  detectProject: () => null,
};
