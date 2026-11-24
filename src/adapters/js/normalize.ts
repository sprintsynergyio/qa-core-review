// JS/TS: from a syntax tree to the normalized model (SPEC.md Sections 8.1 and 9.1).
//
// This file finds the structure of a test file: suites, tests, hooks, modifiers, skips,
// parameterized tests, imports and suppression comments. What each body checks is read by
// assertions.ts, and what it does (waits, selectors, mocks, resources) by body.ts.
import { clipText, emptyTest, parseSuppression } from '../../model/build.js';
import { bodyHash, testId } from '../../model/hash.js';
import type { Capability, Modifier, NFile, NHook, NImport, NSuite, NSuppression, NTest } from '../../model/types.js';
import { spanOfNode } from '../../parse/positions.js';
import type { SyntaxNode } from '../../parse/treesitter.js';
import type { AdapterContext, FrameworkGuess, ParsedFile } from '../types.js';
import { readBody } from './assertions.js';
import { readCalls, type CallContext, type Held } from './body.js';
import { learnNames } from './expr.js';
import { collectJsHelpers, fileContext, findSubject } from './helpers.js';
import { argumentsOf, hasAncestor, isFunction, memberChain, stringValue, tokensOf } from './syntax.js';
import {
  ALIASES, CONDITIONAL_MEMBERS, EACH_MEMBERS, FRAMEWORK_MODULES, HOOK_CALLEES, IN_BODY_SKIPS, ITERATION_MEMBERS, MODIFIER_MEMBERS,
  OPTION_MODIFIERS, SUITE_CALLEES, SUITE_MEMBER, TEST_CALLEES, TEST_FILE_NAME, TEST_ID_ATTRIBUTES, TEST_LIBRARY_MODULES,
} from './vocab.js';

/** What the adapter fills in from a syntax tree: every capability of the model. */
export const JS_CAPABILITIES: Capability[] = [
  'tests', 'suites', 'hooks', 'modifiers', 'parameterized', 'assertions', 'assertion-operands', 'waits', 'selectors', 'try-blocks', 'mocks', 'subject',
  'network', 'data', 'resources', 'body-hash', 'helpers', 'reachability',
];

const LOOPS = new Set(['for_statement', 'for_in_statement', 'while_statement', 'do_statement']);
const BRANCHES = new Set(['if_statement', 'ternary_expression', 'switch_statement', 'binary_expression']);
const includes = (list: readonly string[], value: string): boolean => list.includes(value);

interface Declaration {
  kind: 'test' | 'suite' | 'hook';
  hook?: NHook['kind'];
  modifiers: Modifier[];
  /** The table of `.each(table)`: an `arguments` or `template_string` node. */
  table: SyntaxNode | null;
  /** `.skipIf(cond)` or `.runIf(cond)`: the test runs only under a condition. */
  conditional: boolean;
}

interface Scope {
  suite: NSuite | null;
  path: string[];
  /** Set inside a loop or a `describe.each`: the tests declared here are generated. */
  generated: NonNullable<NTest['parameterized']> | null;
}

/** Reads what a call declares from its callee: `test.describe.only`, `it.each(table)`, `xit`, ... */
function declarationOf(call: SyntaxNode, aliases: ReadonlyMap<string, string>): Declaration | null {
  let callee = call.childForFieldName('function');
  let table: SyntaxNode | null = null;
  let conditional = false;
  // `test.each(table)(title, fn)` and `test.skipIf(cond)(title, fn)`: the callee is itself a call.
  if (callee?.type === 'call_expression') {
    const inner = memberChain(callee.childForFieldName('function'));
    const last = inner?.members.at(-1);
    if (!last) return null;
    if (includes(EACH_MEMBERS, last)) table = callee.childForFieldName('arguments');
    else if (includes(CONDITIONAL_MEMBERS, last)) conditional = true;
    else return null;
    callee = callee.childForFieldName('function')!.childForFieldName('object');
  }
  const chain = memberChain(callee);
  if (!chain) return null;
  const root = aliases.get(chain.root) ?? chain.root;
  const members = [...chain.members];

  if (HOOK_CALLEES[root] && members.length === 0 && !table) return { kind: 'hook', hook: HOOK_CALLEES[root], modifiers: [], table, conditional };
  const alias = ALIASES[root];
  let kind: 'test' | 'suite';
  const modifiers: Modifier[] = [];
  if (alias) {
    kind = alias.kind;
    modifiers.push(alias.modifier);
  } else if (includes(TEST_CALLEES, root)) kind = 'test';
  else if (includes(SUITE_CALLEES, root)) kind = 'suite';
  else return null;

  if (kind === 'test' && members[0] === SUITE_MEMBER) {
    kind = 'suite';
    members.shift();
  } else if (kind === 'test' && members.length === 1 && HOOK_CALLEES[members[0]!] && !table) {
    return { kind: 'hook', hook: HOOK_CALLEES[members[0]!], modifiers: [], table, conditional };
  }
  for (const member of members) {
    const modifier = MODIFIER_MEMBERS[member];
    if (!modifier) return null; // `test.step`, `test.use`, `test.extend`, `describe.configure`: not a declaration
    if (!modifiers.includes(modifier)) modifiers.push(modifier);
  }
  return { kind, modifiers, table, conditional };
}

/** The number of cases in an `.each` table, or null when it is not a literal. */
function tableCases(table: SyntaxNode): number | null {
  if (table.type === 'template_string') {
    // A tagged template: the first line with text names the columns, every value is a `${...}`.
    const header = table.text.slice(1).split('\n').find((line) => line.trim() !== '') ?? '';
    const columns = header.split('|').length;
    const values = table.namedChildren.filter((node) => node.type === 'template_substitution').length;
    return values > 0 && values % columns === 0 ? values / columns : null;
  }
  const first = table.namedChildren[0];
  return first?.type === 'array' ? first.namedChildren.filter((node) => node.type !== 'comment').length : null;
}

/** `{ skip: true, todo: 'later' }` as the options of a test: modifiers and a reason. */
function optionModifiers(options: SyntaxNode | undefined): { modifiers: Modifier[]; reason: string | null } {
  const result: { modifiers: Modifier[]; reason: string | null } = { modifiers: [], reason: null };
  for (const pair of options?.type === 'object' ? options.namedChildren : []) {
    const modifier = OPTION_MODIFIERS[pair.childForFieldName('key')?.text ?? ''];
    const value = pair.childForFieldName('value');
    if (!modifier || !value || value.type === 'false') continue;
    result.modifiers.push(modifier);
    result.reason ??= stringValue(value);
  }
  return result;
}

/** `test.skip()`, `test.fixme(cond, 'reason')` or `this.skip()` inside a test body. */
function skipInBody(body: SyntaxNode): NTest['skip'] {
  for (const call of body.descendantsOfType('call_expression')) {
    const chain = memberChain(call.childForFieldName('function'));
    if (!chain || !includes(IN_BODY_SKIPS, [chain.root, ...chain.members].join('.'))) continue;
    const args = argumentsOf(call);
    if (isFunction(args.at(-1))) continue; // a nested declaration, not a skip of this test
    const conditional = args.length > 0 || hasAncestor(call, BRANCHES, body);
    return { unconditional: !conditional, conditional, reason: args.length > 1 ? stringValue(args[1]!) : null };
  }
  return null;
}

function buildTest(call: SyntaxNode, declaration: Declaration, scope: Scope, file: string, seen: Map<string, number>, bodies: Map<NTest | NHook, SyntaxNode>): NTest | null {
  const args = argumentsOf(call);
  const fn = [...args].reverse().find(isFunction) ?? null;
  const titleNode = args[0] && !isFunction(args[0]) ? args[0] : null;
  const options = optionModifiers(args.find((arg) => arg.type === 'object' && arg !== titleNode));
  const modifiers = [...new Set([...declaration.modifiers, ...options.modifiers])];
  if (!fn) {
    // No function: `test.todo('title')`, or a pending Mocha test `it('title')`.
    if (titleNode?.type !== 'string' || args.length !== 1) return null;
    if (!modifiers.includes('todo')) modifiers.push('todo');
  }

  const title = stringValue(titleNode) ?? (titleNode ? clipText(titleNode.text) : fn?.childForFieldName('name')?.text ?? '(anonymous)');
  const fullTitle = [...scope.path, title].join(' > ');
  const occurrence = seen.get(fullTitle) ?? 0;
  seen.set(fullTitle, occurrence + 1);
  const span = spanOfNode(call);
  const body = fn?.childForFieldName('body') ?? null;
  const test = emptyTest({
    id: testId(file, fullTitle, occurrence),
    title,
    fullTitle,
    suitePath: [...scope.path],
    span,
    bodySpan: body ? spanOfNode(body) : { startLine: span.endLine, startColumn: span.endColumn, endLine: span.endLine, endColumn: span.endColumn },
  });
  test.modifiers = modifiers;

  if (modifiers.includes('skip') || modifiers.includes('fixme')) test.skip = { unconditional: true, conditional: false, reason: options.reason };
  else if (declaration.conditional) test.skip = { unconditional: false, conditional: true, reason: null };
  else if (body) test.skip = skipInBody(body);

  if (declaration.table) test.parameterized = { source: 'each', cases: tableCases(declaration.table) };
  else if (scope.generated) test.parameterized = { ...scope.generated };

  if (body) {
    bodies.set(test, body);
    test.statementCount = body.type === 'statement_block' ? body.namedChildren.filter((node) => node.type !== 'comment').length : 1;
    test.bodyHash = bodyHash(tokensOf(body));
  }
  return test;
}

/** One test per element: `for (const x of [...])`, `[...].forEach((x) => ...)`. */
function generatedBy(node: SyntaxNode): Scope['generated'] {
  if (LOOPS.has(node.type)) {
    const right = node.childForFieldName('right');
    return { source: 'loop', cases: right?.type === 'array' ? right.namedChildCount : null };
  }
  if (node.type !== 'call_expression') return null;
  const callee = node.childForFieldName('function');
  if (callee?.type !== 'member_expression' || !includes(ITERATION_MEMBERS, callee.childForFieldName('property')?.text ?? '')) return null;
  if (!argumentsOf(node).some(isFunction)) return null;
  const list = callee.childForFieldName('object');
  return { source: 'loop', cases: list?.type === 'array' ? list.namedChildCount : null };
}

export function readImports(root: SyntaxNode): { imports: NImport[]; aliases: Map<string, string> } {
  const imports: NImport[] = [];
  const aliases = new Map<string, string>();
  const add = (node: SyntaxNode, source: string | null, names: string[], typeOnly = false): void => {
    if (source === null) return;
    const framework = source in FRAMEWORK_MODULES || includes(TEST_LIBRARY_MODULES, source);
    imports.push({ span: spanOfNode(node), source, names, typeOnly, framework });
  };

  for (const statement of root.namedChildren) {
    if (statement.type === 'import_statement') {
      const names: string[] = [];
      for (const part of statement.descendantsOfType(['import_specifier', 'namespace_import', 'import_require_clause'])) {
        if (part.type !== 'import_specifier') names.push('*');
        else {
          const name = part.childForFieldName('name')!.text;
          const alias = part.childForFieldName('alias')?.text;
          names.push(name);
          if (alias) aliases.set(alias, name);
        }
      }
      const clause = statement.namedChildren.find((node) => node.type === 'import_clause');
      if (clause?.namedChildren.some((node) => node.type === 'identifier')) names.unshift('default');
      const source = statement.childForFieldName('source') ?? statement.descendantsOfType('string')[0] ?? null;
      add(statement, stringValue(source), names, /^import\s+type\b/.test(statement.text));
    } else if (statement.type === 'lexical_declaration' || statement.type === 'variable_declaration') {
      // const { a, b: c } = require('x');   const x = require('x');
      for (const declarator of statement.namedChildren.filter((node) => node.type === 'variable_declarator')) {
        const value = declarator.childForFieldName('value');
        if (value?.type !== 'call_expression' || value.childForFieldName('function')?.text !== 'require') continue;
        const pattern = declarator.childForFieldName('name');
        const names = pattern?.type === 'object_pattern'
          ? pattern.namedChildren.map((node) => (node.type === 'pair_pattern' ? node.childForFieldName('key')!.text : node.text))
          : ['*'];
        add(statement, stringValue(argumentsOf(value)[0] ?? null), names);
      }
    }
  }
  return { imports, aliases };
}

/** Suppression comments. The whole-file form only counts before the first statement. */
function readSuppressions(root: SyntaxNode): NSuppression[] {
  const firstStatement = root.namedChildren.find((node) => node.type !== 'comment');
  const suppressions: NSuppression[] = [];
  for (const comment of root.descendantsOfType('comment')) {
    const suppression = parseSuppression(comment.text, spanOfNode(comment));
    if (!suppression) continue;
    if (suppression.scope === 'file' && firstStatement && comment.startIndex > firstStatement.startIndex) continue;
    suppressions.push(suppression);
  }
  return suppressions;
}

export function normalizeJs(parsed: ParsedFile, frameworks: FrameworkGuess, ctx: AdapterContext): NFile {
  const { file, tree } = parsed;
  const model: NFile = {
    path: file.path,
    language: file.language,
    languageHint: null,
    adapter: 'js',
    tier: 1,
    runner: ctx.config.framework === 'auto' ? frameworks.runner : ctx.config.framework,
    libraries: frameworks.libraries,
    role: 'support',
    parseStatus: parsed.parseStatus,
    capabilities: [...JS_CAPABILITIES],
    suites: [],
    tests: [],
    fileHooks: [],
    fileMocks: [],
    fileResources: [],
    imports: [],
    subject: null,
    suppressions: [],
  };
  const root = tree!.rootNode; // the adapter calls this only with a tree; without one it uses the lexical scanner
  const { imports, aliases } = readImports(root);
  model.imports = imports;
  model.suppressions = readSuppressions(root);
  const seen = new Map<string, number>();
  const bodies = new Map<NTest | NHook, SyntaxNode>();

  const visit = (node: SyntaxNode, scope: Scope): void => {
    let inner = scope;
    if (node.type === 'call_expression') {
      const declaration = declarationOf(node, aliases);
      const args = argumentsOf(node);
      const fn = [...args].reverse().find(isFunction) ?? null;

      if (declaration?.kind === 'hook') {
        const hook: NHook = { span: spanOfNode(node), kind: declaration.hook!, scope: scope.suite ? 'suite' : 'file', releases: [], assertions: [], waits: [] };
        (scope.suite ? scope.suite.hooks : model.fileHooks).push(hook);
        const body = fn?.childForFieldName('body');
        if (body) bodies.set(hook, body);
        return;
      }
      if (declaration?.kind === 'test') {
        const test = buildTest(node, declaration, scope, file.path, seen, bodies);
        if (test) {
          model.tests.push(test);
          scope.suite?.testIds.push(test.id);
          return; // tests are not searched for nested declarations
        }
      }
      if (declaration?.kind === 'suite' && fn) {
        const title = stringValue(args[0] ?? null) ?? (args[0] && !isFunction(args[0]) ? clipText(args[0].text) : '(anonymous)');
        const suite: NSuite = { title, span: spanOfNode(node), modifiers: declaration.modifiers, hooks: [], testIds: [], suites: [] };
        (scope.suite ? scope.suite.suites : model.suites).push(suite);
        const generated = declaration.table ? { source: 'each' as const, cases: tableCases(declaration.table) } : scope.generated;
        visit(fn.childForFieldName('body')!, { suite, path: [...scope.path, title], generated });
        return;
      }
    }
    const generated = generatedBy(node);
    if (generated) inner = { ...scope, generated };
    for (const child of node.namedChildren) visit(child, inner);
  };
  visit(root, { suite: null, path: [], generated: null });

  // What each body checks. Names declared inside a test are known only to that test.
  const shared = fileContext(root, frameworks, imports, new Set([...bodies].filter(([target]) => 'id' in target).map(([, body]) => body.id)));
  const local = new Set(collectJsHelpers(root, file.path, shared).map((helper) => helper.name));
  const isHelper = (name: string): boolean => local.has(name) || ctx.helperIndex.has(name) || ctx.config.assertionHelpers.includes(name);
  // What each body does. The module under test, with the local names imported from it, tells which mocks replace it.
  model.subject = findSubject(file.path, imports, ctx.config);
  const subjectImport = imports.find((entry) => entry.source === model.subject?.module);
  const subjectNode = subjectImport && root.namedChildren.find((node) => spanOfNode(node).startLine === subjectImport.span.startLine);
  const calls: Omit<CallContext, 'env' | 'acquiredIn' | 'restores'> = {
    subject: model.subject && { module: model.subject.module, names: new Set(subjectNode?.descendantsOfType('identifier').map((node) => node!.text)) },
    testIdAttributes: [...new Set([ctx.config.testIdAttribute, ...TEST_ID_ATTRIBUTES])],
    skip: new Set(),
  };
  const afterReleases = new Set<string>();
  const taken: Array<{ held: Held[]; releases: string[]; into: NFile['fileResources'] }> = [];
  const outside = readCalls(root, { ...calls, env: shared.env, acquiredIn: 'file', restores: false, skip: new Set([...bodies.values()].map((body) => body.id)) });
  model.fileMocks = outside.mocks;
  taken.push({ held: outside.held, releases: outside.releases, into: model.fileResources });

  for (const [target, body] of bodies) {
    const isTest = 'id' in target;
    const env = isTest ? { ...shared.env, locators: new Set(shared.env.locators), counts: new Set(shared.env.counts), mocks: new Set(shared.env.mocks) } : shared.env;
    if (isTest) learnNames(body, env);
    const facts = readBody(body, { ...shared, env, isHelper });
    const after = !isTest && (target.kind === 'afterEach' || target.kind === 'afterAll');
    const did = readCalls(body, { ...calls, env, acquiredIn: isTest ? 'test' : 'hook', restores: after });
    target.assertions = facts.assertions;
    taken.push({ held: did.held, releases: did.releases, into: isTest ? target.resources : model.fileResources });
    if (isTest) {
      target.assertionGuards = facts.guards;
      target.expectsException = facts.expectsException;
      target.tryBlocks = facts.tryBlocks;
      Object.assign(target, { waits: did.waits, selectors: did.selectors, steps: did.steps, data: did.data, mocks: did.mocks });
    } else {
      target.releases = [...new Set(did.releases)];
      target.waits = did.waits;
      model.fileMocks.push(...did.mocks);
      if (after) did.releases.forEach((token) => afterReleases.add(token));
    }
  }
  // A resource is released in its own body or in an after hook of the file.
  for (const { held, releases, into } of taken) {
    for (const { resource, tokens } of held) into.push({ ...resource, released: resource.released || tokens.some((token) => releases.includes(token) || afterReleases.has(token)) });
  }
  const byPosition = (a: { span: NFile['imports'][number]['span'] }, b: typeof a): number => a.span.startLine - b.span.startLine || a.span.startColumn - b.span.startColumn;
  model.fileMocks.sort(byPosition);
  model.fileResources.sort(byPosition);

  model.role = model.tests.length > 0 || model.suites.length > 0 || TEST_FILE_NAME.test(file.path) ? 'test' : 'support';
  return model;
}
