// Python: the functions and methods of a file that contain an assertion, one level deep
// (SPEC.md Section 8.1, helper index), and what is known about a file before its bodies are
// read.
import path from 'node:path';
import type { ResolvedConfig } from '../../config/types.js';
import type { NFile, NImport } from '../../model/types.js';
import { matchGlob } from '../../util/glob.js';
import { spanOfNode } from '../../parse/positions.js';
import type { SyntaxNode } from '../../parse/treesitter.js';
import type { FrameworkGuess, HelperDef, SourceFile } from '../types.js';
import { readBody, type BodyContext } from './assertions.js';
import { learnNames } from './expr.js';
import { ASSERTPY_MODULE, PLAYWRIGHT_ASYNC_MODULE, PLAYWRIGHT_SYNC_MODULE, SUPPORT_FILE_NAMES, TEST_FUNCTION_PREFIX } from './vocab.js';

/** `async def`: the first token of the definition. */
export const isAsync = (definition: SyntaxNode): boolean => definition.children[0]?.type === 'async';

/** The context for reading bodies in one file. `skip` holds the test functions, whose names are local to them. */
export function fileContext(root: SyntaxNode, frameworks: FrameworkGuess, imports: readonly NImport[], aliases: ReadonlyMap<string, string>, skip: ReadonlySet<number> = new Set()): BodyContext {
  const env = { locators: new Set<string>(), counts: new Set<string>(), mocks: new Set<string>(), aliases };
  learnNames(root, env, skip);
  const imported = (module: string): boolean => imports.some((entry) => entry.source === module || entry.source.startsWith(`${module}.`));
  return {
    env,
    playwright: frameworks.libraries.includes('playwright-python') || frameworks.runner === 'playwright-python',
    playwrightApi: imported(PLAYWRIGHT_ASYNC_MODULE) ? 'async' : imported(PLAYWRIGHT_SYNC_MODULE) ? 'sync' : null,
    assertpy: imported(ASSERTPY_MODULE),
    isHelper: () => false,
  };
}

/**
 * Named functions and methods whose own body holds an assertion. Calls to other helpers do not
 * count, and a function that only raises an error of its own is not a helper. Test functions
 * are left out: a test is not called by another test.
 */
export function collectPythonHelpers(root: SyntaxNode, file: string, ctx: BodyContext): HelperDef[] {
  const helpers: HelperDef[] = [];
  for (const node of root.descendantsOfType('function_definition')) {
    const name = node?.childForFieldName('name')?.text;
    const body = node?.childForFieldName('body');
    if (!node || !name || !body || name.startsWith(TEST_FUNCTION_PREFIX)) continue;
    const facts = readBody(body, { ...ctx, isHelper: () => false }, { async: isAsync(node) });
    const checks = facts.assertions.filter((assertion) => assertion.library !== 'raise' || /\bAssertionError\b/.test(assertion.text));
    if (checks.length === 0 && !facts.expectsException) continue;
    let owner: SyntaxNode | null = node.parent;
    while (owner && owner.type !== 'class_definition' && owner.type !== 'function_definition') owner = owner.parent;
    helpers.push({ name, owner: owner?.type === 'class_definition' ? owner.childForFieldName('name')?.text ?? null : null, file, span: spanOfNode(node) });
  }
  return helpers;
}

/**
 * The module a test file is about (SPEC.md Section 8.1): a `subjectMap` entry of QCR-M001, or the
 * import that has the name of the test file: `test_cart.py` and `from shop.cart import Cart`,
 * `import shop.cart` or `from shop import cart`. `names` are the local names that stand for the
 * module or for something imported from it.
 */
export function findSubject(filePath: string, imports: readonly NImport[], aliases: ReadonlyMap<string, string>, config: ResolvedConfig): { subject: NFile['subject']; names: Set<string> } {
  const namesOf = (module: string): Set<string> => new Set([...aliases].filter(([, value]) => value === module || value.startsWith(`${module}.`)).map(([name]) => name));
  const map = config.rules['QCR-M001']?.options['subjectMap'];
  for (const [glob, module] of Object.entries(map !== null && typeof map === 'object' ? map : {})) {
    if (typeof module === 'string' && matchGlob(glob, filePath)) return { subject: { module, via: 'subjectMap' }, names: namesOf(module) };
  }
  const own = path.posix.basename(filePath, '.py').replace(/^test_|_test$/g, '').toLowerCase();
  for (const entry of imports.filter((candidate) => !candidate.typeOnly && !candidate.framework)) {
    const module = entry.source.split('.').at(-1)!.toLowerCase() === own ? entry.source : entry.names.some((name) => name.toLowerCase() === own) ? `${entry.source}.${entry.names.find((name) => name.toLowerCase() === own)}`.replace(/^(\.+)\./, '$1') : null;
    // The names of the import itself count too: a relative import has no entry in `aliases`.
    if (module !== null && own !== '') return { subject: { module, via: 'filename' }, names: new Set([...namesOf(module), ...(module === entry.source ? entry.names.filter((name) => name !== '*') : [own])]) };
  }
  return { subject: null, names: new Set() };
}

/**
 * Where the helpers of a file may come from: the local modules it imports, and the conftest.py
 * files beside it and above it. Returns root-relative guesses; not all of them exist.
 */
export function supportFilesOf(file: SourceFile, imports: readonly NImport[]): string[] {
  const dir = path.posix.dirname(file.path);
  const projectDir = file.project?.dir ?? '.';
  const guesses: string[] = [];
  const add = (base: string, module: string, names: readonly string[]): void => {
    const target = path.posix.join(base, ...module.split('.').filter((part) => part !== ''));
    // `from pkg import name`: the name may be a module of the package.
    for (const candidate of [target, ...names.filter((name) => name !== '*').map((name) => path.posix.join(target, name))]) {
      // `from . import name`: the package itself is a folder, never a file.
      guesses.push(...(candidate === target && module === '' ? [] : [`${candidate}.py`]), `${candidate}/__init__.py`);
    }
  };
  for (const entry of imports.filter((candidate) => !candidate.framework)) {
    const dots = /^\.*/.exec(entry.source)![0].length;
    if (dots > 0) add(path.posix.join(dir, ...Array<string>(dots - 1).fill('..')), entry.source.slice(dots), entry.names);
    else for (const base of new Set([projectDir, '.'])) add(base, entry.source, entry.names);
  }
  // conftest.py of this folder and of each folder above it, up to the project.
  for (let current = dir; ; current = path.posix.dirname(current)) {
    for (const name of SUPPORT_FILE_NAMES.slice(0, 1)) guesses.push(path.posix.join(current, name));
    if (current === '.' || current === projectDir || current === '/') break;
  }
  return [...new Set(guesses.map((guess) => path.posix.normalize(guess)))].filter((guess) => !guess.startsWith('..') && guess !== file.path);
}
