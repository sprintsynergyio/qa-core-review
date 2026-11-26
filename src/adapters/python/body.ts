// Python: what a test body does besides checking (SPEC.md Sections 8.1 and 9.2): waits,
// selectors, steps, data operations, mocks, and the resources it takes and releases.
import { clipText } from '../../model/build.js';
import { selectorStrategy } from '../../model/selectors.js';
import type { NDataOp, NMock, NResource, NSelector, NStep, NWait, SelectorStrategy } from '../../model/types.js';
import { spanOfNode } from '../../parse/positions.js';
import type { SyntaxNode } from '../../parse/treesitter.js';
import { calleeName, isLocator, normalizedText, numberValue, unwrap, type Env } from './expr.js';
import { argumentsOf, dottedName, qualify, stringValue } from './syntax.js';
import {
  AUTO_FIXTURES, BARE_MOCKS, BY_STRATEGIES, CLEANUP_REGISTRARS, CONDITION_WAIT_PREFIX, ENVIRONMENT, FAKE_TIME_CALLS, FIXED_SLEEPS, FIXED_WAIT_METHODS, HTTP_CLIENT_NAMES, HTTP_METHODS,
  HTTP_MODULES, IMPLICIT_WAIT_METHODS, MATCH_ALL_PATTERNS, MONKEYPATCH_ENV, MONKEYPATCH_SETATTR, NETWORK_MOCK_METHODS, NETWORK_MOCK_ROOTS, OBJECT_PATCH_CALLS, PAGE_OBJECTS,
  PASSTHROUGH_KEYWORD, PATCH_CALLS, PLAYWRIGHT_STARTERS, POSITIONAL, RELEASE_CALLS, RELEASE_METHODS, RESOURCE_CALLS, ROUTE_CONTINUE, ROUTE_FULFILL, ROUTE_METHOD, SELECTOR_ACTIONS,
  SELECTOR_CALLS, SELENIUM_BY, SELENIUM_FINDERS, SELENIUM_OLD_LOCATOR_PREFIX, SELENIUM_WAIT, SELENIUM_WAIT_METHODS, SQL_METHODS, SQL_VERBS, START_METHOD, STEP_METHODS, STUB_ATTRIBUTES,
  STUB_KEYWORDS,
} from './vocab.js';

export interface CallContext {
  env: Env;
  acquiredIn: NResource['acquiredIn'];
  /** An after hook restores state: a write to the environment there is a release, not a new resource. */
  restores: boolean;
  /** The module under test, and the local names imported from it. Null when it is not known. */
  subject: { module: string; names: ReadonlySet<string> } | null;
  /** The modules the file imports, by their full name. */
  modules: ReadonlySet<string>;
  /** Every name the file calls, as it is written: `get_total`, `cart.get_total`. */
  called: ReadonlySet<string>;
  testIdAttributes: readonly string[];
  /** Subtrees to leave out, by node id. */
  skip: ReadonlySet<number>;
  /** The function that owns the body: its parameters name the fixtures it uses. */
  definition?: SyntaxNode | null;
  /** The decorators of that function. A `@patch(...)` among them hands the function a mock as a parameter. */
  decorators?: readonly SyntaxNode[];
  /** The root of the file, to find a named route handler. */
  root?: SyntaxNode;
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
  /** Tokens released here: 'patches', 'env:API_URL', 'var:self.driver', ... */
  releases: string[];
}

const includes = (list: readonly string[], value: string | null | undefined): boolean => value != null && list.includes(value);
const own = <T>(table: Readonly<Record<string, T>>, key: string | null | undefined): T | undefined => (key != null && Object.hasOwn(table, key) ? table[key] : undefined);
/** `find_element_by_id` and `find_elements_by_id`: the old Selenium finders, with the strategy in their name. */
const OLD_FINDER = new RegExp(`^${SELENIUM_OLD_LOCATOR_PREFIX.replace('element', 'elements?')}`);
const LITERAL_VALUES = new Set(['string', 'concatenated_string', 'integer', 'float', 'true', 'false', 'none', 'list', 'tuple', 'dictionary', 'set', 'lambda']);

/** A string argument with no `{...}` part in it, or null. */
function literalText(node: SyntaxNode | null | undefined): string | null {
  const expr = node ? unwrap(node) : null;
  return expr && (expr.type === 'string' || expr.type === 'concatenated_string') && expr.descendantsOfType('interpolation').length === 0 ? stringValue(expr) : null;
}

/** The name a value is stored under: `x = call()`, `self.x = await call()`, `with call() as x:`. */
function storedAs(call: SyntaxNode): string | null {
  let node = call;
  while (node.parent && (node.parent.type === 'await' || node.parent.type === 'parenthesized_expression')) node = node.parent;
  const holder = node.parent;
  const target = holder?.type === 'assignment' && holder.childForFieldName('right')?.id === node.id ? holder.childForFieldName('left')
    : holder?.type === 'as_pattern' ? holder.childForFieldName('alias')?.namedChildren[0] : null;
  return target && (target.type === 'identifier' || target.type === 'attribute') ? normalizedText(target) : null;
}

/** True when the call is what a `with` block is opened on: the block closes it. */
function managed(call: SyntaxNode): boolean {
  let node = call;
  while (node.parent && (node.parent.type === 'await' || node.parent.type === 'parenthesized_expression' || node.parent.type === 'as_pattern')) node = node.parent;
  return node.parent?.type === 'with_item';
}

/** Reads the given nodes: the body of a test or a hook, with the decorators of the function before it. */
export function readCalls(nodes: readonly SyntaxNode[], ctx: CallContext): CallFacts {
  const facts: CallFacts = { waits: [], selectors: [], steps: [], data: [], mocks: [], held: [], releases: [] };
  const { env } = ctx;
  const nameOf = (node: SyntaxNode | null | undefined): string | null => qualify(dottedName(node), env.aliases);
  const selectorOf = new Map<number, NSelector>();
  const mockNamed = new Map<string, NMock>();
  const written = new Set<string>();
  /** Variables that hold a patcher: `self.patcher = patch("a.b")`. */
  const patchers = new Set<string>();
  /** Picks by position, applied when every selector is known: in `page.locator("li").nth(2)` the outer call is met first. */
  const picks: Array<() => void> = [];
  const hold = (node: SyntaxNode, kind: NResource['kind'], tokens: string[], state: { released?: boolean; autoManaged?: boolean } = {}): void => {
    const autoManaged = state.autoManaged ?? false;
    facts.held.push({ resource: { span: spanOfNode(node), text: clipText(node.text), kind, acquiredIn: ctx.acquiredIn, released: autoManaged || (state.released ?? false), autoManaged }, tokens });
  };
  const selector = (node: SyntaxNode, api: string, fixed: SelectorStrategy | null | undefined, value: SyntaxNode | null | undefined): NSelector => {
    const text = literalText(value);
    const made: NSelector = { span: spanOfNode(node), text: clipText(node.text), api, strategy: fixed ?? (text === null ? 'other' : selectorStrategy(text, ctx.testIdAttributes)), value: text };
    facts.selectors.push(made);
    selectorOf.set(node.id, made);
    return made;
  };
  /** `.first`, `.nth(2)`, `[0]`: a pick by position, noted on the selector it narrows. */
  const pick = (base: SyntaxNode | null, kind: 'nth' | 'first' | 'last', index: number | null): void => {
    let node = base ? unwrap(base) : null;
    while (node && !selectorOf.has(node.id) && (node.type === 'call' || node.type === 'attribute')) node = node.childForFieldName(node.type === 'call' ? 'function' : 'object');
    const made = node ? selectorOf.get(node.id) : undefined;
    if (made && !made.positional) made.positional = { kind, index, baseStrategy: made.strategy };
  };

  // Fixtures that pytest makes and cleans up, by the parameters of the function.
  for (const parameter of ctx.definition?.childForFieldName('parameters')?.namedChildren ?? []) {
    const name = parameter.type === 'identifier' ? parameter : parameter.namedChildren.find((child) => child.type === 'identifier');
    const kind = own(AUTO_FIXTURES, name?.text);
    if (name && kind) hold(name, kind, [], { autoManaged: true });
  }

  /** Does a handler (a lambda, or a function of this file by name) call one of these methods? */
  const handlerCalls = (handler: SyntaxNode | undefined, names: readonly string[]): boolean => {
    const body = handler?.type === 'identifier'
      ? ctx.root?.descendantsOfType('function_definition').find((definition) => definition?.childForFieldName('name')?.text === handler.text) ?? null : handler ?? null;
    return body !== null && body.descendantsOfType('call').some((call) => call !== null && includes(names, calleeName(call)));
  };
  const mock = (node: SyntaxNode, fields: Omit<NMock, 'span' | 'text'>): NMock => {
    const made = { span: spanOfNode(node), text: clipText(node.text), ...fields };
    facts.mocks.push(made);
    return made;
  };
  /** The module part of `pkg.mod.name` is the subject: true when the file also imports that name from it or calls it there itself, null when it may be something the subject imports. */
  const targetsSubject = (target: string | null, object: SyntaxNode | null): boolean | null => {
    if (!ctx.subject) return null;
    if (object) return ctx.subject.names.has(dottedName(object)?.split('.')[0] ?? '');
    if (target === null) return null;
    const { module, names } = ctx.subject;
    if (target === module) return true;
    if (!target.startsWith(`${module}.`)) return false;
    // `shop.cart.Cart.total` patches a part of `Cart`.
    return names.has(target.slice(module.length + 1).split('.')[0]!) || ctx.called.has(spelled(target)) ? true : null;
  };

  /**
   * `patch("shop.cart")` replaces a module the file imports, `patch("shop.cart.Cart")` a class and `patch("shop.cart.get_total")`
   * a function. Classes are named in CapWords; a name in capitals only (`LIMIT`) is a constant.
   */
  const kindOf = (target: string | null): NMock['kind'] => {
    if (target !== null && (target === ctx.subject?.module || ctx.modules.has(target))) return 'module';
    return /^[A-Z]\w*[a-z]/.test(target?.split('.').at(-1) ?? '') ? 'class' : 'function';
  };
  /**
   * A patched function is named the way the file itself calls it, so that a rule can see the test call it:
   * `get_total` after `from shop.cart import get_total`, `cart.get_total` after `from shop import cart`.
   */
  const spelled = (target: string): string => {
    let best: readonly [string, string] | null = null;
    for (const entry of ctx.env.aliases) {
      if ((target === entry[1] || target.startsWith(`${entry[1]}.`)) && entry[1].length > (best?.[1].length ?? 0)) best = entry;
    }
    return best ? `${best[0]}${target.slice(best[1].length)}` : target;
  };
  const named = (target: string | null, fallback: string): Pick<NMock, 'kind' | 'target'> => {
    const kind = kindOf(target);
    return { kind, target: target === null ? fallback : kind === 'function' ? spelled(target) : target };
  };

  const onCall = (call: SyntaxNode): void => {
    const callee = call.childForFieldName('function')!;
    const object = callee.type === 'attribute' ? callee.childForFieldName('object')! : null;
    const name = calleeName(call);
    const dotted = nameOf(callee);
    const { positional: args, keywords } = argumentsOf(call);
    const first = args[0] ? unwrap(args[0]) : null;
    const entry = { span: spanOfNode(call), text: clipText(call.text) };
    const owner = object ? normalizedText(object) : '';
    const ownerName = owner.split('.').at(-1) ?? '';

    // Waits.
    const amount = numberValue(first);
    if (own(FIXED_SLEEPS, dotted) !== undefined) facts.waits.push({ ...entry, kind: 'fixed-sleep', ms: amount === null ? null : Math.round(amount * FIXED_SLEEPS[dotted!]!) });
    else if (object && own(FIXED_WAIT_METHODS, name) !== undefined) facts.waits.push({ ...entry, kind: 'fixed-sleep', ms: amount === null ? null : Math.round(amount * FIXED_WAIT_METHODS[name!]!) });
    else if (object && own(IMPLICIT_WAIT_METHODS, name) !== undefined) facts.waits.push({ ...entry, kind: 'implicit-wait-config', ms: amount === null ? null : Math.round(amount * IMPLICIT_WAIT_METHODS[name!]!) });
    else if (object && name?.startsWith(CONDITION_WAIT_PREFIX)) facts.waits.push({ ...entry, kind: 'condition', ms: null });
    else if (object && includes(SELENIUM_WAIT_METHODS, name) && ((object.type === 'call' && calleeName(object) === SELENIUM_WAIT) || ownerName.toLowerCase().includes('wait'))) facts.waits.push({ ...entry, kind: 'condition', ms: null });
    else if (includes(FAKE_TIME_CALLS, dotted)) facts.waits.push({ ...entry, kind: 'fake-timer', ms: null });

    // Selectors: Playwright calls, page actions with a selector, and the old Selenium finders. `By.X` pairs are read where they stand.
    const onPage = object !== null && (includes(PAGE_OBJECTS, ownerName) || ownerName.endsWith('_page'));
    if (object && own(SELECTOR_CALLS, name) !== undefined && first) selector(call, name!, SELECTOR_CALLS[name!], first);
    else if (onPage && (own(SELECTOR_ACTIONS, name) ?? Infinity) <= args.length && literalText(first) !== null) selector(call, name!, null, first);
    else if (object && OLD_FINDER.test(name ?? '') && first) selector(call, name!, own(BY_STRATEGIES, name!.replace(OLD_FINDER, '').toUpperCase()) ?? null, first);
    if (object && name === 'nth') picks.push(() => pick(object, 'nth', numberValue(first)));

    // Steps and data operations.
    const step = object ? own(STEP_METHODS, name) : undefined;
    if (step && (isLocator(object!, env) || onPage)) facts.steps.push({ ...entry, kind: step });
    else if (object && name === 'get' && ownerName.endsWith('driver') && args.length === 1) facts.steps.push({ ...entry, kind: 'navigate' });
    const client = object !== null && (includes(HTTP_MODULES, nameOf(object)) || includes(HTTP_CLIENT_NAMES, ownerName));
    const op = client ? own(HTTP_METHODS, name) : undefined;
    if (op) {
      facts.steps.push({ ...entry, kind: 'request' });
      facts.data.push({ ...entry, op, via: 'http' });
    }
    const sql = object && includes(SQL_METHODS, name) ? own(SQL_VERBS, /^\s*(\w+)/.exec(literalText(first) ?? '')?.[1]?.toLowerCase()) : undefined;
    if (sql) facts.data.push({ ...entry, op: sql, via: 'db' });

    // Mocks.
    const stubbed = STUB_KEYWORDS.some((keyword) => keywords.has(keyword));
    const passthrough = keywords.has(PASSTHROUGH_KEYWORD);
    const variable = storedAs(call);
    const remember = (made: NMock, patcher = false): void => {
      if (variable) mockNamed.set(variable, made);
      if (variable && patcher) patchers.add(variable);
    };
    if (own(PATCH_CALLS, dotted) !== undefined && first) {
      const target = literalText(first);
      // `patch("a.b", fake)`: the second argument is what replaces it.
      remember(mock(call, { ...named(target, clipText(first.text)), targetsSubject: targetsSubject(target, null), passthrough, stubbedReturn: (stubbed || args.length >= 2) && !passthrough, fulfillsAllNetwork: false }), true);
    } else if (own(OBJECT_PATCH_CALLS, dotted) !== undefined && args.length >= 2) {
      const spy = OBJECT_PATCH_CALLS[dotted!]! || passthrough;
      remember(mock(call, {
        kind: 'function', target: `${normalizedText(args[0]!)}.${literalText(args[1]) ?? normalizedText(args[1]!)}`, targetsSubject: targetsSubject(null, unwrap(args[0]!)),
        passthrough: spy, stubbedReturn: (stubbed || args.length >= 3) && !spy, fulfillsAllNetwork: false,
      }), true);
    } else if (dotted === MONKEYPATCH_SETATTR && args.length >= 2) {
      // setattr("pkg.mod.name", value) or setattr(obj, "name", value). A lambda, a literal or a mock with a reply is a canned value.
      const text = args.length === 2 ? literalText(first) : null;
      const value = unwrap(args.at(-1)!);
      const canned = LITERAL_VALUES.has(value.type) || (value.type === 'call' && STUB_KEYWORDS.some((keyword) => argumentsOf(value).keywords.has(keyword)));
      mock(call, {
        ...named(text, args.length >= 3 ? `${normalizedText(args[0]!)}.${literalText(args[1]) ?? normalizedText(args[1]!)}` : clipText(first!.text)),
        targetsSubject: args.length >= 3 ? targetsSubject(null, first) : targetsSubject(text, null), passthrough: false, stubbedReturn: canned, fulfillsAllNetwork: false,
      });
    } else if (includes(BARE_MOCKS, dotted) && variable && !includes(STUB_ATTRIBUTES, variable.split('.').at(-1))) {
      // `send = Mock(return_value=1)`: a mock with a name of its own. The name is its target.
      remember(mock(call, { kind: 'function', target: variable, targetsSubject: ctx.subject ? false : null, passthrough, stubbedReturn: stubbed && !passthrough, fulfillsAllNetwork: false }));
    } else if (object && name === ROUTE_METHOD && args.length >= 2 && (onPage || ownerName.endsWith('context'))) {
      const pattern = literalText(first) ?? clipText(first!.text);
      const fulfills = handlerCalls(unwrap(args[1]!), [ROUTE_FULFILL]);
      mock(call, { kind: 'network', target: pattern, targetsSubject: false, passthrough: !fulfills && handlerCalls(unwrap(args[1]!), ROUTE_CONTINUE), stubbedReturn: fulfills, fulfillsAllNetwork: fulfills && includes(MATCH_ALL_PATTERNS, pattern) });
    } else if (object && includes(NETWORK_MOCK_ROOTS, dottedName(object)) && includes(NETWORK_MOCK_METHODS, name)) {
      // responses.add(responses.GET, url, json=...), respx.get(url), requests_mock.get(url, json=...): the URL is the first string.
      const texts = [...args, keywords.get('url')].map((argument) => (argument ? stringValue(unwrap(argument)) : null));
      const url = texts.find((text) => text !== null && own(HTTP_METHODS, text.toLowerCase()) === undefined) ?? '';
      mock(call, { kind: 'network', target: url, targetsSubject: false, passthrough: false, stubbedReturn: true, fulfillsAllNetwork: includes(MATCH_ALL_PATTERNS, url) });
    }

    // Resources and releases.
    const rule = own(RESOURCE_CALLS, dotted) ?? (object ? own(RESOURCE_CALLS, `.${name}`) : undefined);
    const closedByBlock = managed(call);
    if (rule) {
      // A page made from the `context` fixture is closed with it.
      const fromFixture = rule.kind === 'page' && own(AUTO_FIXTURES, owner) === 'context' && [...facts.held].some(({ resource }) => resource.autoManaged && resource.kind === 'context');
      const tokens = [...rule.releasedBy, ...(variable ? [`var:${variable}`] : []), ...(object ? [`var:${owner}`] : [])];
      hold(call, rule.kind, tokens, { released: closedByBlock, autoManaged: fromFixture });
    } else if (object && name === START_METHOD && args.length === 0) {
      // `patch("a.b").start()` and `sync_playwright().start()`: started by hand, so they need a stop.
      const started = unwrap(object);
      const made = started.type === 'call' ? nameOf(started.childForFieldName('function')) : null;
      const patcher = patchers.has(owner) || own(PATCH_CALLS, made) !== undefined || own(OBJECT_PATCH_CALLS, made) !== undefined;
      const playwright = includes(PLAYWRIGHT_STARTERS, made);
      if (patcher || playwright) hold(call, patcher ? 'patch' : 'browser', [...(patcher ? ['patches'] : []), ...(variable ? [`var:${variable}`] : []), ...(started.type === 'call' ? [] : [`var:${owner}`])]);
    } else if (includes(MONKEYPATCH_ENV, dotted)) hold(call, 'env', [], { autoManaged: true });

    const released = own(RELEASE_CALLS, dotted);
    if (released) facts.releases.push(released);
    else if (object && includes(RELEASE_METHODS, name) && args.length === 0) facts.releases.push(`var:${owner}`);
    else if (includes(CLEANUP_REGISTRARS, dotted) && first?.type === 'attribute') {
      // self.addCleanup(self.driver.quit): the release is registered now and runs after the test.
      const method = first.childForFieldName('attribute')?.text;
      facts.releases.push(includes(RELEASE_METHODS, method) ? `var:${normalizedText(first.childForFieldName('object')!)}` : own(RELEASE_CALLS, nameOf(first)) ?? `call:${normalizedText(first)}`);
    } else if (object && nameOf(object) === ENVIRONMENT && name === 'pop' && literalText(first) !== null) facts.releases.push(`env:${literalText(first)}`);
  };

  /** `os.environ["KEY"] = value` changes the environment. A second write, a `del`, or any write in an after hook puts it back. */
  const onEnvironment = (target: SyntaxNode, node: SyntaxNode, removes: boolean): void => {
    if (target.type !== 'subscript' || nameOf(target.childForFieldName('value')) !== ENVIRONMENT) return;
    const key = literalText(target.childForFieldName('subscript'));
    if (key === null) return;
    const token = `env:${key}`;
    if (ctx.restores || written.has(token) || removes) facts.releases.push(token);
    else hold(node, 'env', [token]);
    written.add(token);
  };

  const visit = (node: SyntaxNode): void => {
    if (ctx.skip.has(node.id)) return;
    if (node.type === 'call') onCall(node);
    else if (node.type === 'assignment') {
      const left = node.childForFieldName('left');
      if (left) onEnvironment(left, node, false);
      // `send.return_value = 1` gives a mock a fixed reply after it was made.
      const made = left?.type === 'attribute' && includes(STUB_ATTRIBUTES, left.childForFieldName('attribute')?.text) ? mockNamed.get(normalizedText(left.childForFieldName('object')!)) : undefined;
      if (made) Object.assign(made, { stubbedReturn: true, passthrough: false });
    } else if (node.type === 'delete_statement' && node.namedChildren[0]) onEnvironment(unwrap(node.namedChildren[0]), node, true);
    else if (node.type === 'attribute' && node.childForFieldName('object')?.type === 'identifier' && node.childForFieldName('object')!.text === SELENIUM_BY) {
      // `By.ID, "user-name"`: the strategy and the selector stand next to each other, as two arguments or as a tuple.
      const constant = node.childForFieldName('attribute')!.text;
      const value = node.nextNamedSibling;
      const holder = node.parent?.type === 'argument_list' ? node.parent.parent! : node.parent!;
      if (Object.hasOwn(BY_STRATEGIES, constant) && value && (node.parent?.type === 'argument_list' || node.parent?.type === 'tuple')) {
        const made = selector(holder, `${SELENIUM_BY}.${constant}`, BY_STRATEGIES[constant], value);
        // `find_elements(...)[0]`: the first of a list.
        const index = holder.parent?.type === 'subscript' && includes(SELENIUM_FINDERS, calleeName(holder)) ? numberValue(holder.parent.childForFieldName('subscript')) : null;
        if (index !== null) made.positional = { kind: index === 0 ? 'first' : 'nth', index, baseStrategy: made.strategy };
      }
    } else if (node.type === 'attribute' && node.parent?.type !== 'call' && own(POSITIONAL, node.childForFieldName('attribute')?.text) && node.childForFieldName('attribute')!.text !== 'nth') {
      picks.push(() => pick(node.childForFieldName('object'), POSITIONAL[node.childForFieldName('attribute')!.text]!, null));
    }
    for (const child of node.namedChildren) visit(child);
  };
  // Each `@patch(...)` decorator fills one parameter, the lowest decorator first. The parameter is then the name of that mock,
  // so `charge.return_value = 42` in the body is seen as a fixed reply.
  const injected: NMock[] = [];
  for (const decorator of ctx.decorators ?? []) {
    const before = facts.mocks.length;
    visit(decorator);
    const call = decorator.namedChildren[0];
    if (facts.mocks.length === before || !call) continue;
    // A patch that is given its replacement (`new=`, or one more argument) hands over nothing.
    const given = argumentsOf(call);
    const replacementAt = own(OBJECT_PATCH_CALLS, nameOf(call.childForFieldName('function'))) !== undefined ? 3 : 2;
    if (!given.keywords.has('new') && given.positional.length < replacementAt) injected.push(facts.mocks[before]!);
  }
  const parameters = (ctx.definition?.childForFieldName('parameters')?.namedChildren ?? []).map((parameter) => (parameter.type === 'identifier' ? parameter.text : parameter.namedChildren.find((child) => child.type === 'identifier')?.text ?? ''));
  parameters.filter((name) => name !== 'self' && name !== 'cls').slice(0, injected.length).forEach((name, index) => mockNamed.set(name, injected[injected.length - 1 - index]!));
  for (const node of nodes) visit(node);
  for (const apply of picks) apply();

  // In a chain the outer call is met first. Put every list in the order the calls end, which is the order they run.
  const byEnd = (a: { span: NWait['span'] }, b: typeof a): number => a.span.endLine - b.span.endLine || a.span.endColumn - b.span.endColumn;
  for (const list of [facts.waits, facts.selectors, facts.steps, facts.data, facts.mocks]) list.sort(byEnd);
  return facts;
}
