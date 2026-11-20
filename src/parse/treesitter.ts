// The tree-sitter parser service (SPEC.md Section 7.2).
//
// One WebAssembly runtime for every language. The runtime starts on first use, and a grammar
// is loaded the first time a file of that language is parsed, then cached for the process.
// Everything is read from memory buffers through src/assets.ts, never from a path, so the same
// code runs from npm, from the standalone binary and from Docker.
import { Language, Parser, Query } from 'web-tree-sitter';
import type { Tree } from 'web-tree-sitter';
import { readAsset, readParserRuntime } from '../assets.js';

/** A parsed file. Call `tree.delete()` when done: the tree lives in WebAssembly memory. */
export type SyntaxTree = Tree;
export type { Node as SyntaxNode, Query as SyntaxQuery } from 'web-tree-sitter';

/** A file whose ERROR nodes cover more than this share of its text goes to the lexical scanner. */
export const ERROR_RATIO_LIMIT = 0.3;

/** One entry of grammars/manifest.json. */
export interface GrammarInfo {
  id: string;
  file: string;
  package: string;
  version: string;
  sourceFile: string;
  integrity: string;
  repo: string;
  license: string;
  abi: number;
  bytes: number;
  sha256: string;
}

export interface GrammarManifest {
  schemaVersion: 1;
  runtime: { package: string; version: string; abi: number; minAbi: number };
  grammars: GrammarInfo[];
}

export interface ParseResult {
  /** Null when the caller must use the lexical scanner. */
  tree: SyntaxTree | null;
  /** The share of the text covered by ERROR nodes, 0 to 1. */
  errorRatio: number;
  /** Why there is no tree: the grammar could not be loaded, or the file is too broken. */
  fallback: 'grammar-unavailable' | 'too-many-errors' | null;
}

export interface TreeSitterService {
  /** Parses `text` (LF-normalized) with a grammar from the manifest. Null when the grammar cannot be loaded. */
  parse(grammar: string, text: string): Promise<SyntaxTree | null>;
  /** Like `parse`, plus the fallback decision: more than 30% of the file in ERROR nodes means no tree. */
  parseForReview(grammar: string, text: string): Promise<ParseResult>;
  /** A compiled query for a grammar, cached. Null when the grammar cannot be loaded. Throws on a bad query. */
  query(grammar: string, source: string): Promise<Query | null>;
  /** The grammars loaded so far, in load order. */
  loadedGrammars(): string[];
  /** Why a grammar could not be loaded, or null when it loaded or was never asked for. */
  loadError(grammar: string): string | null;
}

export interface TreeSitterOptions {
  /** Reads an asset by name. The default reads from the package folder. */
  readAsset?: (name: string) => Uint8Array;
}

/** The share of the text that ERROR nodes cover, from 0 to 1. Nested errors count once. */
export function errorRatio(tree: SyntaxTree, textLength: number): number {
  if (textLength === 0 || !tree.rootNode.hasError) return 0;
  const cursor = tree.walk();
  let covered = 0;
  try {
    for (;;) {
      const node = cursor.currentNode;
      // Count an ERROR node whole and do not look inside it. Go down only where errors are.
      if (node.isError) covered += node.endIndex - node.startIndex;
      else if (node.hasError && cursor.gotoFirstChild()) continue;
      while (!cursor.gotoNextSibling()) {
        if (!cursor.gotoParent()) return Math.min(1, covered / textLength);
      }
    }
  } finally {
    cursor.delete();
  }
}

// The runtime is one per process, shared by every service.
let runtime: Promise<void> | null = null;

function startRuntime(): Promise<void> {
  runtime ??= Parser.init({
    // Hand over the bytes, so the runtime never looks for its .wasm file on disk.
    wasmBinary: readParserRuntime() as unknown as ArrayBuffer,
    locateFile: (name: string) => name,
  });
  return runtime;
}

export function createTreeSitterService(options: TreeSitterOptions = {}): TreeSitterService {
  const read = options.readAsset ?? readAsset;
  const languages = new Map<string, Promise<Language | null>>();
  const loaded: string[] = [];
  const errors = new Map<string, string>();
  const queries = new Map<string, Query>();
  let manifest: GrammarManifest | null = null;
  let parser: Parser | null = null;

  async function load(grammar: string): Promise<Language | null> {
    try {
      manifest ??= JSON.parse(Buffer.from(read('grammars/manifest.json')).toString('utf8')) as GrammarManifest;
      const info = manifest.grammars.find((entry) => entry.id === grammar);
      if (!info) throw new Error(`no grammar "${grammar}" in grammars/manifest.json`);
      const bytes = read(`grammars/${info.file}`);
      await startRuntime();
      const language = await Language.load(bytes);
      loaded.push(grammar);
      return language;
    } catch (error) {
      errors.set(grammar, error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  function language(grammar: string): Promise<Language | null> {
    let pending = languages.get(grammar);
    if (!pending) {
      pending = load(grammar);
      languages.set(grammar, pending);
    }
    return pending;
  }

  async function parse(grammar: string, text: string): Promise<SyntaxTree | null> {
    const lang = await language(grammar);
    if (!lang) return null;
    parser ??= new Parser();
    parser.setLanguage(lang);
    return parser.parse(text);
  }

  return {
    parse,
    async parseForReview(grammar, text) {
      const tree = await parse(grammar, text);
      if (!tree) return { tree: null, errorRatio: 0, fallback: 'grammar-unavailable' };
      const ratio = errorRatio(tree, text.length);
      if (ratio > ERROR_RATIO_LIMIT) {
        tree.delete();
        return { tree: null, errorRatio: ratio, fallback: 'too-many-errors' };
      }
      return { tree, errorRatio: ratio, fallback: null };
    },
    async query(grammar, source) {
      const lang = await language(grammar);
      if (!lang) return null;
      const key = `${grammar}\0${source}`;
      let compiled = queries.get(key);
      if (!compiled) {
        compiled = new Query(lang, source);
        queries.set(key, compiled);
      }
      return compiled;
    },
    loadedGrammars: () => [...loaded],
    loadError: (grammar) => errors.get(grammar) ?? null,
  };
}
