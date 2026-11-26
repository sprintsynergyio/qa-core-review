// Python: from a syntax tree to the normalized model (SPEC.md Sections 8.1 and 9.2).
//
// This file finds the structure of a test file: suites (classes), tests, hooks and fixtures,
// skip and xfail marks, parametrized tests, imports and suppression comments. What each body
// checks is read by assertions.ts. What it does (waits, selectors, mocks, resources) is read
// by a later part of the adapter.
import { emptyTest, parseSuppression } from '../../model/build.js';
import { bodyHash, testId } from '../../model/hash.js';
import type { Capability, Modifier, NFile, NHook, NImport, NSuite, NSuppression, NTest, Span } from '../../model/types.js';
import { spanOfNode } from '../../parse/positions.js';
import type { SyntaxNode } from '../../parse/treesitter.js';
import type { AdapterContext, FrameworkGuess, ParsedFile, SourceFile } from '../types.js';
import { readBody } from './assertions.js';
import { learnNames } from './expr.js';
import { collectPythonHelpers, fileContext, isAsync } from './helpers.js';
import { argumentsOf, docstringOf, dottedName, hasAncestor, isPlaceholder, ownDescendants, qualify, statementsOf, stringValue, tokensOf } from './syntax.js';
import {
  CONDITIONAL_IN_BODY_SKIPS, FIXTURE_DECORATORS, FRAMEWORK_MODULES, HOOK_FUNCTIONS, HOOK_METHODS, IN_BODY_SKIPS, MARKS, MARK_VARIABLE, PARAMETRIZE_DECORATORS,
  RAISED_SKIPS, REASON_KEYWORDS, SUBTEST_CALL, SUPPORT_FILE_NAMES, TESTCASE_SUFFIX, TEST_CLASS_PREFIX, TEST_FILE_NAME, TEST_FUNCTION_PREFIX, TEST_LIBRARY_MODULES,
  TYPE_CHECKING_NAMES, UNITTEST_BASES, WIDE_FIXTURE_SCOPES,
} from './vocab.js';

/** What the adapter fills in from a syntax tree so far. The other capabilities join with the part that reads them. */
export const PYTHON_CAPABILITIES: Capability[] = [
  'tests', 'suites', 'hooks', 'modifiers', 'parameterized', 'assertions', 'assertion-operands', 'try-blocks', 'body-hash', 'helpers', 'reachability',
];

const BRANCHES = new Set(['if_statement', 'conditional_expression', 'boolean_operator', 'try_statement', 'match_statement', 'for_statement', 'while_statement']);
const COLLECTIONS = new Set(['list', 'tuple', 'set']);
const COMPOUND = new Set(['if_statement', 'try_statement', 'with_statement']);
const includes = (list: readonly string[], value: string | null): boolean => value !== null && list.includes(value);

type Skip = NonNullable<NTest['skip']>;
type Generated = NonNullable<NTest['parameterized']>;

/** What decorators or a `pytestmark` say about the tests they cover. */
interface Marks {
  modifiers: Modifier[];
  skip: Skip | null;
  parameterized: Generated | null;
}

/** A mark as written: `pytest.mark.skip`, or `pytest.mark.skip(reason="...")` with its call. */
interface Mark {
  name: string | null;
  call: SyntaxNode | null;
}

interface Scope {
  suite: NSuite | null;
  path: string[];
  /** From a `pytestmark` or the decorators of the class around: they cover every test below. */
  inherited: Marks;
}

const NO_MARKS: Marks = { modifiers: [], skip: null, parameterized: null };

/** An expression used as a mark: a name, or a call of one. */
function markOf(expression: SyntaxNode | null | undefined, aliases: ReadonlyMap<string, string>): Mark {
  const call = expression?.type === 'call' ? expression : null;
  return { name: qualify(dottedName(call ? call.childForFieldName('function') : expression), aliases), call };
}

const decoratorsOf = (statement: SyntaxNode, aliases: ReadonlyMap<string, string>): Mark[] =>
  (statement.type === 'decorated_definition' ? statement.namedChildren.filter((node) => node.type === 'decorator') : []).map((decorator) => markOf(decorator.namedChildren[0], aliases));

/** The reason of a skip: `reason="..."`, or the string at `position`. */
function reasonOf(call: SyntaxNode | null, position: number): string | null {
  const { positional, keywords } = argumentsOf(call);
  for (const keyword of REASON_KEYWORDS) {
    const value = stringValue(keywords.get(keyword));
    if (value !== null) return value;
  }
  return stringValue(positional[position]);
}

/** The number of cases a parametrize decorator lists, or null when the list is not written out. */
function casesOf(call: SyntaxNode | null, position: number | null): number | null {
  if (position === null) return null;
  const { positional, keywords } = argumentsOf(call);
  const values = positional[position] ?? keywords.get('argvalues') ?? null;
  return values && COLLECTIONS.has(values.type) ? values.namedChildren.filter((node) => node.type !== 'comment').length : null;
}

function readMarks(marks: readonly Mark[]): Marks {
  const result: Marks = { modifiers: [], skip: null, parameterized: null };
  for (const { name, call } of marks) {
    if (name === null) continue;
    const mark = MARKS[name];
    if (mark?.modifier === 'skip' && !mark.conditional) {
      if (!result.modifiers.includes('skip')) result.modifiers.push('skip');
      result.skip = { unconditional: true, conditional: false, reason: reasonOf(call, 0) };
    } else if (mark?.modifier === 'skip') {
      // `skipif(condition, reason="...")`: the reason is the second argument.
      result.skip ??= { unconditional: false, conditional: true, reason: reasonOf(call, 1) };
    } else if (mark) {
      if (!result.modifiers.includes(mark.modifier)) result.modifiers.push(mark.modifier);
    } else if (name in PARAMETRIZE_DECORATORS) {
      // Two parametrize decorators give every pair of their cases.
      const cases = casesOf(call, PARAMETRIZE_DECORATORS[name]!);
      const before = result.parameterized;
      result.parameterized = { source: 'parametrize', cases: before === null ? cases : before.cases === null || cases === null ? null : before.cases * cases };
    }
  }
  return result;
}

/** The marks of a test with those of the scope around it. Its own marks come first. */
function withInherited(own: Marks, outer: Marks): Marks {
  const both = own.parameterized && outer.parameterized;
  return {
    modifiers: [...new Set([...own.modifiers, ...outer.modifiers])],
    skip: own.skip?.unconditional ? own.skip : outer.skip?.unconditional ? outer.skip : own.skip ?? outer.skip,
    parameterized: both
      ? { source: 'parametrize', cases: own.parameterized!.cases === null || outer.parameterized!.cases === null ? null : own.parameterized!.cases * outer.parameterized!.cases }
      : own.parameterized ?? outer.parameterized,
  };
}

/** `pytestmark = pytest.mark.skip(...)` or `pytestmark = [mark, mark]` among the statements of a module or class. */
function variableMarks(statements: readonly SyntaxNode[], aliases: ReadonlyMap<string, string>): Marks {
  for (const statement of statements) {
    const assignment = statement.type === 'expression_statement' ? statement.namedChildren[0] : null;
    if (assignment?.type !== 'assignment' || assignment.childForFieldName('left')?.text !== MARK_VARIABLE) continue;
    const value = assignment.childForFieldName('right');
    const items = value && COLLECTIONS.has(value.type) ? value.namedChildren : value ? [value] : [];
    return readMarks(items.map((item) => markOf(item, aliases)));
  }
  return NO_MARKS;
}

/** `pytest.skip("reason")`, `self.skipTest("reason")` or `raise unittest.SkipTest("reason")` inside a test body. */
function skipInBody(body: SyntaxNode, aliases: ReadonlyMap<string, string>): NTest['skip'] {
  for (const node of ownDescendants(body, new Set(['call', 'raise_statement']))) {
    let call: SyntaxNode | null = node;
    let always = true;
    if (node.type === 'raise_statement') {
      const raised = node.namedChildren[0];
      call = raised?.type === 'call' ? raised : null;
      if (!includes(RAISED_SKIPS, qualify(dottedName(call ? call.childForFieldName('function') : raised), aliases))) continue;
    } else {
      const name = qualify(dottedName(node.childForFieldName('function')), aliases);
      if (includes(CONDITIONAL_IN_BODY_SKIPS, name)) always = false;
      else if (!includes(IN_BODY_SKIPS, name)) continue;
    }
    const conditional = !always || hasAncestor(node, BRANCHES, body);
    return { unconditional: !conditional, conditional, reason: always ? reasonOf(call, 0) : null };
  }
  return null;
}

/** `for n in [1, 2]: with self.subTest(n=n): ...` runs the checks once for each element. */
function subTestLoop(body: SyntaxNode, aliases: ReadonlyMap<string, string>): Generated | null {
  for (const call of ownDescendants(body, new Set(['call']))) {
    if (qualify(dottedName(call.childForFieldName('function')), aliases) !== SUBTEST_CALL) continue;
    for (let parent = call.parent; parent && parent.id !== body.id; parent = parent.parent) {
      if (parent.type !== 'for_statement') continue;
      const right = parent.childForFieldName('right');
      return { source: 'loop', cases: right && COLLECTIONS.has(right.type) ? right.namedChildren.filter((node) => node.type !== 'comment').length : null };
    }
  }
  return null;
}

/**
 * The statements of a fixture that run after its `yield`: what follows the yield in its block
 * and in the blocks around it, and the `finally` of a `try` around it. Empty when the fixture
 * has no yield, or nothing after it.
 */
export function teardownOf(body: SyntaxNode): SyntaxNode[] {
  const first = ownDescendants(body, new Set(['yield']))[0];
  if (!first) return [];
  const after: SyntaxNode[] = [];
  // Go up from the yield, one block at a time, to the body of the fixture.
  let inside: SyntaxNode = first;
  for (let parent = first.parent; parent; inside = parent, parent = parent.parent) {
    if (parent.type === 'block') {
      const statements = statementsOf(parent);
      after.push(...statements.slice(statements.findIndex((statement) => statement.id === inside.id) + 1));
      if (parent.id === body.id) break;
    } else if (parent.type === 'try_statement' && inside.type !== 'finally_clause') {
      const last = parent.namedChildren.find((clause) => clause.type === 'finally_clause');
      after.push(...statementsOf(last?.namedChildren.find((node) => node.type === 'block')));
    }
  }
  return after;
}

const spanOver = (nodes: readonly SyntaxNode[]): Span => {
  const [first, last] = [spanOfNode(nodes[0]!), spanOfNode(nodes.at(-1)!)];
  return { startLine: first.startLine, startColumn: first.startColumn, endLine: last.endLine, endColumn: last.endColumn };
};

/** The imports of a module, and what each imported name stands for: `mark` is `pytest.mark` after `from pytest import mark`. */
export function readImports(root: SyntaxNode): { imports: NImport[]; aliases: Map<string, string> } {
  const imports: NImport[] = [];
  const aliases = new Map<string, string>();
  const nameOf = (node: SyntaxNode): { name: string; alias: string | null } =>
    node.type === 'aliased_import' ? { name: node.childForFieldName('name')?.text ?? '', alias: node.childForFieldName('alias')?.text ?? null } : { name: node.text, alias: null };
  const add = (statement: SyntaxNode, source: string, names: string[], typeOnly: boolean): void => {
    const top = source.split('.')[0]!;
    imports.push({ span: spanOfNode(statement), source, names, typeOnly, framework: top in FRAMEWORK_MODULES || TEST_LIBRARY_MODULES.includes(top) });
  };

  const visit = (statements: readonly SyntaxNode[], typeOnly: boolean): void => {
    for (const statement of statements) {
      if (statement.type === 'import_statement') {
        // import os, playwright.sync_api as pw
        for (const part of statement.namedChildren.filter((node) => node.type === 'dotted_name' || node.type === 'aliased_import')) {
          const { name, alias } = nameOf(part);
          if (alias) aliases.set(alias, name);
          add(statement, name, ['*'], typeOnly);
        }
      } else if (statement.type === 'import_from_statement') {
        const module = statement.childForFieldName('module_name');
        if (!module) continue;
        const names: string[] = [];
        for (const part of statement.namedChildren.filter((node) => node.id !== module.id && node.type !== 'comment')) {
          if (part.type === 'wildcard_import') names.push('*');
          else {
            const { name, alias } = nameOf(part);
            names.push(name);
            // A name from a relative import stands for itself: there is no module path to put before it.
            if (module.type !== 'relative_import') aliases.set(alias ?? name, `${module.text}.${name}`);
          }
        }
        add(statement, module.text, names, typeOnly);
      } else if (statement.type === 'if_statement' || statement.type === 'try_statement') {
        // `if TYPE_CHECKING:` and `try: import x / except ImportError:` at the top of a module.
        const guarded = statement.type === 'if_statement' && includes(TYPE_CHECKING_NAMES, qualify(dottedName(statement.childForFieldName('condition')), aliases));
        for (const block of statement.descendantsOfType('block')) {
          if (block && !hasAncestor(block, new Set(['function_definition', 'class_definition', 'block']), statement)) visit(statementsOf(block), typeOnly || (guarded && block.parent?.id === statement.id));
        }
      }
    }
  };
  visit(statementsOf(root), false);
  return { imports, aliases };
}

/** Suppression comments. The whole-file form only counts before the first statement. The module docstring is no statement. */
function readSuppressions(root: SyntaxNode): NSuppression[] {
  const docstring = docstringOf(root);
  const firstStatement = statementsOf(root).find((node) => node.id !== docstring?.id);
  const suppressions: NSuppression[] = [];
  for (const comment of root.descendantsOfType('comment')) {
    const suppression = comment && parseSuppression(comment.text, spanOfNode(comment));
    if (!suppression) continue;
    if (suppression.scope === 'file' && firstStatement && comment.startIndex > firstStatement.startIndex) continue;
    suppressions.push(suppression);
  }
  return suppressions;
}

const baseName = (filePath: string): string => filePath.slice(filePath.lastIndexOf('/') + 1);

/** The model of a file with no syntax tree: nothing is known about it but its name. */
export function unparsedPython(file: SourceFile, frameworks: FrameworkGuess, ctx: AdapterContext, parseStatus: NFile['parseStatus']): NFile {
  return {
    path: file.path,
    language: 'python',
    languageHint: null,
    adapter: 'python',
    tier: 1,
    runner: ctx.config.framework === 'auto' ? frameworks.runner : ctx.config.framework,
    libraries: frameworks.libraries,
    role: TEST_FILE_NAME.test(file.path) && !SUPPORT_FILE_NAMES.includes(baseName(file.path)) ? 'test' : 'support',
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

export function normalizePython(parsed: ParsedFile, frameworks: FrameworkGuess, ctx: AdapterContext): NFile {
  const { file } = parsed;
  const model = unparsedPython(file, frameworks, ctx, parsed.parseStatus);
  model.capabilities = [...PYTHON_CAPABILITIES];
  const root = parsed.tree!.rootNode; // the adapter calls this only with a tree
  const { imports, aliases } = readImports(root);
  model.imports = imports;
  model.suppressions = readSuppressions(root);
  const support = SUPPORT_FILE_NAMES.includes(baseName(file.path));
  const seen = new Map<string, number>();
  /** Classes of this file that are unittest suites, so a class that extends one of them is a suite too. */
  const testCases = new Set<string>();
  /** What to read for each test and hook: its function, and for the two halves of a fixture which statements are its own. */
  const bodies = new Map<NTest | NHook, { definition: SyntaxNode; skip?: SyntaxNode[]; only?: SyntaxNode[] }>();

  const addHook = (scope: Scope, kind: NHook['kind'], span: Span, body: { definition: SyntaxNode; skip?: SyntaxNode[]; only?: SyntaxNode[] }): void => {
    const hook: NHook = { span, kind, scope: scope.suite ? 'suite' : support ? 'global' : 'file', releases: [], assertions: [], waits: [], selectors: [], data: [] };
    (scope.suite ? scope.suite.hooks : model.fileHooks).push(hook);
    bodies.set(hook, body);
  };

  const addTest = (statement: SyntaxNode, definition: SyntaxNode, name: string, marks: Marks, scope: Scope): void => {
    const fullTitle = [...scope.path, name].join(' > ');
    const occurrence = seen.get(fullTitle) ?? 0;
    seen.set(fullTitle, occurrence + 1);
    const span = spanOfNode(statement);
    const body = definition.childForFieldName('body');
    const test = emptyTest({
      id: testId(file.path, fullTitle, occurrence),
      title: name,
      fullTitle,
      suitePath: [...scope.path],
      span,
      bodySpan: body ? spanOfNode(body) : { startLine: span.endLine, startColumn: span.endColumn, endLine: span.endLine, endColumn: span.endColumn },
    });
    const all = withInherited(marks, scope.inherited);
    test.modifiers = all.modifiers;
    test.skip = all.skip ?? (body ? skipInBody(body, aliases) : null);
    test.parameterized = all.parameterized ?? (body ? subTestLoop(body, aliases) : null);
    if (body) {
      const docstring = docstringOf(body);
      test.statementCount = statementsOf(body).filter((node) => node.id !== docstring?.id && !isPlaceholder(node)).length;
      test.bodyHash = bodyHash(tokensOf(body, docstring));
    }
    model.tests.push(test);
    scope.suite?.testIds.push(test.id);
    bodies.set(test, { definition });
  };

  const visit = (statements: readonly SyntaxNode[], scope: Scope): void => {
    for (const statement of statements) {
      const definition = statement.type === 'decorated_definition' ? statement.childForFieldName('definition') : statement;
      const name = definition?.childForFieldName('name')?.text ?? '';
      if (definition?.type === 'function_definition') {
        const decorators = decoratorsOf(statement, aliases);
        const fixture = decorators.find((decorator) => includes(FIXTURE_DECORATORS, decorator.name));
        if (fixture) {
          // The fixture itself runs before the tests that ask for it. What follows its `yield` runs after them.
          const wide = includes(WIDE_FIXTURE_SCOPES, stringValue(argumentsOf(fixture.call).keywords.get('scope')));
          const teardown = teardownOf(definition.childForFieldName('body') ?? definition);
          addHook(scope, wide ? 'beforeAll' : 'beforeEach', spanOfNode(statement), { definition, skip: teardown });
          if (teardown.length > 0) addHook(scope, 'fixture-teardown', spanOver(teardown), { definition, only: teardown });
        } else if ((scope.suite ? HOOK_METHODS : HOOK_FUNCTIONS)[name]) addHook(scope, (scope.suite ? HOOK_METHODS : HOOK_FUNCTIONS)[name]!, spanOfNode(statement), { definition });
        else if (name.startsWith(TEST_FUNCTION_PREFIX)) addTest(statement, definition, name, readMarks(decorators), scope);
      } else if (definition?.type === 'class_definition') {
        const bases = (definition.childForFieldName('superclasses')?.namedChildren ?? []).map((base) => qualify(dottedName(base), aliases));
        const testCase = bases.some((base) => base !== null && (UNITTEST_BASES.includes(base) || base.split('.').at(-1)!.endsWith(TESTCASE_SUFFIX) || testCases.has(base)));
        if (testCase) testCases.add(name);
        if (!testCase && !name.startsWith(TEST_CLASS_PREFIX)) continue; // a page object, a helper, a data class
        const own = statementsOf(definition.childForFieldName('body'));
        const marks = withInherited(readMarks(decoratorsOf(statement, aliases)), variableMarks(own, aliases));
        // A skip or xfail on the class is kept on the suite. Its tests inherit only what makes them many tests.
        const suite: NSuite = { title: name, span: spanOfNode(statement), modifiers: marks.modifiers, hooks: [], testIds: [], suites: [] };
        (scope.suite ? scope.suite.suites : model.suites).push(suite);
        visit(own, { suite, path: [...scope.path, name], inherited: { ...NO_MARKS, parameterized: withInherited(marks, scope.inherited).parameterized } });
      } else if (scope.suite === null && COMPOUND.has(statement.type)) {
        // Tests declared under `if sys.platform == ...:` or `try:` at the top of a module.
        for (const block of statement.descendantsOfType('block')) {
          if (block && !hasAncestor(block, new Set(['function_definition', 'class_definition', 'block']), statement)) visit(statementsOf(block), scope);
        }
      }
    }
  };
  const top = statementsOf(root);
  const moduleMarks = variableMarks(top, aliases);
  // A module `pytestmark` covers the suites of the module like a decorator on each of them.
  visit(top, { suite: null, path: [], inherited: moduleMarks });
  for (const suite of model.suites) suite.modifiers = [...new Set([...suite.modifiers, ...moduleMarks.modifiers])];

  // What each body checks. Names assigned inside a test are known only to that test.
  const tests = new Set([...bodies].filter(([target]) => 'id' in target).map(([, { definition }]) => definition.id));
  const shared = fileContext(root, frameworks, imports, aliases, tests);
  const local = new Set(collectPythonHelpers(root, file.path, shared).map((helper) => helper.name));
  const isHelper = (name: string): boolean => local.has(name) || ctx.helperIndex.has(name) || ctx.config.assertionHelpers.includes(name);
  for (const [target, { definition, skip, only }] of bodies) {
    const body = definition.childForFieldName('body');
    if (!body) continue;
    const env = { ...shared.env, locators: new Set(shared.env.locators), counts: new Set(shared.env.counts), mocks: new Set(shared.env.mocks) };
    learnNames(definition, env);
    const facts = readBody(body, { ...shared, env, isHelper }, {
      async: isAsync(definition), ...(skip ? { skip: new Set(skip.map((node) => node.id)) } : {}), ...(only ? { statements: only } : {}),
    });
    target.assertions = facts.assertions;
    if ('id' in target) {
      target.expectsException = facts.expectsException;
      target.tryBlocks = facts.tryBlocks;
    }
  }

  if (!support && (model.tests.length > 0 || model.suites.length > 0)) model.role = 'test';
  return model;
}
