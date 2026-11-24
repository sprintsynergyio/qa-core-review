// The language adapter interface (SPEC.md Section 7.3).
//
// An adapter owns everything that is specific to one language: how to find its projects and
// test files, how to parse them, and how to turn a parsed file into the normalized model.
import type { ResolvedConfig } from '../config/types.js';
import type { Capability, FrameworkId, LanguageId, NFile, ParseStatus, Span, Tier } from '../model/types.js';
import type { SyntaxTree, TreeSitterService } from '../parse/treesitter.js';
import type { Rule } from '../rules/types.js';

export type { Capability, Tier } from '../model/types.js';
export type { SyntaxTree, TreeSitterService } from '../parse/treesitter.js';

/**
 * How a framework shows up in a project. `file` is a manifest or config file name, or a glob
 * (`package.json`, `pom.xml`, `playwright.config.*`). With `contains`, the file must mention
 * that dependency name. Without it, the file being there is the marker.
 */
export interface ProjectMarker {
  file: string;
  contains?: string;
}

export interface FrameworkDescriptor {
  /** 'playwright', 'pytest', 'junit5', and so on. */
  id: FrameworkId;
  /** pytest is a runner. selenium is a library. */
  role: 'runner' | 'library';
  displayName: string;
  projectMarkers: ProjectMarker[];
  /** Import or annotation patterns that prove the framework is used in a file. */
  fileMarkers: string[];
}

/** A read-only view of one folder. Detection only reads files. It never runs code. */
export interface ProjectProbe {
  /** Root-relative, with '/' separators. */
  dir: string;
  hasFile(name: string): boolean;
  readText(name: string, maxBytes?: number): string | null;
  list(globPattern: string, limit: number): string[];
}

export interface DetectedProject {
  dir: string;
  adapterId: string;
  languages: LanguageId[];
  /** Runners and libraries found in manifests. */
  frameworks: FrameworkId[];
  /** For example 'pom.xml: org.junit.jupiter'. */
  evidence: string[];
  /**
   * Set by a detector when only a secondary file was found (a lone `tsconfig.json` or
   * `conftest.py`). Detection drops a weak project when the same adapter has a project above
   * it, so the folder does not hide the frameworks of the real manifest. Never in the output.
   */
  weak?: boolean;
}

export interface SourceFile {
  /** Root-relative, with '/' separators. */
  path: string;
  absPath: string;
  /** LF-normalized, so positions are the same on every OS. */
  text: string;
  language: LanguageId;
  project: DetectedProject | null;
}

/** A function or method that contains an assertion, found by an adapter in any project file. */
export interface HelperDef {
  name: string;
  /** The class that owns the method, when there is one. */
  owner: string | null;
  file: string;
  span: Span;
}

/** Assertion helpers from every file of a project (SPEC.md Section 8.1). Built from Milestone 6. */
export interface HelperIndex {
  has(name: string): boolean;
  get(name: string): HelperDef[];
}

export interface AdapterContext {
  config: ResolvedConfig;
  helperIndex: HelperIndex;
  parser: TreeSitterService;
}

/** The result of `parse`: a syntax tree, or lexical tokens from the fallback scanner. */
export interface ParsedFile {
  file: SourceFile;
  tree: SyntaxTree | null;
  /** Tokens from the lexical scanner, when the tree is missing or too broken to use. */
  tokens: readonly unknown[] | null;
  parseStatus: ParseStatus;
}

export interface FrameworkGuess {
  runner: FrameworkId;
  libraries: FrameworkId[];
  confidence: 'high' | 'medium' | 'low';
}

/**
 * The part of an adapter that finds projects and test files. It needs no parser, so detection
 * and discovery work for a language before (and without) the rest of its adapter.
 */
export interface AdapterProfile {
  /** 'js', 'python', 'java', 'generic', and so on. */
  id: string;
  tier: Tier;
  languages: LanguageId[];
  /** Lower case, with the dot: ['.py']. */
  extensions: string[];
  frameworks: FrameworkDescriptor[];
  /** Globs for test files. */
  defaultInclude: string[];
  defaultExclude: string[];
  /** The language of a file this adapter claims, from its name. */
  languageOf(filePath: string): LanguageId;
  detectProject(probe: ProjectProbe): DetectedProject | null;
}

export interface LanguageAdapter extends AdapterProfile {
  /** Grammar ids from grammars/manifest.json. */
  grammars: string[];
  /** For suppression comments and fixture markers. */
  commentSyntax: { line: string[]; block?: [string, string][] };
  /** What `normalize` fills in reliably. Leave a capability out when in doubt. */
  capabilities: Capability[];

  classifyFile(file: SourceFile): 'test' | 'support' | 'ignore';
  detectFrameworks(file: SourceFile, tree: SyntaxTree | null): FrameworkGuess;
  parse(file: SourceFile, ctx: AdapterContext): Promise<ParsedFile>;
  normalize(parsed: ParsedFile, ctx: AdapterContext): NFile;
  /** For the helper index. */
  collectHelpers?(parsed: ParsedFile): HelperDef[];
  /**
   * For the helper index: root-relative paths of local files this file loads and that may hold
   * assertion helpers, such as a page object it imports. Several guesses per import are fine
   * (`./pages/cart.ts`, `./pages/cart/index.ts`); the engine keeps the ones that exist.
   */
  supportFiles?(parsed: ParsedFile): string[];
  /** Framework-specific rules owned by this adapter. */
  rules?: Rule[];
}
