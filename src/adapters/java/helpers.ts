// Java: the methods of a file that contain an assertion, one level deep (SPEC.md Section 8.1,
// helper index), and what is known about a file before its bodies are read.
import path from 'node:path';
import { spanOfNode } from '../../parse/positions.js';
import type { SyntaxNode } from '../../parse/treesitter.js';
import type { FrameworkGuess, HelperDef, SourceFile } from '../types.js';
import { readBody, type BodyContext } from './assertions.js';
import { copyEnv, emptyEnv, learnNames } from './expr.js';
import type { JavaNames } from './normalize.js';
import { annotationsOf, dottedName } from './syntax.js';
import { HOOK_ANNOTATIONS, MOCKITO_PACKAGE, PLATFORM_PACKAGES, RESTASSURED_PACKAGE, TEST_ANNOTATIONS } from './vocab.js';

const under = (home: string, name: string): boolean => name === home || name.startsWith(`${home}.`);

/** The context for reading bodies in one file: what its fields hold, and which libraries it imports. */
export function fileContext(root: SyntaxNode, frameworks: FrameworkGuess, names: JavaNames): BodyContext {
  const env = emptyEnv();
  for (const field of root.descendantsOfType('field_declaration')) if (field) learnNames(field, env);
  return {
    env,
    resolve: names.resolve,
    runner: frameworks.runner,
    restAssured: names.imports.some((entry) => under(RESTASSURED_PACKAGE, entry.source)),
    mockito: names.imports.some((entry) => under(MOCKITO_PACKAGE, entry.source)),
    isHelper: () => false,
  };
}

/** The context of one method: the fields of the file, with the parameters and the local names of the method on top. */
export function methodContext(method: SyntaxNode, shared: BodyContext): BodyContext {
  const env = copyEnv(shared.env);
  learnNames(method, env);
  return { ...shared, env };
}

/**
 * Methods whose own body holds an assertion. Calls to other helpers do not count, and a method
 * that only throws an error of its own is not a helper. Tests and hooks are left out: nothing
 * calls them.
 */
export function collectJavaHelpers(root: SyntaxNode, file: string, ctx: BodyContext): HelperDef[] {
  const helpers: HelperDef[] = [];
  const runsByItself = (name: string): boolean => name in TEST_ANNOTATIONS || name in HOOK_ANNOTATIONS;
  for (const node of root.descendantsOfType('method_declaration')) {
    const name = node?.childForFieldName('name')?.text;
    const body = node?.childForFieldName('body');
    if (!node || !name || !body) continue;
    if (annotationsOf(node).some((mark) => runsByItself(ctx.resolve(dottedName(mark.childForFieldName('name')), runsByItself) ?? ''))) continue;
    const facts = readBody(body, { ...methodContext(node, ctx), isHelper: () => false });
    const checks = facts.assertions.filter((assertion) => assertion.library !== 'throw' || /\bAssertion\w*Error\b/.test(assertion.text));
    if (checks.length === 0 && !facts.expectsException) continue;
    let owner: SyntaxNode | null = node.parent;
    while (owner && !/^(class|interface|record|enum)_declaration$|^object_creation_expression$/.test(owner.type)) owner = owner.parent;
    // A method of an anonymous class has no name to call it by from outside: `new Runnable() { public void run() { ... } }`.
    if (owner?.type === 'object_creation_expression') continue;
    helpers.push({ name, owner: owner?.childForFieldName('name')?.text ?? null, file, span: spanOfNode(node) });
  }
  return helpers;
}

/**
 * Where the helpers of a file may come from: the classes of the project it imports, and the
 * classes of its own package that it names (a base class, a page object, a class of checks),
 * which need no import in Java. Returns root-relative guesses; not all of them exist.
 */
export function supportFilesOf(file: SourceFile, root: SyntaxNode, names: JavaNames): string[] {
  const dir = path.posix.dirname(file.path);
  const declared = dottedName(root.namedChildren.find((node) => node.type === 'package_declaration')?.namedChildren.find((node) => node.type === 'scoped_identifier' || node.type === 'identifier')) ?? '';
  const packageDir = declared.split('.').filter((part) => part !== '').join('/');
  // `src/test/java/shop/cart` with the package `shop.cart` has the source root `src/test/java`.
  const sourceRoot = packageDir !== '' && (dir === packageDir || dir.endsWith(`/${packageDir}`)) ? dir.slice(0, dir.length - packageDir.length).replace(/\/$/, '') || '.' : null;
  const guesses: string[] = [];
  for (const entry of names.imports.filter((candidate) => !candidate.framework && !PLATFORM_PACKAGES.some((home) => under(home, candidate.source)))) {
    if (sourceRoot === null) continue;
    const parts = entry.source.split('.');
    // `import shop.pages.LoginPage;`, and `import shop.pages.LoginPage.Banner;` for a class inside it: the file has the name of the outer class.
    const outer = parts.findIndex((part) => /^[A-Z]/.test(part));
    if (outer >= 0) guesses.push(`${path.posix.join(sourceRoot, ...parts.slice(0, outer + 1))}.java`);
  }
  const own = new Set<string>();
  for (const type of root.descendantsOfType('type_identifier')) if (type) own.add(type.text);
  for (const call of root.descendantsOfType('method_invocation')) {
    const object = call?.childForFieldName('object');
    if (object?.type === 'identifier' && /^[A-Z]/.test(object.text)) own.add(object.text);
  }
  const imported = new Set(names.imports.flatMap((entry) => entry.names));
  for (const name of own) if (!imported.has(name)) guesses.push(path.posix.join(dir, `${name}.java`));
  return [...new Set(guesses.map((guess) => path.posix.normalize(guess)))].filter((guess) => !guess.startsWith('..') && guess !== file.path);
}
