// Java: the methods of a file that contain an assertion, one level deep (SPEC.md Section 8.1,
// helper index), and what is known about a file before its bodies are read.
import path from 'node:path';
import { spanOfNode } from '../../parse/positions.js';
import type { SyntaxNode } from '../../parse/treesitter.js';
import type { ResolvedConfig } from '../../config/types.js';
import type { NFile } from '../../model/types.js';
import { matchGlob } from '../../util/glob.js';
import type { FrameworkGuess, HelperDef, SourceFile } from '../types.js';
import { readBody, type BodyContext } from './assertions.js';
import { copyEnv, emptyEnv, learnNames } from './expr.js';
import type { JavaNames } from './normalize.js';
import { annotationsOf, dottedName, statementsOf } from './syntax.js';
import { readCalls, typeName } from './body.js';
import { HOOK_ANNOTATIONS, INJECT_MOCKS_ANNOTATION, MOCKITO_PACKAGE, PLATFORM_PACKAGES, RESTASSURED_PACKAGE, TEST_ANNOTATIONS, TEST_CLASS_PREFIX, TEST_CLASS_SUFFIXES } from './vocab.js';

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

/**
 * The class under test (SPEC.md Section 9.3): from `subjectMap`, or the type of the `@InjectMocks`
 * field, or the name of the test file when the file names that class: `CartTest`, `CartTests`,
 * `CartIT` and `TestCart` test `Cart`. `name` is the simple name of the class.
 */
export function findJavaSubject(file: SourceFile, root: SyntaxNode, names: JavaNames, config: ResolvedConfig): { subject: NFile['subject']; name: string | null } {
  const map = config.rules['QCR-M001']?.options['subjectMap'];
  for (const [glob, module] of Object.entries(map !== null && typeof map === 'object' ? map : {})) {
    if (typeof module === 'string' && matchGlob(glob, file.path)) return { subject: { module, via: 'subjectMap' }, name: module.slice(module.lastIndexOf('.') + 1) };
  }
  // A class that the file imports by name is given in full: `shop.cart.Cart`. A class of the same package has no import and keeps its simple name.
  const fullName = (simple: string): string => names.imports.find((entry) => entry.names[0] === simple && entry.source.endsWith(`.${simple}`))?.source ?? simple;
  const injected = root.descendantsOfType('field_declaration').find((field) => field !== null && annotationsOf(field).some((mark) => dottedName(mark.childForFieldName('name'))?.endsWith(INJECT_MOCKS_ANNOTATION)));
  const real = typeName(injected?.childForFieldName('type')?.text);
  if (real !== null) return { subject: { module: fullName(real), via: 'class-under-test' }, name: real };
  const own = path.posix.basename(file.path, '.java');
  const suffix = TEST_CLASS_SUFFIXES.filter((candidate) => own.endsWith(candidate) && own.length > candidate.length).sort((a, b) => b.length - a.length)[0];
  const named = suffix !== undefined ? own.slice(0, -suffix.length) : own.startsWith(TEST_CLASS_PREFIX) && own.length > TEST_CLASS_PREFIX.length ? own.slice(TEST_CLASS_PREFIX.length) : null;
  // The name of the file alone proves nothing: `CheckoutFlowTest` may test a page, not a class `CheckoutFlow`. The file has to name the class,
  // and a class of a test library is not what a test is about: `SoftAssertionsTest` does not test `SoftAssertions`.
  const ofALibrary = names.imports.some((entry) => entry.framework && entry.names[0] === named);
  const used = named !== null && !ofALibrary && root.descendantsOfType('type_identifier').some((type) => type?.text === named);
  return used ? { subject: { module: fullName(named), via: 'filename' }, name: named } : { subject: null, name: null };
}

/** The name a base class has in the helper index. No call can have a name with a space in it. */
export const baseClassKey = (name: string): string => `extends ${name}`;
/** The class a class extends, by its simple name. */
export const superclassOf = (declaration: SyntaxNode): string | null => typeName(declaration.childForFieldName('superclass')?.namedChildren[0]?.text);

/**
 * For the helper index: what a class hands down to the classes that extend it (SPEC.md Section 9.3).
 * These are its hooks, with what they release and delete, and the class it extends itself.
 */
export function collectJavaBases(root: SyntaxNode, file: string, names: JavaNames, ctx: BodyContext): HelperDef[] {
  const bases: HelperDef[] = [];
  for (const declaration of root.descendantsOfType('class_declaration')) {
    const name = declaration?.childForFieldName('name')?.text;
    if (!declaration || !name) continue;
    const hooks: NonNullable<HelperDef['inherited']>['hooks'] = [];
    for (const method of statementsOf(declaration.childForFieldName('body')).filter((member) => member.type === 'method_declaration')) {
      const body = method.childForFieldName('body');
      const hook = annotationsOf(method).map((mark) => HOOK_ANNOTATIONS[names.resolve(dottedName(mark.childForFieldName('name')), (known) => known in HOOK_ANNOTATIONS) ?? '']).find((entry) => entry !== undefined);
      if (!hook || !body) continue;
      const did = readCalls([body], {
        env: methodContext(method, ctx).env, acquiredIn: 'hook', restores: hook.kind === 'afterEach' || hook.kind === 'afterAll', subject: null, resolve: names.resolve, restAssured: ctx.restAssured,
        testIdAttributes: [], parameters: new Set(), fieldMocks: new Map(),
      });
      hooks.push({ kind: hook.kind, scope: hook.global ? 'global' : 'suite', releases: [...new Set(did.releases)], data: did.data });
    }
    const superclass = superclassOf(declaration);
    if (hooks.length > 0 || superclass !== null) bases.push({ name: baseClassKey(name), owner: name, file, span: spanOfNode(declaration), inherited: { hooks, superclass } });
  }
  return bases;
}
