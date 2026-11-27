// Java: from a syntax tree to the normalized model (SPEC.md Sections 8.1 and 9.3).
//
// This file finds the structure of a test file: suites (classes and the classes inside them),
// tests, hooks, skips, parameterized tests, imports and suppression comments. What each body
// checks is read by assertions.ts. What a body does (waits, selectors, mocks, resources) is
// read by the next part of the adapter.
import { emptyTest, parseSuppression } from '../../model/build.js';
import { bodyHash, testId } from '../../model/hash.js';
import type { Capability, FrameworkId, NFile, NHook, NImport, NSuite, NSuppression, NTest } from '../../model/types.js';
import { spanOfNode } from '../../parse/positions.js';
import type { SyntaxNode } from '../../parse/treesitter.js';
import type { AdapterContext, FrameworkGuess, ParsedFile, SourceFile } from '../types.js';
import { readBody } from './assertions.js';
import { frameworkOf } from './frameworks.js';
import { collectJavaHelpers, fileContext, methodContext } from './helpers.js';
import { annotationsOf, dottedName, elementsOf, hasAncestor, hasModifier, isComment, itemsOf, ownDescendants, statementsOf, stringValue, tokensOf } from './syntax.js';
import {
  ARGUMENT_SOURCES, CLASS_TEST_ANNOTATION, CONDITION_ANNOTATIONS, CONDITION_PACKAGE, CONDITION_REASON_ELEMENT, DATA_PROVIDER_ANNOTATION, DATA_PROVIDER_ELEMENT,
  DATA_PROVIDER_NAME_ELEMENT, DESCRIPTION_ELEMENT, DISPLAY_NAME_ANNOTATION, ENABLED_ELEMENT, EXPECTED_EXCEPTION_ELEMENTS, HOOK_ANNOTATIONS, NESTED_ANNOTATION, PARAMETERIZED_RUNNERS, PARAMETERS_ANNOTATION,
  JUNIT3_BASES, ROW_WRAPPERS, RUN_WITH_ANNOTATION, SHARED_JUNIT_PACKAGES, SKIP_ANNOTATIONS, SKIP_CALLS, SOURCE_SETTING_ELEMENTS, TEST_ANNOTATIONS, TEST_CLASS_SUFFIXES,
  TEST_LIBRARY_PACKAGES, THROWN_SKIPS, UNCOUNTED_SOURCE_ELEMENTS,
} from './vocab.js';

/** What the adapter fills in so far: the structure of a file, and what its bodies check. */
export const JAVA_CAPABILITIES: Capability[] = [
  'tests', 'suites', 'hooks', 'modifiers', 'parameterized', 'assertions', 'assertion-operands', 'try-blocks', 'body-hash', 'helpers', 'reachability',
];

const TYPE_DECLARATIONS = new Set(['class_declaration', 'interface_declaration', 'record_declaration', 'enum_declaration']);
const BRANCHES = new Set([
  'if_statement', 'ternary_expression', 'switch_expression', 'switch_statement', 'for_statement', 'enhanced_for_statement', 'while_statement', 'do_statement', 'try_statement',
]);
const CONDITIONS = CONDITION_ANNOTATIONS.map((name) => `${CONDITION_PACKAGE}.${name}`);
/** Every annotation of the vocabulary, by its full name. */
const KNOWN_ANNOTATIONS = new Set([
  ...Object.keys(TEST_ANNOTATIONS), ...Object.keys(HOOK_ANNOTATIONS), NESTED_ANNOTATION, DISPLAY_NAME_ANNOTATION, ...Object.keys(SKIP_ANNOTATIONS), ...CONDITIONS,
  ...Object.keys(ARGUMENT_SOURCES), DATA_PROVIDER_ANNOTATION, RUN_WITH_ANNOTATION, PARAMETERS_ANNOTATION,
]);
const lastPart = (name: string): string => name.slice(name.lastIndexOf('.') + 1);

type Skip = NonNullable<NTest['skip']>;
type Generated = NonNullable<NTest['parameterized']>;

/** An annotation as written on a declaration, with its full name when the imports or the vocabulary tell it. */
interface Annotation {
  name: string;
  elements: Map<string, SyntaxNode>;
}

interface Scope {
  suite: NSuite | null;
  path: string[];
  /** From `@RunWith(Parameterized.class)` on the class: it makes every test of the class many tests. */
  inherited: Generated | null;
}

/** What the imports of a file say about the names used in it. */
export interface JavaNames {
  imports: NImport[];
  /** The full name behind a name as it is written: `Test`, `Assumptions.assumeTrue`, `assumeTrue`. Null when nothing tells. */
  resolve(written: string | null, known: (name: string) => boolean): string | null;
}

/** The imports of a file. `import a.b.C;` names one class, `import static a.b.C.m;` one member, and `.*` every name of a package or class. */
export function readImports(root: SyntaxNode, runner: FrameworkId): JavaNames {
  const imports: NImport[] = [];
  const names = new Map<string, string>();
  const wildcards: string[] = [];
  for (const statement of root.namedChildren.filter((node) => node.type === 'import_declaration')) {
    const path = dottedName(statement.namedChildren.find((node) => node.type === 'scoped_identifier' || node.type === 'identifier'));
    if (path === null) continue;
    const isStatic = statement.children.some((child) => child?.type === 'static');
    const wildcard = statement.namedChildren.some((node) => node.type === 'asterisk');
    // `import static a.b.C.m;` takes `m` from the class `a.b.C`. Any other import is the class or the package itself.
    const source = isStatic && !wildcard ? path.slice(0, path.lastIndexOf('.')) : path;
    if (wildcard) wildcards.push(path);
    else names.set(lastPart(path), path);
    const framework = frameworkOf(source) !== null || [...TEST_LIBRARY_PACKAGES, ...SHARED_JUNIT_PACKAGES].some((home) => source === home || source.startsWith(`${home}.`));
    imports.push({ span: spanOfNode(statement), source, names: [wildcard ? '*' : lastPart(path)], typeOnly: false, framework });
  }
  const resolve = (written: string | null, known: (name: string) => boolean): string | null => {
    if (written === null) return null;
    const dot = written.indexOf('.');
    const head = dot < 0 ? written : written.slice(0, dot);
    const imported = names.get(head);
    if (imported !== undefined) return imported + (dot < 0 ? '' : written.slice(dot));
    // Written in full: `@org.junit.jupiter.api.Test`.
    if (dot >= 0 && /^[a-z]/.test(head)) return written;
    const through = wildcards.map((home) => `${home}.${written}`).find(known);
    if (through !== undefined) return through;
    // Not imported at all, as in a piece of a file: a name of the vocabulary is taken as that, for the runner of the file.
    const candidates = [...KNOWN_ANNOTATIONS].filter((name) => name.endsWith(`.${written}`) && known(name));
    return candidates.find((name) => frameworkOf(name) === runner) ?? (runner === 'unknown' ? candidates[0] ?? null : null);
  };
  return { imports, resolve };
}

/** Suppression comments. The whole-file form only counts before the first line of code, the `package` line included. */
function readSuppressions(root: SyntaxNode): NSuppression[] {
  const first = root.namedChildren.find((node) => !isComment(node));
  const suppressions: NSuppression[] = [];
  for (const comment of [...root.descendantsOfType('line_comment'), ...root.descendantsOfType('block_comment')].sort((a, b) => a!.startIndex - b!.startIndex)) {
    const suppression = comment && parseSuppression(comment.text, spanOfNode(comment));
    if (!suppression) continue;
    if (suppression.scope === 'file' && first && comment.startIndex > first.startIndex) continue;
    suppressions.push(suppression);
  }
  return suppressions;
}

/** The members of a class, an interface, a record or an enum. In an enum they come after the constants. */
function membersOf(declaration: SyntaxNode): SyntaxNode[] {
  const body = declaration.childForFieldName('body');
  const inner = body?.namedChildren.find((node) => node.type === 'enum_body_declarations');
  return statementsOf(inner ?? body);
}

/** The number of rows a data method returns, when they are written out: `return new Object[][] { {1}, {2} };`. */
function rowsOf(method: SyntaxNode | undefined): number | null {
  const returns = method ? ownDescendants(method, new Set(['return_statement'])) : [];
  if (returns.length !== 1) return null;
  let value = returns[0]!.namedChildren.find((node) => !isComment(node));
  for (;;) {
    if (value?.type === 'array_creation_expression') value = value.childForFieldName('value') ?? undefined;
    else if (value?.type === 'method_invocation' && ROW_WRAPPERS.includes(`${dottedName(value.childForFieldName('object'))}.${value.childForFieldName('name')?.text}`)) {
      const given = statementsOf(value.childForFieldName('arguments'));
      // `Arrays.asList(new Object[][] { ... })` wraps the rows. `List.of(a, b, c)` lists them.
      if (given.length !== 1 || given[0]!.type !== 'array_creation_expression') return given.length === 0 ? null : given.length;
      value = given[0];
    } else break;
  }
  return value?.type === 'array_initializer' ? itemsOf(value).length : null;
}

const baseName = (filePath: string): string => filePath.slice(filePath.lastIndexOf('/') + 1);

/**
 * A class that is named like a test class and has a method that looks like a test with no
 * annotation on it: `void addsAnItem() { ... }`. The author most likely forgot `@Test`, and
 * such a method never runs. A base class (abstract, or with hooks) is not one of these.
 */
function looksLikeForgottenTests(declaration: SyntaxNode): boolean {
  const name = declaration.childForFieldName('name')?.text ?? '';
  if (declaration.type !== 'class_declaration' || !TEST_CLASS_SUFFIXES.some((suffix) => name.endsWith(suffix)) || hasModifier(declaration, 'abstract')) return false;
  if (JUNIT3_BASES.includes(dottedName(declaration.childForFieldName('superclass')?.namedChildren[0]) ?? '')) return false;
  return membersOf(declaration).some((member) =>
    member.type === 'method_declaration' && member.childForFieldName('body') !== null && member.childForFieldName('type')?.type === 'void_type' &&
    statementsOf(member.childForFieldName('parameters')).length === 0 && annotationsOf(member).length === 0 && !hasModifier(member, 'static') && !hasModifier(member, 'private'));
}

/** The model of a file with no syntax tree: nothing is known about it but its name and what its text names. */
export function unparsedJava(file: SourceFile, frameworks: FrameworkGuess, ctx: AdapterContext, parseStatus: NFile['parseStatus'], role: NFile['role']): NFile {
  return {
    path: file.path,
    language: 'java',
    languageHint: null,
    adapter: 'java',
    tier: 1,
    runner: ctx.config.framework === 'auto' ? frameworks.runner : ctx.config.framework,
    libraries: frameworks.libraries,
    role,
    parseStatus,
    capabilities: [],
    suites: [],
    tests: [],
    fileHooks: [],
    fileMocks: [],
    fileResources: [],
    imports: [],
    subject: null,
    suppressions: [],
  };
}

export function normalizeJava(parsed: ParsedFile, frameworks: FrameworkGuess, ctx: AdapterContext): NFile {
  const { file } = parsed;
  const model = unparsedJava(file, frameworks, ctx, parsed.parseStatus, 'support');
  model.capabilities = [...JAVA_CAPABILITIES];
  const root = parsed.tree!.rootNode; // the adapter calls this only with a tree
  const names = readImports(root, frameworks.runner);
  const { imports, resolve } = names;
  model.imports = imports;
  const shared = fileContext(root, frameworks, names);
  const local = new Set(collectJavaHelpers(root, file.path, shared).map((helper) => helper.name));
  const isHelper = (name: string): boolean => local.has(name) || ctx.helperIndex.has(name) || ctx.config.assertionHelpers.includes(name);
  const read = (method: SyntaxNode, body: SyntaxNode): ReturnType<typeof readBody> => readBody(body, { ...methodContext(method, shared), isHelper });
  model.suppressions = readSuppressions(root);
  const seen = new Map<string, number>();

  const annotations = (declaration: SyntaxNode): Annotation[] => annotationsOf(declaration).map((node) => {
    const written = dottedName(node.childForFieldName('name'));
    return { name: resolve(written, (name) => KNOWN_ANNOTATIONS.has(name)) ?? written ?? '', elements: elementsOf(node) };
  });
  const titleOf = (declaration: SyntaxNode, marks: readonly Annotation[]): string =>
    stringValue(marks.find((mark) => mark.name === DISPLAY_NAME_ANNOTATION)?.elements.get('value')) ?? declaration.childForFieldName('name')?.text ?? baseName(file.path);

  /** `@Disabled("why")`, `@Ignore`, `@Test(enabled = false, description = "why")`, or a condition such as `@DisabledOnOs`. */
  const skipOf = (marks: readonly Annotation[]): Skip | null => {
    for (const mark of marks) {
      const reason = SKIP_ANNOTATIONS[mark.name];
      if (reason !== undefined) return { unconditional: true, conditional: false, reason: stringValue(mark.elements.get(reason)) };
      if (mark.name === CLASS_TEST_ANNOTATION && mark.elements.get(ENABLED_ELEMENT)?.type === 'false') {
        return { unconditional: true, conditional: false, reason: stringValue(mark.elements.get(DESCRIPTION_ELEMENT)) };
      }
    }
    const condition = marks.find((mark) => CONDITIONS.includes(mark.name));
    return condition ? { unconditional: false, conditional: true, reason: stringValue(condition.elements.get(CONDITION_REASON_ELEMENT)) } : null;
  };

  /** `assumeTrue(isLinux(), "linux only")` or `throw new SkipException("why")` inside a test body. */
  const skipInBody = (body: SyntaxNode): Skip | null => {
    for (const node of ownDescendants(body, new Set(['method_invocation', 'throw_statement']))) {
      let always: boolean;
      let given: SyntaxNode | null;
      if (node.type === 'throw_statement') {
        const thrown = node.namedChildren.find((child) => child.type === 'object_creation_expression');
        if (!THROWN_SKIPS.includes(resolve(dottedName(thrown?.childForFieldName('type')), (name) => THROWN_SKIPS.includes(name)) ?? '')) continue;
        [always, given] = [true, thrown!.childForFieldName('arguments')];
      } else {
        const object = node.childForFieldName('object');
        const written = `${object ? `${dottedName(object)}.` : ''}${node.childForFieldName('name')?.text}`;
        const call = SKIP_CALLS[resolve(written, (name) => name in SKIP_CALLS) ?? ''];
        if (!call) continue;
        [always, given] = [!call.conditional, node.childForFieldName('arguments')];
      }
      const conditional = !always || hasAncestor(node, BRANCHES, body);
      const reason = statementsOf(given).map((argument) => stringValue(argument)).find((text) => text !== null) ?? null;
      return { unconditional: !conditional, conditional, reason };
    }
    return null;
  };

  /** The cases of a JUnit 5 parameterized test: the sources add up. Null when one of them is not written out here. */
  const casesOf = (marks: readonly Annotation[]): number | null => {
    let total: number | null = null;
    for (const mark of marks.filter((candidate) => candidate.name in ARGUMENT_SOURCES)) {
      const rule = ARGUMENT_SOURCES[mark.name]!;
      if (rule === null || UNCOUNTED_SOURCE_ELEMENTS.some((name) => mark.elements.has(name))) return null;
      const listed = [...mark.elements].filter(([name]) => !SOURCE_SETTING_ELEMENTS.includes(name)).reduce((sum, [, value]) => sum + itemsOf(value).length, 0);
      total = (total ?? 0) + (rule === 'values' ? listed : rule);
    }
    return total;
  };

  const visitType = (declaration: SyntaxNode, scope: Scope): void => {
    const marks = annotations(declaration);
    const members = membersOf(declaration);
    const methods = members.filter((member) => member.type === 'method_declaration').map((node) => ({ node, marks: annotations(node), name: node.childForFieldName('name')?.text ?? '' }));
    const title = titleOf(declaration, marks);
    const suite: NSuite = { title, span: spanOfNode(declaration), modifiers: skipOf(marks)?.unconditional ? ['skip'] : [], hooks: [], testIds: [], suites: [] };
    const path = [...scope.path, title];

    // TestNG: `@Test` on the class makes its public methods tests.
    const classTest = marks.some((mark) => mark.name === CLASS_TEST_ANNOTATION);
    const runWith = marks.find((mark) => mark.name === RUN_WITH_ANNOTATION)?.elements.get('value');
    const rowsMethod = methods.find((method) => method.marks.some((mark) => mark.name === PARAMETERS_ANNOTATION));
    const inherited: Generated | null = runWith?.type === 'class_literal' && PARAMETERIZED_RUNNERS.includes(lastPart(dottedName(runWith.namedChildren[0]) ?? ''))
      ? { source: 'ParameterizedTest', cases: rowsOf(rowsMethod?.node) }
      : scope.inherited;
    const provider = (name: string | null): SyntaxNode | undefined => methods.find((method) => {
      const own = method.marks.find((mark) => mark.name === DATA_PROVIDER_ANNOTATION);
      return own !== undefined && name !== null && (stringValue(own.elements.get(DATA_PROVIDER_NAME_ELEMENT)) ?? method.name) === name;
    })?.node;

    for (const method of methods) {
      const body = method.node.childForFieldName('body');
      if (!body) continue; // a method of an interface with no body runs nothing itself
      const hook = method.marks.map((mark) => HOOK_ANNOTATIONS[mark.name]).find((entry) => entry !== undefined);
      if (hook) {
        suite.hooks.push({ span: spanOfNode(method.node), kind: hook.kind, scope: hook.global ? 'global' : 'suite', releases: [], assertions: read(method.node, body).assertions, waits: [], selectors: [], data: [] } satisfies NHook);
        continue;
      }
      const testMark = method.marks.find((mark) => mark.name in TEST_ANNOTATIONS);
      const plain = method.marks.every((mark) => !KNOWN_ANNOTATIONS.has(mark.name));
      if (!testMark && !(classTest && plain && hasModifier(method.node, 'public') && !hasModifier(method.node, 'static'))) continue;

      // Two test methods with one name differ in their parameters: the title names them, as the display name of JUnit does.
      const overloaded = methods.filter((other) => other.name === method.name && other.node.childForFieldName('body') !== null).length > 1;
      const types = statementsOf(method.node.childForFieldName('parameters')).map((parameter) => parameter.childForFieldName('type')?.text ?? parameter.text);
      const name = overloaded && types.length > 0 && !method.marks.some((mark) => mark.name === DISPLAY_NAME_ANNOTATION) ? `${method.name}(${types.join(', ')})` : titleOf(method.node, method.marks);
      const fullTitle = [...path, name].join(' > ');
      const occurrence = seen.get(fullTitle) ?? 0;
      seen.set(fullTitle, occurrence + 1);
      const test = emptyTest({ id: testId(file.path, fullTitle, occurrence), title: name, fullTitle, suitePath: [...path], span: spanOfNode(method.node), bodySpan: spanOfNode(body) });
      test.skip = skipOf(method.marks) ?? skipInBody(body);
      if (test.skip?.unconditional && skipOf(method.marks)) test.modifiers = ['skip'];
      const generated = testMark ? TEST_ANNOTATIONS[testMark.name]!.generated : undefined;
      const dataProvider = testMark?.elements.get(DATA_PROVIDER_ELEMENT);
      if (generated) test.parameterized = { source: generated, cases: generated === 'ParameterizedTest' ? casesOf(method.marks) : null };
      else if (dataProvider) test.parameterized = { source: 'DataProvider', cases: rowsOf(provider(stringValue(dataProvider))) };
      else test.parameterized = inherited;
      const facts = read(method.node, body);
      test.assertions = facts.assertions;
      test.tryBlocks = facts.tryBlocks;
      // `@Test(expected = IllegalStateException.class)`, `@Test(expectedExceptions = ...)`.
      test.expectsException = facts.expectsException || (testMark !== undefined && EXPECTED_EXCEPTION_ELEMENTS.some((name) => testMark.elements.has(name)));
      test.statementCount = statementsOf(body).length;
      test.bodyHash = bodyHash(tokensOf(body));
      model.tests.push(test);
      suite.testIds.push(test.id);
    }
    for (const member of members.filter((candidate) => TYPE_DECLARATIONS.has(candidate.type))) visitType(member, { suite, path, inherited });

    // A class is a suite when something of it runs: a test, a hook, or a class inside it that is one. `@Nested` says so by itself.
    const nested = marks.some((mark) => mark.name === NESTED_ANNOTATION);
    if (suite.testIds.length > 0 || suite.hooks.length > 0 || suite.suites.length > 0 || nested) (scope.suite ? scope.suite.suites : model.suites).push(suite);
  };
  for (const declaration of root.namedChildren.filter((node) => TYPE_DECLARATIONS.has(node.type))) visitType(declaration, { suite: null, path: [], inherited: null });

  // Tests are listed in source order, also when a class inside another class comes before the methods of the outer one.
  model.tests.sort((a, b) => a.span.startLine - b.span.startLine || a.span.startColumn - b.span.startColumn);
  const types = root.namedChildren.filter((node) => TYPE_DECLARATIONS.has(node.type));
  if (model.tests.length > 0 || (model.suites.length === 0 && types.some(looksLikeForgottenTests))) model.role = 'test';
  return model;
}
