// JS/TS: what a test body does besides checking (SPEC.md Sections 8.1 and 9.1): waits,
// selectors, steps, data operations, mocks, and the resources it takes and releases.
import { clipText } from '../../model/build.js';
import { selectorStrategy } from '../../model/selectors.js';
import type { NDataOp, NMock, NResource, NSelector, NStep, NWait } from '../../model/types.js';
import { spanOfNode } from '../../parse/positions.js';
import type { SyntaxNode } from '../../parse/treesitter.js';
import { calleeName, isLocator, normalizedText, numberValue, rootName, unwrap, type Env } from './expr.js';
import { argumentsOf, isFunction, memberChain, stringValue } from './syntax.js';
import {
  ACTUAL_MODULE_CALLS, API_CONTEXT_OWNER, AUTO_FIXTURES, CYPRESS_INTERCEPT, CYPRESS_ONLY_SELECTOR_CALLS, CYPRESS_REQUEST, CYPRESS_ROOT, FIXED_WAIT_FUNCTIONS,
  BARE_MOCKS, FIXED_WAIT_METHODS, FUNCTION_MOCKS, GLOBAL_OBJECTS, HTTP_CLIENTS, HTTP_FUNCTION, HTTP_METHODS, IMPLICIT_WAIT_KEY, IMPLICIT_WAIT_METHODS, MATCH_ALL_PATTERNS, MODULE_MOCKS, NEEDS_ARGUMENT, PAGE_OBJECTS,
  POSITIONAL_CALLS, RELEASE_CALLS, RELEASE_METHODS, RESOURCE_CALLS, ROUTE_CONTINUE, ROUTE_FULFILL, ROUTE_METHOD, SELECTOR_ACTIONS, SELECTOR_CALLS, STEP_METHODS,
  STUB_METHODS, TIMER_FUNCTION, UI_ROOTS, WAIT_METHODS, WDIO_LOCATORS,
} from './vocab.js';

export interface CallContext {
  env: Env;
  acquiredIn: NResource['acquiredIn'];
  /** An after hook restores state: an assignment to a global there is a release, not a new resource. */
  restores: boolean;
  /** The module under test, and the local names imported from it. Null when it is not known. */
  subject: { module: string; names: ReadonlySet<string> } | null;
  testIdAttributes: readonly string[];
  /** Subtrees to leave out, by node id. */
  skip: ReadonlySet<number>;
}

/** A resource, and the release tokens that free it. The tokens are not part of the model. */
export interface Held { resource: NResource; tokens: string[] }

export interface CallFacts {
  waits: NWait[];
  selectors: NSelector[];
  steps: NStep[];
  data: NDataOp[];
  mocks: NMock[];
  held: Held[];
  /** Tokens released here: 'mocks', 'timers', 'env:API_URL', 'var:context', ... */
  releases: string[];
}

const includes = (list: readonly string[], value: string | null | undefined): boolean => value != null && list.includes(value);
const own = <T>(table: Readonly<Record<string, T>>, key: string | null | undefined): T | undefined => (key != null && Object.hasOwn(table, key) ? table[key] : undefined);
const moduleKey = (path: string): string => path.replace(/\.[cm]?[jt]sx?$/, '').replace(/\/index$/, '');

/** A string argument with no `${...}` in it, or null. */
function literalText(node: SyntaxNode | undefined): string | null {
  return node && (node.type === 'string' || (node.type === 'template_string' && node.namedChildren.every((part) => part.type !== 'template_substitution'))) ? stringValue(node) : null;
}

/** `{ method: 'POST' }` gives 'post'. */
function optionMethod(options: SyntaxNode | undefined): string | null {
  const pair = options?.type === 'object' ? options.namedChildren.find((entry) => entry.childForFieldName('key')?.text === 'method') : undefined;
  return literalText(pair?.childForFieldName('value') ?? undefined)?.toLowerCase() ?? null;
}

/** The name a value is stored under: `const x = await call()`, `this.x = call()`. */
function storedAs(call: SyntaxNode): string | null {
  let node = call;
  while (node.parent && (node.parent.type === 'await_expression' || node.parent.type === 'parenthesized_expression')) node = node.parent;
  const holder = node.parent;
  const target = holder?.type === 'variable_declarator' ? holder.childForFieldName('name') : holder?.type === 'assignment_expression' ? holder.childForFieldName('left') : null;
  return target && target.type !== 'object_pattern' && target.type !== 'array_pattern' ? normalizedText(target) : null;
}

/** The end of `spy.mockReturnValue(1).mockReturnValueOnce(2)`: a stub method gives the mock back, so that is what a variable holds. */
function withStubs(call: SyntaxNode): SyntaxNode {
  let node = call;
  while (node.parent?.type === 'member_expression' && node.parent.parent?.type === 'call_expression' && includes(STUB_METHODS, node.parent.childForFieldName('property')?.text)) node = node.parent.parent;
  return node;
}

/** True when the chain goes on with a call that gives the mock a fixed reply: `.mockReturnValue(1)`. */
function stubbedLater(call: SyntaxNode): boolean {
  for (let node = call; node.parent?.type === 'member_expression' && node.parent.parent?.type === 'call_expression'; node = node.parent.parent) {
    if (includes(STUB_METHODS, node.parent.childForFieldName('property')?.text)) return true;
  }
  return false;
}

export function readCalls(body: SyntaxNode, ctx: CallContext): CallFacts {
  const facts: CallFacts = { waits: [], selectors: [], steps: [], data: [], mocks: [], held: [], releases: [] };
  const { env } = ctx;
  const selectorOf = new Map<number, NSelector>();
  const mockNamed = new Map<string, NMock>();
  const positional: SyntaxNode[] = [];
  const assigned = new Set<string>();
  const hold = (node: SyntaxNode, kind: NResource['kind'], tokens: string[], autoManaged = false): void => {
    facts.held.push({ resource: { span: spanOfNode(node), text: clipText(node.text), kind, acquiredIn: ctx.acquiredIn, released: autoManaged, autoManaged }, tokens });
  };

  // Playwright fixtures in the test's own parameters: the runner makes and closes them.
  const parameters = isFunction(body.parent) ? body.parent!.childForFieldName('parameters')?.namedChildren[0] : null;
  for (const name of env.playwright && parameters ? parameters.descendantsOfType(['shorthand_property_identifier_pattern', 'property_identifier']) : []) {
    const kind = own(AUTO_FIXTURES, name.text);
    if (kind) hold(name, kind, [], true);
  }

  const onAssignment = (target: SyntaxNode, node: SyntaxNode): void => {
    if (target.type !== 'member_expression') return;
    const global = own(GLOBAL_OBJECTS, normalizedText(target.childForFieldName('object')!));
    if (!global) return;
    const { kind } = global;
    const token = `${kind}:${global.prefix}${target.childForFieldName('property')!.text}`;
    // The first write changes the state. A second write, a delete, or any write in an after hook puts it back.
    if (ctx.restores || assigned.has(token) || node.type === 'unary_expression') facts.releases.push(token);
    else hold(node, kind, [token]);
    assigned.add(token);
  };

  const onCall = (call: SyntaxNode): void => {
    const callee = call.childForFieldName('function')!;
    const object = callee.type === 'member_expression' ? callee.childForFieldName('object')! : null;
    const name = calleeName(call);
    const chain = memberChain(callee);
    const dotted = chain ? [chain.root, ...chain.members].join('.') : null;
    const root = rootName(call);
    const args = argumentsOf(call);
    const first = args[0] ? unwrap(args[0]) : null;
    const entry = { span: spanOfNode(call), text: clipText(call.text) };
    const onCypress = object?.type === 'identifier' && object.text === CYPRESS_ROOT;
    const ms = numberValue(first);

    // Waits.
    const sleeps = first !== null && !isFunction(first) && first.type !== 'object';
    const alias = first?.type === 'string' || first?.type === 'array';
    if (object && includes(FIXED_WAIT_METHODS, name) && sleeps) facts.waits.push({ ...entry, kind: alias ? 'condition' : 'fixed-sleep', ms: alias ? null : ms });
    else if (!object && includes(FIXED_WAIT_FUNCTIONS, name) && sleeps && call.parent?.type === 'await_expression') facts.waits.push({ ...entry, kind: 'fixed-sleep', ms });
    else if (object && own(WAIT_METHODS, name)) facts.waits.push({ ...entry, kind: WAIT_METHODS[name!]!, ms: WAIT_METHODS[name!] === 'fake-timer' ? ms : null });
    else if (object && includes(IMPLICIT_WAIT_METHODS, name) && first?.type === 'object') {
      const implicit = first.namedChildren.find((pair) => pair.childForFieldName('key')?.text === IMPLICIT_WAIT_KEY)?.childForFieldName('value');
      if (implicit) facts.waits.push({ ...entry, kind: 'implicit-wait-config', ms: numberValue(unwrap(implicit)) });
    }

    // Selectors.
    const pageAction = (own(SELECTOR_ACTIONS, name) ?? Infinity) <= args.length && object?.type === 'identifier' && includes(PAGE_OBJECTS, object.text) && literalText(args[0]) !== null;
    const queries = own(SELECTOR_CALLS, name) !== undefined && first !== null && !isFunction(first)
      && (object ? !includes(CYPRESS_ONLY_SELECTOR_CALLS, name) || root === CYPRESS_ROOT : includes(WDIO_LOCATORS, name) && env.webdriverio);
    if (pageAction || queries) {
      const value = literalText(args[0]);
      const fixed = pageAction ? null : SELECTOR_CALLS[name!]!;
      const selector: NSelector = { ...entry, api: root === CYPRESS_ROOT ? `${CYPRESS_ROOT}.${name}` : name!, strategy: fixed ?? (value === null ? 'other' : selectorStrategy(value, ctx.testIdAttributes)), value };
      facts.selectors.push(selector);
      selectorOf.set(call.id, selector);
    }
    if (object && own(POSITIONAL_CALLS, name)) positional.push(call);

    // Steps and data operations.
    const step = object ? own(STEP_METHODS, name) : undefined;
    if (step && (isLocator(object!, env) || includes(UI_ROOTS, root) || includes(WDIO_LOCATORS, root)) && !(includes(NEEDS_ARGUMENT, name) && args.length === 0)) facts.steps.push({ ...entry, kind: step });
    const method = object?.type === 'identifier' && includes(HTTP_CLIENTS, object.text) && own(HTTP_METHODS, name) ? name
      : !object && name === HTTP_FUNCTION ? optionMethod(args[1]) ?? 'get'
        : onCypress && name === CYPRESS_REQUEST ? [literalText(args[0])?.toLowerCase(), optionMethod(args[0])].find((candidate) => own(HTTP_METHODS, candidate)) ?? 'get' : null;
    const op = own(HTTP_METHODS, method);
    if (op) {
      facts.steps.push({ ...entry, kind: 'request' });
      facts.data.push({ ...entry, op, via: 'http' });
    }

    // Mocks.
    const functionMock = own(FUNCTION_MOCKS, dotted);
    const target = first ? literalText(args[0]) ?? clipText(first.text) : '';
    const mock = (fields: Pick<NMock, 'kind' | 'target' | 'targetsSubject' | 'passthrough' | 'stubbedReturn' | 'fulfillsAllNetwork'>): NMock => {
      const made = { ...entry, ...fields };
      facts.mocks.push(made);
      return made;
    };
    const calledIn = (node: SyntaxNode | undefined, names: readonly string[]): boolean => node !== undefined && node.descendantsOfType('call_expression').some((inner) => includes(names, calleeName(inner!)));
    if (includes(MODULE_MOCKS, dotted) && first) {
      const targetsSubject = ctx.subject ? moduleKey(target) === moduleKey(ctx.subject.module) : null;
      mock({ kind: 'module', target, targetsSubject, passthrough: calledIn(args[1], ACTUAL_MODULE_CALLS), stubbedReturn: false, fulfillsAllNetwork: false });
    } else if (functionMock && args.length >= 2) {
      const stubbed = stubbedLater(call);
      const made = mock({
        kind: 'function', target: `${normalizedText(args[0]!)}.${literalText(args[1]) ?? normalizedText(args[1]!)}`,
        targetsSubject: ctx.subject ? ctx.subject.names.has(rootName(args[0]!) ?? '') : null, passthrough: functionMock.passthrough && !stubbed, stubbedReturn: stubbed, fulfillsAllNetwork: false,
      });
      const variable = storedAs(withStubs(call));
      if (variable) mockNamed.set(variable, made);
      hold(call, 'spy', ['mocks', ...(variable ? [`var:${variable}`] : [])], functionMock.autoManaged ?? false);
    } else if (includes(BARE_MOCKS, dotted) && args.length < 2) {
      // `const total = vi.fn(() => 42)`: a mock with a name of its own. The name is its target.
      const variable = storedAs(withStubs(call));
      if (variable) mockNamed.set(variable, mock({ kind: 'function', target: variable, targetsSubject: ctx.subject ? false : null, passthrough: false, stubbedReturn: isFunction(first) || stubbedLater(call), fulfillsAllNetwork: false }));
    } else if (object && includes(STUB_METHODS, name) && mockNamed.has(normalizedText(object))) {
      Object.assign(mockNamed.get(normalizedText(object))!, { stubbedReturn: true, passthrough: false });
    } else if (object && name === ROUTE_METHOD && isFunction(args[1])) {
      const fulfills = calledIn(args[1], ROUTE_FULFILL);
      mock({ kind: 'network', target, targetsSubject: false, passthrough: !fulfills && calledIn(args[1], ROUTE_CONTINUE), stubbedReturn: fulfills, fulfillsAllNetwork: fulfills && includes(MATCH_ALL_PATTERNS, target) });
    } else if (onCypress && name === CYPRESS_INTERCEPT && first) {
      // cy.intercept(url), (method, url), (url, reply), (method, url, reply): a reply that is not a function is a canned one.
      const rest = own(HTTP_METHODS, literalText(args[0])?.toLowerCase()) ? args.slice(1) : args;
      const pattern = rest[0] ? literalText(rest[0]) ?? clipText(rest[0].text) : '';
      const canned = rest[1] !== undefined && !isFunction(rest[1]);
      mock({ kind: 'network', target: pattern, targetsSubject: false, passthrough: !canned, stubbedReturn: canned, fulfillsAllNetwork: canned && includes(MATCH_ALL_PATTERNS, pattern) });
    }

    // Resources and releases.
    const rule = own(RESOURCE_CALLS, dotted) ?? (object ? own(RESOURCE_CALLS, `.${name}`) : undefined);
    const owner = object ? normalizedText(object) : '';
    if (rule) {
      const variable = storedAs(call);
      // A page made from the `context` fixture is closed with it. One made from your own context is closed when that context is.
      const fromFixture = env.playwright && rule.kind === 'page' && own(AUTO_FIXTURES, owner) === 'context';
      const tokens = [...rule.releasedBy, ...(variable ? [`var:${variable}`] : []), ...(dotted && own(RESOURCE_CALLS, dotted) ? [] : [`var:${owner}`])];
      if (rule.named && literalText(args[0]) !== null) tokens.push(`${rule.kind}:${literalText(args[0])}`);
      hold(call, rule.kind === 'context' && owner.split('.').at(-1) === API_CONTEXT_OWNER ? 'api-context' : rule.kind, tokens, (rule.autoManaged ?? false) || fromFixture);
    }
    const released = own(RELEASE_CALLS, dotted);
    if (released) facts.releases.push(released);
    else if (object && includes(RELEASE_METHODS, name) && args.length === 0) facts.releases.push(`var:${owner}`);
  };

  const visit = (node: SyntaxNode): void => {
    if (ctx.skip.has(node.id)) return;
    if (node.type === 'call_expression') onCall(node);
    else if (node.type === 'assignment_expression') onAssignment(node.childForFieldName('left')!, node);
    else if (node.type === 'unary_expression' && node.childForFieldName('operator')?.text === 'delete') onAssignment(unwrap(node.childForFieldName('argument')!), node);
    else if (node.type === 'new_expression' && node.childForFieldName('constructor')?.text === 'Promise') {
      // `new Promise((resolve) => setTimeout(resolve, 500))` is a sleep: only the timer ends it. When something else can
      // call `resolve` too (`job.once('done', resolve)`), the timer is a time limit, not a sleep.
      const timer = node.descendantsOfType('call_expression').find((call) => call!.childForFieldName('function')?.text === TIMER_FUNCTION);
      const executor = node.childForFieldName('arguments')?.namedChildren[0];
      const resolve = isFunction(executor) ? (executor!.childForFieldName('parameters')?.namedChildren[0] ?? executor!.childForFieldName('parameter'))?.text : undefined;
      const uses = (within: SyntaxNode): number => within.descendantsOfType('identifier').filter((name) => name!.text === resolve).length;
      if (timer && resolve !== undefined && node.parent?.type === 'await_expression' && uses(timer) > 0 && uses(timer) === uses(executor!.childForFieldName('body')!)) {
        facts.waits.push({ span: spanOfNode(node), text: clipText(node.text), kind: 'fixed-sleep', ms: numberValue(argumentsOf(timer)[1]) });
      }
    }
    for (const child of node.namedChildren) visit(child);
  };
  visit(body);

  // In a chain the outer call is met first. Put every list in the order the calls end, which is the order they run.
  const byEnd = (a: { span: NWait['span'] }, b: typeof a): number => a.span.endLine - b.span.endLine || a.span.endColumn - b.span.endColumn;
  for (const list of [facts.waits, facts.selectors, facts.steps, facts.data, facts.mocks]) list.sort(byEnd);

  // `.first()`, `.nth(2)`: a positional pick, noted on the selector it narrows.
  for (const call of positional) {
    let base: SyntaxNode | null = call.childForFieldName('function')!.childForFieldName('object');
    while (base?.type === 'call_expression' && !selectorOf.has(base.id)) base = base.childForFieldName('function')?.childForFieldName('object') ?? null;
    const selector = base ? selectorOf.get(base.id) : undefined;
    const index = argumentsOf(call)[0];
    if (selector && !selector.positional) selector.positional = { kind: POSITIONAL_CALLS[calleeName(call)!]!, index: numberValue(index), baseStrategy: selector.strategy };
  }
  return facts;
}
