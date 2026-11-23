// JS/TS: the functions and methods of a file that contain an assertion, one level deep
// (SPEC.md Section 8.1, helper index), and what a file's `expect` and `assert` stand for.
import type { ResolvedConfig } from '../../config/types.js';
import type { NFile, NImport } from '../../model/types.js';
import { spanOfNode } from '../../parse/positions.js';
import type { SyntaxNode } from '../../parse/treesitter.js';
import { matchGlob } from '../../util/glob.js';
import type { FrameworkGuess, HelperDef } from '../types.js';
import { readBody, type BodyContext } from './assertions.js';
import { learnNames } from './expr.js';
import { argumentsOf, isFunction, stringValue } from './syntax.js';
import { ASSERT_ROOT, CYPRESS_COMMAND_DEFINERS, EXPECT_LIBRARY_BY_MODULE, EXPECT_LIBRARY_BY_RUNNER, EXPECT_ROOT } from './vocab.js';

/** The context for reading bodies in one file. `skip` holds the test functions, whose names are local to them. */
export function fileContext(root: SyntaxNode, frameworks: FrameworkGuess, imports: readonly NImport[], skip: ReadonlySet<number> = new Set()): BodyContext {
  const uses = (id: string): boolean => frameworks.runner === id || frameworks.libraries.some((library) => library === id);
  const env = { locators: new Set<string>(), counts: new Set<string>(), mocks: new Set<string>(), playwright: uses('playwright'), webdriverio: uses('webdriverio') };
  learnNames(root, env, skip);
  const moduleOf = (name: string): string | undefined => imports.find((entry) => entry.names.includes(name))?.source;
  return {
    env,
    expectLibrary: EXPECT_LIBRARY_BY_MODULE[moduleOf(EXPECT_ROOT) ?? ''] ?? EXPECT_LIBRARY_BY_RUNNER[frameworks.runner] ?? 'expect',
    assertLibrary: moduleOf(ASSERT_ROOT) === 'chai' || (moduleOf(ASSERT_ROOT) === undefined && frameworks.runner === 'cypress') ? 'chai' : 'node-assert',
    isHelper: () => false,
  };
}

const NAMED_FUNCTIONS = ['function_declaration', 'generator_function_declaration', 'method_definition', 'variable_declarator', 'public_field_definition', 'field_definition', 'call_expression'];

/**
 * Named functions, methods and custom Cypress commands whose own body holds an assertion. Calls
 * to other helpers do not count.
 */
export function collectJsHelpers(root: SyntaxNode, file: string, ctx: BodyContext): HelperDef[] {
  const helpers: HelperDef[] = [];
  for (const node of root.descendantsOfType(NAMED_FUNCTIONS)) {
    // `Cypress.Commands.add('name', fn)`, or a declaration with a name and a function body.
    const command = node.type === 'call_expression';
    if (command && !CYPRESS_COMMAND_DEFINERS.some((definer) => definer === node.childForFieldName('function')?.text)) continue;
    const name = command ? argumentsOf(node)[0] : node.childForFieldName('name') ?? node.childForFieldName('property');
    const value = command ? argumentsOf(node).at(-1) : node.childForFieldName('value');
    const body = (value && isFunction(value) ? value : node).childForFieldName('body');
    const text = command ? stringValue(name ?? null) : name?.text;
    if (!text || !body || (value && !isFunction(value)) || !/^[\w$#]+$/.test(text)) continue;
    const facts = readBody(body, { ...ctx, isHelper: () => false });
    if (facts.assertions.length === 0 && !facts.expectsException) continue;
    let owner: SyntaxNode | null = node.parent;
    while (owner && owner.type !== 'class_declaration' && owner.type !== 'class') owner = owner.parent;
    helpers.push({ name: text, owner: owner?.childForFieldName('name')?.text ?? null, file, span: spanOfNode(node) });
  }
  return helpers;
}

/**
 * The module a test file is about (SPEC.md Section 9.1): the `subjectMap` of the config (a glob
 * of test files to a module), or the import whose last part is the test file's own name
 * (`cart.test.ts` and `./cart`, `../src/cart` or `@/cart`).
 */
export function findSubject(filePath: string, imports: readonly NImport[], config: ResolvedConfig): NFile['subject'] {
  const map = config.rules['QCR-M001']?.options['subjectMap'];
  for (const [glob, module] of Object.entries(map !== null && typeof map === 'object' ? map : {})) {
    if (typeof module === 'string' && matchGlob(glob, filePath)) return { module, via: 'subjectMap' };
  }
  const lastPart = (path: string): string => path.split('/').at(-1)!.replace(/\.[cm]?[jt]sx?$/, '').toLowerCase();
  const own = lastPart(filePath).replace(/\.(test|spec|cy|e2e)$/, '');
  const match = imports.find((entry) => !entry.typeOnly && !entry.framework && lastPart(entry.source) === own);
  return match ? { module: match.source, via: 'filename' } : null;
}
