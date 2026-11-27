// Java: what a test body does besides checking (SPEC.md Sections 8.1 and 9.3): waits,
// selectors, steps, data operations, mocks, and the resources it takes and releases. The same
// reader goes over the fields of a class: `@Mock`, `@FindBy`, `driver = new ChromeDriver()`.
import { clipText } from '../../model/build.js';
import { selectorStrategy } from '../../model/selectors.js';
import type { NDataOp, NMock, NResource, NSelector, NStep, NWait, SelectorStrategy } from '../../model/types.js';
import { spanOfNode } from '../../parse/positions.js';
import type { SyntaxNode } from '../../parse/treesitter.js';
import { intValue, isLocator, nameOf, normalizedText, rootName, unwrap, type Env } from './expr.js';
import { annotationsOf, dottedName, elementsOf, statementsOf, stringValue } from './syntax.js';
import {
  AUTO_CLOSED_KINDS, AWAIT_ROOTS, BY_METHODS, CONDITION_WAIT_PREFIX, DRIVER_MANAGER, DRIVER_NAVIGATION, DRIVER_TYPE, DURATION_FACTORIES, FIND_BY_ANNOTATION, FIND_BY_ELEMENTS, FIND_BY_HOW,
  FIND_BY_HOW_ELEMENT, FIND_BY_USING_ELEMENT, FIXED_SLEEPS, FIXED_WAIT_METHODS, HTTP_CLIENT_NAMES, HTTP_METHODS, IMPLICIT_WAIT_METHODS, LIST_FINDERS, LIST_PICK_METHOD, MATCH_ALL_PATTERNS,
  MOCK_FACTORIES, MOCK_FIELD_ANNOTATIONS, PAGE_OBJECTS, PAGE_TYPES, PASSTHROUGH_ANSWER, POSITIONAL, PROPERTY_CLEAR, PROPERTY_SET, REAL_METHOD_REPLIES, RELEASE_METHODS, REPOSITORY_METHODS,
  REPOSITORY_SUFFIXES, RESOURCE_CALLS, RESOURCE_TYPES, REST_STARTERS, REST_TEMPLATE_METHODS, RESTASSURED_PACKAGE, RESTASSURED_THEN, ROUTE_CONTINUE, ROUTE_FULFILL, ROUTE_METHOD, ROUTE_OWNER_TYPES, SCOPED_MOCK_FACTORIES,
  SELECTOR_ACTIONS, SELECTOR_CALLS, SELENIDE_SELECTORS, SELENIUM_BY, SPY_NAMES, SQL_METHODS, SQL_VERBS, STEP_METHODS, STUB_CALLS, STUB_REPLIES_FIRST, STUB_REPLY_PREFIXES,
  TIME_UNITS, UNIT_SLEEP_METHOD, WAIT_METHODS, WAIT_TYPES, WIREMOCK_ANY_URL, WIREMOCK_ANY_VERB, WIREMOCK_REPLY, WIREMOCK_STUB,
} from './vocab.js';

export interface CallContext {
  env: Env;
  acquiredIn: NResource['acquiredIn'];
  /** An after hook restores state: a write to a system property there is a release, not a new resource. */
  restores: boolean;
  /** The class under test, by its simple name. Null when it is not known. */
  subject: string | null;
  /** The full name behind a name as it is written, from the imports of the file. */
  resolve(written: string | null, known: (name: string) => boolean): string | null;
  /** The file imports REST Assured, so `given()...post("/orders")` is a request. */
  restAssured: boolean;
  testIdAttributes: readonly string[];
  /** The parameters of the method: objects that the test framework hands in and cleans up. */
  parameters: ReadonlySet<string>;
  /** The mocks that are fields of the class, by the name of the field. A reply given in a body is noted on them. */
  fieldMocks: ReadonlyMap<string, NMock>;
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
  /** Tokens released here: 'var:driver', 'env:API_URL', ... */
  releases: string[];
  /** Mocks and `@FindBy` selectors that are fields, by the name of the field. */
  mockNamed: Map<string, NMock>;
  fieldSelectors: Map<string, NSelector>;
}

const includes = (list: readonly string[], value: string | null | undefined): boolean => value != null && list.includes(value);
const own = <T>(table: Readonly<Record<string, T>>, key: string | null | undefined): T | undefined => (key != null && Object.hasOwn(table, key) ? table[key] : undefined);
const lastPart = (name: string): string => name.slice(name.lastIndexOf('.') + 1);
/** `Cart` for `Cart`, `shop.Cart`, `List<Cart>` and `Cart[]`: the class a type names first. */
export const typeName = (type: string | null | undefined): string | null => (type ? lastPart(type.replace(/[<[].*$/s, '').trim()) || null : null);
const WRAPPERS = new Set(['parenthesized_expression', 'cast_expression']);
const callName = (node: SyntaxNode | null | undefined): string | null => (node?.type === 'method_invocation' ? node.childForFieldName('name')?.text ?? null : null);
const argumentsOf = (call: SyntaxNode): SyntaxNode[] => statementsOf(call.childForFieldName('arguments'));
/** The first call of a chain: `given()` in `given().header(...).post("/orders")`. */
function rootCall(call: SyntaxNode): SyntaxNode {
  let node = call;
  for (let next = node.childForFieldName('object'); next?.type === 'method_invocation'; next = node.childForFieldName('object')) node = next;
  return node;
}

/** The name a value is stored under: `Type x = call()`, `x = call()`, `this.x = call()`, and a resource of a try block. */
function storedAs(value: SyntaxNode): string | null {
  let node = value;
  while (node.parent && WRAPPERS.has(node.parent.type)) node = node.parent;
  const holder = node.parent;
  if ((holder?.type === 'variable_declarator' || holder?.type === 'resource') && holder.childForFieldName('value')?.id === node.id) return holder.childForFieldName('name')?.text ?? null;
  return holder?.type === 'assignment_expression' && holder.childForFieldName('right')?.id === node.id ? nameOf(holder.childForFieldName('left')) : null;
}
/** True when the value is a resource of a try-with-resources: the block closes it. */
function managed(value: SyntaxNode): boolean {
  let node = value;
  while (node.parent && WRAPPERS.has(node.parent.type)) node = node.parent;
  return node.parent?.type === 'resource';
}

/** Reads the given nodes: the body of a test or a hook, or the fields of a class. */
export function readCalls(nodes: readonly SyntaxNode[], ctx: CallContext): CallFacts {
  const facts: CallFacts = { waits: [], selectors: [], steps: [], data: [], mocks: [], held: [], releases: [], mockNamed: new Map(), fieldSelectors: new Map() };
  const { env } = ctx;
  const selectorOf = new Map<number, NSelector>();
  const written = new Set<string>();
  /** Picks by position, applied when every selector is known: in `page.locator("li").nth(2)` the outer call is met first. */
  const picks: Array<() => void> = [];
  /** Names bound by a try-with-resources: the block closes what is made from them. */
  const blockOwned = new Set<string>();
  /** What releases the resource a variable holds. Closing a browser closes the pages made from it, and so does what closes the browser. */
  const tokensOf = new Map<string, string[]>();
  const typeOf = (name: string | null): string | null => typeName(env.types.get(name ?? ''));
  const literalText = (node: SyntaxNode | null | undefined): string | null => (node && ['string_literal', 'binary_expression'].includes(unwrap(node).type) ? stringValue(unwrap(node)) : null);

  const hold = (node: SyntaxNode, kind: NResource['kind'], tokens: string[], state: { released?: boolean; autoManaged?: boolean } = {}): void => {
    const autoManaged = state.autoManaged ?? false;
    facts.held.push({ resource: { span: spanOfNode(node), text: clipText(node.text), kind, acquiredIn: ctx.acquiredIn, released: autoManaged || (state.released ?? false), autoManaged }, tokens });
  };
  const selector = (node: SyntaxNode, api: string, fixed: SelectorStrategy | null | undefined, value: SyntaxNode | null | undefined, keep = true): NSelector => {
    const text = literalText(value);
    const made: NSelector = { span: spanOfNode(node), text: clipText(node.text), api, strategy: fixed ?? (text === null ? 'other' : selectorStrategy(text, ctx.testIdAttributes)), value: text };
    if (keep) facts.selectors.push(made);
    selectorOf.set(node.id, made);
    return made;
  };
  /** `.first()`, `.nth(2)`, `.get(2)`: a pick by position, noted on the selector it narrows. */
  const pick = (base: SyntaxNode | null, kind: 'nth' | 'first' | 'last', index: number | null): void => {
    let node = base ? unwrap(base) : null;
    while (node && !selectorOf.has(node.id) && node.type === 'method_invocation') {
      // `driver.findElements(By.id("row"))`: the selector is the argument.
      const inside = argumentsOf(node).find((argument) => selectorOf.has(unwrap(argument).id));
      node = inside ? unwrap(inside) : node.childForFieldName('object');
    }
    const made = node ? selectorOf.get(node.id) : undefined;
    if (made && !made.positional) made.positional = { kind, index, baseStrategy: made.strategy };
  };
  /**
   * A mocked class goes by its simple name. A Java test uses the classes of its own package with no import, so the imports of a file
   * never say that everything it uses is mocked, and the full name would only invite that conclusion.
   */
  const mock = (node: SyntaxNode, fields: Omit<NMock, 'span' | 'text'>): NMock => {
    const made = { span: spanOfNode(node), text: clipText(node.text), ...fields };
    facts.mocks.push(made);
    return made;
  };
  const targetsSubject = (type: string | null): boolean | null => (ctx.subject === null || type === null ? null : type === ctx.subject);
  /** A number of milliseconds: `500`, `2, TimeUnit.SECONDS`, `Duration.ofSeconds(2)`. Null when it is not written out. */
  const msOf = (args: readonly SyntaxNode[], perNumber: number): number | null => {
    const first = args[0] ? unwrap(args[0]) : null;
    const unit = args[1] ? own(TIME_UNITS, lastPart(normalizedText(args[1]))) : undefined;
    const plain = intValue(first);
    if (plain !== null) return Math.round(plain * (unit ?? perNumber));
    const factor = own(DURATION_FACTORIES, callName(first));
    const inner = factor === undefined ? null : intValue(argumentsOf(first!)[0]);
    return inner === null ? null : Math.round(inner * factor!);
  };

  const onCall = (call: SyntaxNode): void => {
    const name = callName(call) ?? '';
    const object = call.childForFieldName('object');
    const args = argumentsOf(call);
    const first = args[0] ? unwrap(args[0]) : null;
    const entry = { span: spanOfNode(call), text: clipText(call.text) };
    const owner = object ? nameOf(object) ?? normalizedText(object) : '';
    const ownerName = lastPart(owner);
    const ownerRoot = object ? rootName(object) : null;
    const ownerType = typeOf(owner);
    const spelled = object ? `${ownerName}.${name}` : name;
    const root = rootCall(call);

    // Waits.
    const sleeps = own(FIXED_SLEEPS, spelled) ?? (object ? undefined : own(FIXED_SLEEPS, ctx.resolve(name, (known) => Object.keys(FIXED_SLEEPS).some((key) => known.endsWith(`.${key}`)))?.split('.').slice(-2).join('.')));
    if (sleeps !== undefined) facts.waits.push({ ...entry, kind: 'fixed-sleep', ms: msOf(args, sleeps) });
    else if (object && name === UNIT_SLEEP_METHOD && own(TIME_UNITS, ownerName) !== undefined) facts.waits.push({ ...entry, kind: 'fixed-sleep', ms: msOf(args, TIME_UNITS[ownerName]!) });
    else if (object && own(FIXED_WAIT_METHODS, name) !== undefined) facts.waits.push({ ...entry, kind: 'fixed-sleep', ms: msOf(args, FIXED_WAIT_METHODS[name]!) });
    else if (object && includes(IMPLICIT_WAIT_METHODS, name)) facts.waits.push({ ...entry, kind: 'implicit-wait-config', ms: msOf(args, 1) });
    else if (object && name.startsWith(CONDITION_WAIT_PREFIX)) facts.waits.push({ ...entry, kind: 'condition', ms: null });
    else if (object && includes(WAIT_METHODS, name)) {
      const made = unwrap(object).type === 'object_creation_expression' ? typeName(unwrap(object).childForFieldName('type')?.text) : ownerType;
      if (includes(WAIT_TYPES, made) || includes(AWAIT_ROOTS, callName(root)) || /wait/i.test(ownerName)) facts.waits.push({ ...entry, kind: 'condition', ms: null });
    }

    // Selectors: `By.x(...)`, the Playwright calls, page actions with a selector, and the `$` calls of Selenide.
    const onPage = object !== null && (includes(PAGE_OBJECTS, ownerName) || includes(PAGE_TYPES, ownerType));
    if (ownerName === SELENIUM_BY && own(BY_METHODS, name) !== undefined && first) selector(call, `${SELENIUM_BY}.${name}`, BY_METHODS[name], first);
    else if (object && own(SELECTOR_CALLS, name) !== undefined && first) selector(call, name, SELECTOR_CALLS[name], first);
    else if (own(SELENIDE_SELECTORS, name) !== undefined && first && (!object || ownerName === 'Selenide')) selector(call, name, SELENIDE_SELECTORS[name], first);
    else if (onPage && (own(SELECTOR_ACTIONS, name) ?? Infinity) <= args.length && literalText(first) !== null) selector(call, name, null, first);
    const position = object ? own(POSITIONAL, name) : undefined;
    if (position) picks.push(() => pick(object, position, position === 'nth' ? intValue(first) : null));
    // `findElements(...).get(2)`: a pick by index. Index 0 is what `findElement` gives, and a rule has nothing to say about it.
    else if (name === LIST_PICK_METHOD && includes(LIST_FINDERS, callName(object)) && intValue(first) !== null) picks.push(() => pick(object, 'nth', intValue(first)));

    // Steps and data operations.
    const step = object ? own(STEP_METHODS, name) : undefined;
    const driver = object !== null && (ownerName.toLowerCase().endsWith('driver') || ownerType === DRIVER_TYPE);
    if (step && (isLocator(object!, env) || onPage)) facts.steps.push({ ...entry, kind: step });
    else if (args.length === 1 && Object.hasOwn(DRIVER_NAVIGATION, name) && (DRIVER_NAVIGATION[name] === null ? driver : callName(object) === DRIVER_NAVIGATION[name])) facts.steps.push({ ...entry, kind: 'navigate' });
    const verb = own(HTTP_METHODS, name);
    // REST Assured: `given()...post("/orders")`, or the verb called by itself. Other clients go by their name.
    let beforeThen = true;
    for (let link = object; link?.type === 'method_invocation'; link = link.childForFieldName('object')) beforeThen &&= callName(link) !== RESTASSURED_THEN;
    const fromRest = ctx.restAssured && verb !== undefined && beforeThen && (root.id === call.id ? args.length >= 1 && !object && ctx.resolve(name, (known) => known.startsWith(`${RESTASSURED_PACKAGE}.`))?.startsWith(`${RESTASSURED_PACKAGE}.`) === true
      : includes(REST_STARTERS, callName(root)) && (root.childForFieldName('object') === null || nameOf(root.childForFieldName('object')) === 'RestAssured'));
    const op = own(REST_TEMPLATE_METHODS, object ? name : null) ?? (fromRest || (object && includes(HTTP_CLIENT_NAMES, ownerName)) ? verb : undefined);
    if (op) {
      facts.steps.push({ ...entry, kind: 'request' });
      facts.data.push({ ...entry, op, via: 'http' });
    }
    const sql = object && includes(SQL_METHODS, name) ? own(SQL_VERBS, /^\s*(\w+)/.exec(literalText(first) ?? '')?.[1]?.toLowerCase()) : undefined;
    const stored = object && REPOSITORY_SUFFIXES.some((suffix) => ownerName.toLowerCase().endsWith(suffix.toLowerCase())) ? Object.entries(REPOSITORY_METHODS).find(([prefix]) => name.startsWith(prefix))?.[1] : undefined;
    if (sql ?? stored) facts.data.push({ ...entry, op: (sql ?? stored)!, via: 'db' });

    // Mocks: `mock(Mailer.class)`, `spy(cart)`, and the replies they are given.
    const variable = storedAs(call);
    const plainCall = !object || ownerName === 'Mockito' || ownerName === 'BDDMockito';
    if (includes(MOCK_FACTORIES, name) && plainCall && first) {
      const type = first.type === 'class_literal' ? typeName(first.namedChildren[0]?.text) : first.type === 'object_creation_expression' ? typeName(first.childForFieldName('type')?.text) : typeOf(nameOf(first));
      const made = mock(call, {
        kind: 'class', target: type ?? variable ?? clipText(first.text), targetsSubject: targetsSubject(type),
        passthrough: includes(SPY_NAMES, name) || args.slice(1).some((argument) => argument.text.includes(PASSTHROUGH_ANSWER)), stubbedReturn: false, fulfillsAllNetwork: false,
      });
      if (variable) facts.mockNamed.set(variable, made);
      // Outside a try-with-resources a mock of a static method stays in place until it is closed.
      if (includes(SCOPED_MOCK_FACTORIES, name)) hold(call, 'patch', variable ? [`var:${variable}`] : [], { released: managed(call) });
    }
    /** A reply for one method of a mock. The mock itself no longer keeps its real behavior. */
    const stub = (holder: string | null, method: string | null, node: SyntaxNode): void => {
      if (holder === null || method === null) return;
      const made = facts.mockNamed.get(holder) ?? ctx.fieldMocks.get(holder);
      if (made) Object.assign(made, { stubbedReturn: true, passthrough: false });
      mock(node, { kind: 'function', target: `${holder}.${method}`, targetsSubject: made ? made.targetsSubject : targetsSubject(typeOf(holder)), passthrough: false, stubbedReturn: true, fulfillsAllNetwork: false });
    };
    const next = call.parent?.type === 'method_invocation' && call.parent.childForFieldName('object')?.id === call.id ? call.parent : null;
    if (includes(STUB_CALLS, name) && args.length === 1 && next && !includes(REAL_METHOD_REPLIES, callName(next))) {
      // `when(mailer.send(any())).thenReturn(true)`: the reply follows. `doReturn(true).when(mailer).send(any())`: it comes first.
      if (first!.type === 'method_invocation' && first!.childForFieldName('object') && STUB_REPLY_PREFIXES.some((prefix) => callName(next)!.startsWith(prefix))) stub(rootName(first), callName(first), next);
      else if (includes(STUB_REPLIES_FIRST, callName(root)) && root.id !== call.id) stub(nameOf(first), callName(next), next);
    }
    if (name === WIREMOCK_STUB && first?.type === 'method_invocation') {
      // `stubFor(get(urlEqualTo("/orders")).willReturn(okJson("[]")))`: the URL is inside the first call of the chain.
      const request = rootCall(first);
      const matcher = argumentsOf(request)[0] ? unwrap(argumentsOf(request)[0]!) : null;
      const url = literalText(matcher) ?? (matcher?.type === 'method_invocation' ? literalText(argumentsOf(matcher)[0]) : null);
      const everything = callName(request) === WIREMOCK_ANY_VERB && (callName(matcher) === WIREMOCK_ANY_URL || includes(MATCH_ALL_PATTERNS, url));
      mock(call, { kind: 'network', target: url ?? clipText(matcher?.text ?? first.text), targetsSubject: false, passthrough: false, stubbedReturn: first.text.includes(`.${WIREMOCK_REPLY}(`), fulfillsAllNetwork: everything });
    } else if (object && name === ROUTE_METHOD && args.length >= 2 && (onPage || includes(ROUTE_OWNER_TYPES, ownerType) || ownerName.toLowerCase().endsWith('context'))) {
      const handled = (names: readonly string[]): boolean => args[1]!.descendantsOfType('method_invocation').some((inner) => includes(names, callName(inner)));
      const pattern = literalText(first) ?? clipText(first!.text);
      const fulfills = handled([ROUTE_FULFILL]);
      mock(call, { kind: 'network', target: pattern, targetsSubject: false, passthrough: !fulfills && handled(ROUTE_CONTINUE), stubbedReturn: fulfills, fulfillsAllNetwork: fulfills && includes(MATCH_ALL_PATTERNS, pattern) });
    }

    // Resources and releases.
    const kind = own(RESOURCE_CALLS, spelled) ?? (object ? own(RESOURCE_CALLS, `.${name}`) : undefined) ?? (name === DRIVER_MANAGER.method && ownerRoot === DRIVER_MANAGER.root ? 'driver' as const : undefined);
    const closedByBlock = managed(call);
    if (closedByBlock && variable) blockOwned.add(variable);
    if (kind) {
      const inBlock = blockOwned.has(ownerRoot ?? '');
      if (inBlock && variable) blockOwned.add(variable);
      const tokens = [...(variable ? [`var:${variable}`] : []), ...(ownerRoot && /^[a-z_$]/.test(ownerRoot) ? [`var:${ownerRoot}`, ...(tokensOf.get(ownerRoot) ?? [])] : [])];
      if (variable) tokensOf.set(variable, tokens);
      hold(call, kind, tokens, { released: closedByBlock || inBlock, autoManaged: AUTO_CLOSED_KINDS.includes(kind) && ctx.parameters.has(ownerRoot ?? '') });
    }
    if (object && includes(RELEASE_METHODS, name) && args.length === 0) facts.releases.push(`var:${owner}`);
    // `System.setProperty("key", value)` changes the property for every test after. A second write, a clear, or any write in an after hook puts it back.
    const property = spelled === PROPERTY_SET || spelled === PROPERTY_CLEAR ? literalText(first) : null;
    if (property !== null) {
      const token = `env:${property}`;
      if (ctx.restores || written.has(token) || spelled === PROPERTY_CLEAR) facts.releases.push(token);
      else hold(call, 'env', [token]);
      written.add(token);
    }
  };

  /** A field: `@Mock Mailer mailer;`, `@FindBy(css = ".badge") WebElement badge;`. */
  const onField = (field: SyntaxNode): void => {
    const type = typeName(field.childForFieldName('type')?.text);
    const fieldName = field.namedChildren.find((child) => child.type === 'variable_declarator')?.childForFieldName('name')?.text ?? null;
    for (const mark of annotationsOf(field)) {
      const markName = lastPart(dottedName(mark.childForFieldName('name')) ?? '');
      if (includes(MOCK_FIELD_ANNOTATIONS, markName) && fieldName) {
        facts.mockNamed.set(fieldName, mock(field, { kind: 'class', target: type ?? fieldName, targetsSubject: targetsSubject(type), passthrough: includes(SPY_NAMES, markName), stubbedReturn: false, fulfillsAllNetwork: false }));
      } else if (markName === FIND_BY_ANNOTATION && fieldName) {
        const elements = elementsOf(mark);
        const how = lastPart(elements.get(FIND_BY_HOW_ELEMENT)?.text.trim() ?? '');
        const [key, value] = Object.hasOwn(FIND_BY_HOW, how) ? [how, elements.get(FIND_BY_USING_ELEMENT)] : [...elements].find(([element]) => Object.hasOwn(FIND_BY_ELEMENTS, element)) ?? [null, undefined];
        if (key !== null) facts.fieldSelectors.set(fieldName, selector(mark, `@${FIND_BY_ANNOTATION}(${key})`, { ...FIND_BY_ELEMENTS, ...FIND_BY_HOW }[key], value, false));
      }
    }
  };

  const visit = (node: SyntaxNode): void => {
    if (node.type === 'method_invocation') onCall(node);
    else if (node.type === 'field_declaration') onField(node);
    else if (node.type === 'object_creation_expression') {
      const kind = own(RESOURCE_TYPES, typeName(node.childForFieldName('type')?.text));
      const variable = storedAs(node);
      if (managed(node) && variable) blockOwned.add(variable);
      if (kind) hold(node, kind, variable ? [`var:${variable}`] : [], { released: managed(node) });
    }
    for (const child of node.namedChildren) visit(child);
  };
  for (const node of nodes) visit(node);
  for (const apply of picks) apply();

  // In a chain the outer call is met first. Put every list in the order the calls end, which is the order they run.
  const byEnd = (a: { span: NWait['span'] }, b: typeof a): number => a.span.endLine - b.span.endLine || a.span.endColumn - b.span.endColumn;
  for (const list of [facts.waits, facts.selectors, facts.steps, facts.data, facts.mocks]) list.sort(byEnd);
  return facts;
}
