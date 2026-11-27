// Java: what a test body checks (SPEC.md Sections 8.1 and 9.3). Finds the assertions of
// JUnit, TestNG, AssertJ, Hamcrest, REST Assured, Mockito and Playwright for Java with their
// operands, whether each one is guarded and reachable, and the `try/catch` blocks around them.
import { clipText } from '../../model/build.js';
import type { AssertionKind, FrameworkId, NAssertion, NTryBlock } from '../../model/types.js';
import { spanOfNode } from '../../parse/positions.js';
import type { SyntaxNode } from '../../parse/treesitter.js';
import { intValue, nameOf, toExpr, unwrap, type Env } from './expr.js';
import { dottedName, statementsOf } from './syntax.js';
import {
  ALWAYS_RUN_CALLBACKS, ALWAYS_RUN_METHODS, ASSERTION_CATCHERS, DYNAMIC_TEST_CALL, ASSERTJ_METHODS, ASSERTJ_NAVIGATIONS, ASSERTJ_NON_CHECKS, ASSERTJ_THROW_ROOTS, ASSERT_CLASSES, ASSERT_METHODS, ASSERT_METHOD_PREFIX, ASSERT_THAT_HOMES, ASSERT_THAT_NAMES,
  BDD_SHOULD, BDD_THEN_HOME, BDD_WHOLE_CALLS, EXPECTED_EXCEPTION_METHODS, FAIL_CLASSES, FAIL_METHODS, GROUPING_METHODS, HAMCREST_MATCHERS, HAMCREST_WRAPPERS, LISTING_CALLS, MOCKITO_CLASSES,
  NEGATING_LINKS, NEVER_MODES, RESPONSE_CHECK_METHODS, RESTASSURED_CHECKS, RESTASSURED_THEN, SNAPSHOT_CALLS, SNAPSHOT_METHODS, SOFT_REPORT_METHOD, STATUS_READERS, STEP_VERIFIER,
  STEP_VERIFIER_RUN_PREFIX, THROWN_SKIPS, VERIFY_CALL,
  VERIFY_WHOLE_CALLS, type Check,
} from './vocab.js';

export interface BodyContext {
  env: Env;
  /** The full name behind a name as it is written, from the imports of the file. */
  resolve(written: string | null, known: (name: string) => boolean): string | null;
  runner: FrameworkId;
  /** The file imports REST Assured, so `.then()` starts the checks of a response. */
  restAssured: boolean;
  /** The file imports Mockito, so a bare `verify(...)` is the one of Mockito. */
  mockito: boolean;
  /** A method known to contain an assertion. */
  isHelper(name: string): boolean;
}

export interface BodyFacts {
  assertions: NAssertion[];
  expectsException: boolean;
  tryBlocks: NTryBlock[];
}

/** One call of a chain: `assertThat(x)`, `.isEqualTo(y)`. */
interface Link { name: string; node: SyntaxNode; args: SyntaxNode[] }
/** A chain of calls from the first to the last, and what the first one is called on: `softly` in `softly.assertThat(x).isTrue()`. */
interface Chain { receiver: SyntaxNode | null; links: Link[] }
interface HandlerFacts { rethrows: boolean; fails: boolean; asserts: boolean }
/** `cond`: under an if or a switch. `other`: under a loop, `? :`, `&&`, a catch or a callback that may not run. `callback`: inside a lambda or an anonymous class. */
interface State { cond: boolean; other: boolean; callback: boolean; handler: HandlerFacts | null }

const includes = (list: readonly string[], value: string | null | undefined): boolean => value != null && list.includes(value);
const lastPart = (name: string): string => name.slice(name.lastIndexOf('.') + 1);
const homeOf = (name: string): string => name.slice(0, Math.max(0, name.lastIndexOf('.')));
const sameNode = (a: SyntaxNode | null | undefined, b: SyntaxNode): boolean => a?.id === b.id;
const TERMINATORS = new Set(['return_statement', 'throw_statement', 'break_statement', 'continue_statement']);
const LOOPS = new Set(['for_statement', 'while_statement', 'enhanced_for_statement']);
const TWO_OPERANDS = new Set<AssertionKind>(['equality', 'comparison', 'contains', 'type', 'count', 'status']);
const COMPARISONS: Readonly<Record<string, { operator: NonNullable<NAssertion['operator']>; flipped: NonNullable<NAssertion['operator']> }>> = {
  '>': { operator: '>', flipped: '<' }, '>=': { operator: '>=', flipped: '<=' }, '<': { operator: '<', flipped: '>' }, '<=': { operator: '<=', flipped: '>=' },
};
const TEXT_TYPES = new Set(['string_literal', 'binary_expression']);

function chainOf(top: SyntaxNode): Chain {
  const links: Link[] = [];
  let node: SyntaxNode | null = top;
  while (node?.type === 'method_invocation') {
    links.unshift({ name: node.childForFieldName('name')?.text ?? '', node, args: statementsOf(node.childForFieldName('arguments')) });
    node = node.childForFieldName('object');
  }
  return { receiver: node, links };
}
/** True when no call continues the chain above this node. */
const isTop = (node: SyntaxNode): boolean => !(node.parent?.type === 'method_invocation' && sameNode(node.parent.childForFieldName('object'), node));
const isLiteralNumber = (node: SyntaxNode | undefined): boolean => node !== undefined && /_literal$/.test(unwrap(node).type) && !['string_literal', 'null_literal', 'character_literal'].includes(unwrap(node).type);

/** Reads the body of a test, a hook or a helper method. */
export function readBody(body: SyntaxNode, ctx: BodyContext): BodyFacts {
  const facts: BodyFacts = { assertions: [], expectsException: false, tryBlocks: [] };
  const { env } = ctx;
  let reported: Set<string> | null = null;
  /** A soft assertion object that this body makes has to be reported by it: `softly.assertAll()`. One from outside is reported there. */
  const softComplete = (name: string): boolean => {
    if (!env.soft.get(name)?.own) return true;
    reported ??= new Set(body.descendantsOfType('method_invocation').filter((call) => call?.childForFieldName('name')?.text === SOFT_REPORT_METHOD).map((call) => nameOf(call!.childForFieldName('object')) ?? ''));
    return reported.has(name);
  };
  const isFail = (call: SyntaxNode): boolean => call.type === 'method_invocation' && includes(FAIL_METHODS, call.childForFieldName('name')?.text) && call.childForFieldName('object')?.type !== 'method_invocation';

  /** False when an unconditional return, throw, break or fail call comes before the node in one of its blocks. */
  const isReachable = (node: SyntaxNode): boolean => {
    for (let current = node; current.id !== body.id && current.parent; current = current.parent) {
      if (current.parent.type !== 'block') continue;
      for (const sibling of statementsOf(current.parent)) {
        if (sibling.id === current.id) break;
        if (TERMINATORS.has(sibling.type)) return false;
        if (sibling.type === 'expression_statement' && sibling.namedChildren[0] && isFail(sibling.namedChildren[0])) return false;
      }
    }
    return true;
  };

  const make = (node: SyntaxNode, state: State, fields: Pick<NAssertion, 'kind' | 'library'> & Partial<NAssertion>): NAssertion => {
    const { kind, library, ...rest } = fields;
    if (state.handler) state.handler[kind === 'fail-call' ? 'fails' : 'asserts'] = true;
    return {
      span: spanOfNode(node), text: clipText(node.text), kind, library,
      actual: null, expected: null, matcher: null, negated: false, soft: false, complete: true, awaited: 'not-needed',
      // `if (!ok) fail()` is a check in itself: the condition is the assertion.
      guarded: kind === 'fail-call' ? state.other : state.cond || state.other,
      reachable: isReachable(node), viaHelper: null, ...rest,
    };
  };
  const operand = (node: SyntaxNode | null | undefined): NAssertion['actual'] => (node ? toExpr(node, env) : null);
  /** The status code that a check names, when the other side reads the status of a response: `assertEquals(200, response.statusCode())`. */
  const statusOf = (a: SyntaxNode | null | undefined, b: SyntaxNode | null | undefined): number[] => {
    for (const [read, code] of [[a, b], [b, a]]) {
      const call = read ? unwrap(read) : null;
      const value = intValue(code ? unwrap(code) : null);
      if (call?.type === 'method_invocation' && includes(STATUS_READERS, call.childForFieldName('name')?.text) && value !== null) return [value];
    }
    return [];
  };
  /** A check with its two sides: the kind, and a status check when one side reads a status. */
  const fromCheck = (node: SyntaxNode, state: State, library: string, matcher: string, check: Check, actual: SyntaxNode | undefined, expected: SyntaxNode | undefined, more: Partial<NAssertion> = {}): NAssertion => {
    const codes = TWO_OPERANDS.has(check.kind) ? statusOf(actual, expected) : [];
    const kind = codes.length > 0 ? 'status' : check.kind;
    if (kind === 'throws' && !check.negated && more.complete !== false) facts.expectsException = true;
    return make(node, state, {
      kind, library, matcher, negated: check.negated === true, actual: kind === 'throws' ? null : operand(actual),
      expected: kind === 'throws' || TWO_OPERANDS.has(kind) ? operand(expected) : null,
      ...(check.operator ? { operator: check.operator } : {}), ...(kind === 'status' ? { statusCodes: codes } : {}), ...more,
    });
  };
  /** A condition that must hold: `assertTrue(rows.size() >= 0)` is read as the comparison it holds. */
  const fromCondition = (node: SyntaxNode, state: State, start: SyntaxNode, negatedAtStart: boolean, library: string, matcher: string, more: Partial<NAssertion>): NAssertion => {
    let negated = negatedAtStart;
    let condition = unwrap(start);
    while (condition.type === 'unary_expression' && condition.children[0]?.type === '!' && condition.namedChildren[0]) {
      negated = !negated;
      condition = unwrap(condition.namedChildren[0]);
    }
    if (condition.type === 'binary_expression') {
      const [left, right, sign] = [condition.childForFieldName('left')!, condition.childForFieldName('right')!, condition.childForFieldName('operator')?.type ?? ''];
      // The value under test is the side that is not a literal: `0 <= n` is `n >= 0`.
      const turned = /_literal$|^true$|^false$/.test(unwrap(left).type) && !/_literal$|^true$|^false$/.test(unwrap(right).type);
      const [actual, expected] = turned ? [right, left] : [left, right];
      if (sign === '==' || sign === '!=') {
        const nullness = unwrap(expected).type === 'null_literal';
        return fromCheck(node, state, library, matcher, { kind: nullness ? 'nullness' : 'equality', ...(negated !== (sign === '!=') ? { negated: true } : {}) }, actual, nullness ? undefined : expected, more);
      }
      const comparison = COMPARISONS[sign];
      if (comparison) return fromCheck(node, state, library, matcher, { kind: 'comparison', operator: turned ? comparison.flipped : comparison.operator, ...(negated ? { negated: true } : {}) }, actual, expected, more);
    }
    if (condition.type === 'instanceof_expression') return fromCheck(node, state, library, matcher, { kind: 'type', ...(negated ? { negated: true } : {}) }, condition.childForFieldName('left') ?? undefined, condition.childForFieldName('right') ?? undefined, more);
    if (condition.type === 'method_invocation' && condition.childForFieldName('name')?.text === 'equals' && condition.childForFieldName('object')) {
      return fromCheck(node, state, library, matcher, { kind: 'equality', ...(negated ? { negated: true } : {}) }, condition.childForFieldName('object')!, statementsOf(condition.childForFieldName('arguments'))[0], more);
    }
    return make(node, state, { kind: 'truthiness', library, matcher, negated, actual: operand(condition), ...more });
  };
  /** A Hamcrest matcher: `is(not(equalTo(3)))`. A plain value inside `is(...)` is compared for equality. */
  const fromMatcher = (matcher: SyntaxNode | undefined): { check: Check; expected: SyntaxNode | undefined } => {
    let negated = false;
    let current = matcher ? unwrap(matcher) : undefined;
    for (;;) {
      const name = current?.type === 'method_invocation' ? current.childForFieldName('name')?.text ?? '' : '';
      const given = current?.type === 'method_invocation' ? statementsOf(current.childForFieldName('arguments')) : [];
      const wrapper = HAMCREST_WRAPPERS[name];
      if (current && wrapper && Object.hasOwn(HAMCREST_WRAPPERS, name) && given.length > 0) {
        if (wrapper.negated) negated = !negated;
        current = unwrap(given.at(-1)!);
        continue;
      }
      const known = Object.hasOwn(HAMCREST_MATCHERS, name) ? HAMCREST_MATCHERS[name]! : null;
      // A value with no matcher around it, inside `is(...)` or `not(...)`: an equality check.
      const check: Check = known ?? (current && current.id !== (matcher && unwrap(matcher).id) && current.type !== 'method_invocation' ? { kind: 'equality' } : { kind: 'other' });
      const flipped = negated !== (check.negated === true);
      return { check: { kind: check.kind, ...(check.operator ? { operator: check.operator } : {}), ...(flipped ? { negated: true } : {}) }, expected: known ? given[0] : check.kind === 'equality' ? current : undefined };
    }
  };
  /** For a check that is one call of a longer chain: its span is that call, from its name to the end of its arguments. */
  const fromLink = (assertion: NAssertion, link: Link): NAssertion => {
    const start = spanOfNode(link.node.childForFieldName('name')!);
    return { ...assertion, span: { ...spanOfNode(link.node), startLine: start.startLine, startColumn: start.startColumn } };
  };

  const classify = (top: SyntaxNode, chain: Chain, state: State): NAssertion[] | null => {
    const first = chain.links[0]!;
    const receiver = chain.receiver ? nameOf(chain.receiver) : null;
    const plain = chain.receiver === null || receiver !== null; // the chain starts at a name or at nothing, not at `new X()` or `this`
    const softName = receiver !== null && env.soft.has(receiver) ? receiver : null;
    const soft = softName !== null ? { soft: true, complete: softComplete(softName) } : {};
    // Called on a variable: `softly.assertThat(x)`, `mockMvc.perform(...)`. The imports say nothing about such a call.
    const onVariable = receiver !== null && /^[a-z_$][\w$]*$/.test(receiver);
    const written = receiver !== null && softName === null ? `${receiver}.${first.name}` : first.name;
    const resolved = (known: (name: string) => boolean, name = written): string | null => (onVariable ? null : ctx.resolve(name, known));

    // JUnit and TestNG: `assertEquals(...)`, `Assert.assertTrue(...)`, `fail(...)`, and the same on a TestNG SoftAssert.
    const method = Object.hasOwn(ASSERT_METHODS, first.name) ? ASSERT_METHODS[first.name]! : null;
    if (plain && (method || includes(GROUPING_METHODS, first.name) || includes(FAIL_METHODS, first.name))) {
      const qualified = softName !== null ? 'org.testng.Assert.x' : resolved((name) => homeOf(name) in ASSERT_CLASSES || FAIL_CLASSES.includes(homeOf(name)));
      // Not imported at all, or named by a class that is not imported (`Assert.assertTrue(ok)` in a piece of a file): the assertions of the
      // runner of the file. Imported from somewhere else, or called on some other object: not ours.
      const candidates = Object.keys(ASSERT_CLASSES).filter((name) => receiver === null || lastPart(name) === receiver);
      const home = qualified !== null ? homeOf(qualified) : candidates.find((name) => ASSERT_CLASSES[name]!.runner === ctx.runner) ?? candidates[0] ?? null;
      const info = home !== null && Object.hasOwn(ASSERT_CLASSES, home) ? ASSERT_CLASSES[home]! : null;
      if (home !== null && (info || FAIL_CLASSES.includes(home))) {
        const library = info?.library ?? 'assertj';
        if (includes(FAIL_METHODS, first.name)) return [make(top, state, { kind: 'fail-call', library, matcher: first.name, ...soft })];
        if (!method || !info) return []; // `assertAll(...)`: the checks are the lambdas inside it
        let args = first.args;
        // JUnit 4 takes the message first: `assertTrue("why", ok)`, `assertEquals("why", expected, actual)`.
        if (info.messageFirst && args.length > method.operands && (method.operands === 1 || args.length > 3 || TEXT_TYPES.has(unwrap(args[0]!).type))) args = args.slice(1);
        const [a, b] = args;
        if (method.kind === 'truthiness' && a) return [fromCondition(top, state, a, method.negated === true, library, first.name, soft)];
        if (method.kind === 'throws') return [fromCheck(top, state, library, first.name, method, undefined, method.operands === 2 && args.length >= 2 ? a : undefined, soft)];
        // `assertTimeout(limit, () -> ...)` checks how long the code takes: there is no value on either side.
        if (method.kind === 'other') return [make(top, state, { kind: 'other', library, matcher: first.name, ...soft })];
        const [actual, expected] = method.operands === 1 ? [a, undefined] : info.expectedFirst ? [b, a] : [a, b];
        return [fromCheck(top, state, library, first.name, method, actual, expected, soft)];
      }
    }

    // Mockito: `verify(mock).send(...)`, `verifyNoInteractions(mock)`, `then(mock).should().send(...)`.
    const mockitoName = (name: string): boolean => {
      const qualified = resolved((candidate) => MOCKITO_CLASSES.includes(homeOf(candidate)), receiver !== null ? `${receiver}.${name}` : name);
      // Not imported at all: the one of Mockito when the file uses Mockito, or when it is called on something known to be a mock.
      return qualified !== null ? MOCKITO_CLASSES.includes(homeOf(qualified)) : ctx.mockito || (first.args[0] !== undefined && toExpr(first.args[0], env).isMock);
    };
    const never = (mode: SyntaxNode | undefined): boolean => mode?.type === 'method_invocation' && includes(NEVER_MODES, mode.childForFieldName('name')?.text);
    const mockCall = (matcher: string, mock: SyntaxNode | undefined, complete: boolean, negated: boolean): NAssertion[] =>
      [make(top, state, { kind: 'mock-call', library: 'mockito', matcher, negated, complete, actual: mock ? { ...toExpr(mock, env), isMock: true } : null })];
    if (plain && !onVariable && first.name === VERIFY_CALL && first.args.length >= 1 && first.args.length <= 2 && mockitoName(first.name)) {
      // `verify(mock)` alone names no call, so it checks nothing.
      return mockCall(VERIFY_CALL, first.args[0], chain.links.length >= 2, never(first.args[1]));
    }
    // `fixed.verify(() -> Prices.of("apple"))` on the mock of a static method.
    if (first.name === VERIFY_CALL && receiver !== null && env.mocks.has(receiver)) return mockCall(VERIFY_CALL, chain.receiver!, first.args.length >= 1, never(first.args[1]));
    // `inOrder.verify(mailer).send(...)`: the checks of Mockito in a fixed order.
    if (first.name === VERIFY_CALL && onVariable && first.args[0] !== undefined && toExpr(first.args[0], env).isMock) return mockCall(VERIFY_CALL, first.args[0], chain.links.length >= 2, never(first.args[1]));
    if (plain && includes(VERIFY_WHOLE_CALLS, first.name) && mockitoName(first.name)) return mockCall(first.name, first.args[0], true, false);
    const second = chain.links[1];
    if (plain && first.name === 'then' && second && (second.name === BDD_SHOULD || includes(BDD_WHOLE_CALLS, second.name))) {
      const qualified = resolved((name) => homeOf(name) === BDD_THEN_HOME);
      if (qualified !== null ? homeOf(qualified) === BDD_THEN_HOME : ctx.mockito) return mockCall(second.name, first.args[0], second.name !== BDD_SHOULD || chain.links.length >= 3, never(second.args[0]));
    }

    // Fluent checks: AssertJ, Truth and Playwright `assertThat(x).isEqualTo(y)`, Hamcrest `assertThat(x, is(y))`, and AssertJ on code that throws.
    const throwRoot = Object.hasOwn(ASSERTJ_THROW_ROOTS, first.name) ? ASSERTJ_THROW_ROOTS[first.name]! : null;
    if (plain && (throwRoot || includes(ASSERT_THAT_NAMES, first.name))) {
      const qualified = softName !== null ? null : resolved((name) => homeOf(name) in ASSERT_THAT_HOMES);
      const known = qualified !== null && Object.hasOwn(ASSERT_THAT_HOMES, homeOf(qualified)) ? ASSERT_THAT_HOMES[homeOf(qualified)]! : null;
      // `softly.assertThat(x)` on an object that is not declared here (the parameter of `assertSoftly(softly -> ...)`) is a soft check too.
      const softly = softName !== null ? soft : onVariable ? { soft: true } : {};
      if ((qualified === null || known !== null) && (first.name !== 'then' || known === 'assertj' || softName !== null)) {
        const rest = chain.links.slice(1);
        if (throwRoot) {
          const others = rest.filter((link) => !includes(ASSERTJ_NON_CHECKS, link.name));
          const needed = throwRoot.needs === undefined || rest.some((link) => link.name === throwRoot.needs);
          // `assertThatCode(...).isInstanceOf(X.class)` expects a throw. With `doesNotThrowAnyException()` it expects none.
          const negated = throwRoot.negated === true && needed;
          return [fromCheck(top, state, 'assertj', first.name, { kind: 'throws', ...(negated ? { negated: true } : {}) }, undefined, first.args.find((arg) => arg.type === 'class_literal'), { complete: needed || others.length > 0, ...softly })];
        }
        // The shape of the call tells Hamcrest from the others, also in a file that imports both: `assertThat(x, is(y))` and `assertThat(x).isEqualTo(y)`.
        const library = first.args.length >= 2 ? 'hamcrest' : known === undefined || known === null || known === 'hamcrest' ? 'assertj' : known;
        if (library === 'hamcrest') {
          const [value, matcher] = first.args.slice(-2);
          const read = fromMatcher(matcher);
          return [fromCheck(top, state, library, first.name, read.check, value, read.expected)];
        }
        const found: NAssertion[] = [];
        let negate = false;
        let value: SyntaxNode | undefined = first.args[0];
        for (const link of rest) {
          if (includes(NEGATING_LINKS, link.name) && link.args.length === 0) negate = !negate;
          // After `.extracting("owner")` the value under test is another one, which is not written here.
          if (includes(ASSERTJ_NAVIGATIONS, link.name)) value = undefined;
          if (includes(ASSERTJ_NON_CHECKS, link.name) || includes(ASSERTJ_NAVIGATIONS, link.name) || includes(NEGATING_LINKS, link.name)) continue;
          const entry: Check = Object.hasOwn(ASSERTJ_METHODS, link.name) ? ASSERTJ_METHODS[link.name]! : { kind: 'other' };
          const flipped = negate !== (entry.negated === true);
          const { negated: _dropped, ...base } = entry;
          found.push(fromLink(fromCheck(top, state, library, link.name, { ...base, ...(flipped ? { negated: true } : {}) }, value, link.args[0], softly), link));
          negate = false;
        }
        // `assertThat(x);` with nothing after it checks nothing.
        return found.length > 0 ? found : [make(top, state, { kind: 'other', library, matcher: first.name, actual: operand(first.args[0]), ...softly, complete: false })];
      }
    }

    // REST Assured: the checks after `.then()`.
    const then = ctx.restAssured ? chain.links.findIndex((link) => link.name === RESTASSURED_THEN && link.args.length === 0) : -1;
    const responseChecks = then < 0 ? [] : chain.links.slice(then + 1).filter((link) => Object.hasOwn(RESTASSURED_CHECKS, link.name) && link.args.length > 0);
    if (responseChecks.length > 0) {
      return responseChecks.map((link) => {
        const matcher = link.args.at(-1)!;
        // A Hamcrest matcher as the last argument says what is checked: `body("items", hasSize(3))`. A plain value is compared for equality.
        const read = unwrap(matcher).type === 'method_invocation' ? fromMatcher(matcher) : null;
        const matched = read !== null && read.check.kind !== 'other' ? read : null;
        const codes = unwrap(matcher).descendantsOfType('decimal_integer_literal').map((code) => intValue(code)).filter((code): code is number => code !== null);
        const kind = RESTASSURED_CHECKS[link.name] === 'status' ? 'status' : matched?.check.kind ?? RESTASSURED_CHECKS[link.name]!;
        return fromLink(make(top, state, {
          kind, library: 'restassured', matcher: link.name, negated: matched?.check.negated === true, expected: TWO_OPERANDS.has(kind) ? operand(matched ? matched.expected : read ? undefined : matcher) : null,
          ...(matched?.check.operator ? { operator: matched.check.operator } : {}), ...(kind === 'status' && codes.length > 0 ? { statusCodes: codes } : {}),
        }), link);
      });
    }
    // Spring: `.andExpect(status().isOk())`, `.expectStatus().isOk()`.
    const responseLinks = chain.links.filter((link) => includes(RESPONSE_CHECK_METHODS, link.name));
    if (responseLinks.length > 0) {
      return responseLinks.map((link, index) => {
        // The check ends where the next one starts: `.expectStatus().isEqualTo(404)`, `.andExpect(status().is(404))`.
        const until = responseLinks[index + 1]?.node.id;
        const own = chain.links.slice(chain.links.indexOf(link)).filter((later, at, all) => all.slice(0, at + 1).every((earlier) => earlier === link || earlier.node.id !== until));
        const isStatus = /status/i.test(`${link.name} ${link.args[0]?.text.slice(0, 8) ?? ''}`);
        const codes = isStatus ? own.flatMap((later) => later.args).flatMap((arg) => arg.descendantsOfType('decimal_integer_literal')).map((code) => intValue(code)).filter((code): code is number => code !== null) : [];
        return fromLink(make(top, state, { kind: isStatus ? 'status' : 'other', library: 'spring', matcher: link.name, ...(codes.length > 0 ? { statusCodes: codes } : {}) }), link);
      });
    }
    // Reactor: the expectations of a StepVerifier are checked only when a `verify...` call runs it.
    if (receiver !== null && lastPart(receiver) === STEP_VERIFIER) {
      return [make(top, state, { kind: 'other', library: 'reactor', matcher: chain.links.at(-1)!.name, complete: chain.links.some((link) => link.name.startsWith(STEP_VERIFIER_RUN_PREFIX)) })];
    }
    // Snapshots: `Approvals.verify(text)`, `expect.toMatchSnapshot(value)`.
    if (includes(SNAPSHOT_CALLS, `${lastPart(receiver ?? '')}.${first.name}`) || chain.links.some((link) => includes(SNAPSHOT_METHODS, link.name))) {
      return [make(top, state, { kind: 'snapshot', library: 'snapshot', matcher: chain.links.find((link) => includes(SNAPSHOT_METHODS, link.name))?.name ?? first.name, actual: operand(chain.links.at(-1)!.args[0]) })];
    }
    // The JUnit 4 rule: `thrown.expect(IllegalStateException.class)`.
    if (receiver !== null && env.expectedExceptions.has(receiver) && includes(EXPECTED_EXCEPTION_METHODS, first.name)) {
      return [fromCheck(top, state, 'junit', first.name, { kind: 'throws' }, undefined, first.args[0])];
    }
    // A method that holds an assertion, called here or handed over to be called later: `forEachItem(this::checkPrice)`.
    const helper = chain.links.find((link) => ctx.isHelper(link.name));
    if (helper) return [make(top, state, { kind: 'other', library: 'helper', viaHelper: helper.name })];
    const handed = chain.links.flatMap((link) => link.args).map((arg) => (arg.type === 'method_reference' ? arg.namedChildren.at(-1)?.text : undefined)).find((name) => name !== undefined && ctx.isHelper(name));
    if (handed) return [{ ...make(top, state, { kind: 'other', library: 'helper', viaHelper: handed }), guarded: true }];
    if (chain.links.some((link) => includes(GROUPING_METHODS, link.name))) return [];
    // A method named assertSomething is an assertion by its name.
    const named = chain.links.find((link) => new RegExp(`^${ASSERT_METHOD_PREFIX}[A-Z]`).test(link.name));
    return named ? [make(top, state, { kind: 'other', library: 'assert-method', matcher: named.name, actual: operand(named.args[0]), expected: operand(named.args[1]) })] : null;
  };

  const catchesAssertions = (types: readonly string[]): boolean => types.some((type) => includes(ASSERTION_CATCHERS, lastPart(type)));
  /** A lambda or an anonymous class given to a call that always runs it: `assertAll(() -> ...)`. */
  const alwaysRuns = (node: SyntaxNode): boolean => {
    const call = node.parent?.type === 'argument_list' ? node.parent.parent : null;
    return call?.type === 'method_invocation' && includes(call.childForFieldName('object') ? [...ALWAYS_RUN_CALLBACKS, ...ALWAYS_RUN_METHODS] : ALWAYS_RUN_CALLBACKS, call.childForFieldName('name')?.text);
  };
  /** `for (String user : List.of("a", "b"))` always runs its body. Any other loop may run zero times. */
  const loopsOverListing = (loop: SyntaxNode): boolean => {
    const over = loop.type === 'enhanced_for_statement' ? loop.childForFieldName('value') : null;
    if (over?.type === 'array_creation_expression') return statementsOf(over.childForFieldName('value')).length > 0;
    return over?.type === 'method_invocation' && includes(LISTING_CALLS, `${dottedName(over.childForFieldName('object'))}.${over.childForFieldName('name')?.text}`) && statementsOf(over.childForFieldName('arguments')).length > 0;
  };

  const walk = (node: SyntaxNode, state: State): void => {
    if (node.type === 'line_comment' || node.type === 'block_comment' || node.type === 'class_declaration') return; // a class declared in the body is not its flow
    const field = (name: string): SyntaxNode | null => node.childForFieldName(name);
    const each = (change: (child: SyntaxNode) => Partial<State>): void => {
      for (const child of node.namedChildren) walk(child, { ...state, ...change(child) });
    };
    if (node.type === 'if_statement') return each((child) => (sameNode(field('condition'), child) ? {} : { cond: true }));
    if (node.type === 'switch_expression' || node.type === 'switch_statement') return each((child) => (sameNode(field('condition'), child) ? {} : { cond: true }));
    if (node.type === 'ternary_expression') return each((child) => (sameNode(field('condition'), child) ? {} : { other: true }));
    if (node.type === 'binary_expression' && ['&&', '||'].includes(field('operator')?.type ?? '')) return each((child) => (sameNode(field('right'), child) ? { other: true } : {}));
    if (LOOPS.has(node.type)) return each((child) => (sameNode(field('body'), child) && !loopsOverListing(node) ? { other: true } : {}));
    if (node.type === 'lambda_expression' || node.type === 'class_body') {
      const given = node.type === 'class_body' ? node.parent! : node;
      const call = given.parent?.type === 'argument_list' ? given.parent.parent : null;
      if (call?.childForFieldName('name')?.text === DYNAMIC_TEST_CALL) return each(() => ({ cond: false, other: false, callback: true }));
      return each(() => (alwaysRuns(given) ? { callback: true } : { other: true, callback: true }));
    }

    if (node.type === 'try_statement' || node.type === 'try_with_resources_statement') {
      const clauses = node.namedChildren.filter((child) => child.type === 'catch_clause');
      for (const child of node.namedChildren.filter((candidate) => candidate.type === 'resource_specification')) walk(child, state);
      if (clauses.length === 0) walk(field('body')!, state);
      else {
        const types = clauses.map((clause) => (clause.descendantsOfType('catch_type')[0]?.namedChildren ?? []).map((type) => dottedName(type) ?? clipText(type.text)));
        // Java runs the first clause that matches, so that clause decides what happens to a failed assertion.
        const catching = types.findIndex((named) => catchesAssertions(named));
        const handler: HandlerFacts = { rethrows: false, fails: false, asserts: false };
        const facade: HandlerFacts = { rethrows: false, fails: false, asserts: false };
        const before = facts.assertions.length;
        walk(field('body')!, state);
        const inside = facts.assertions.slice(before).filter((assertion) => !assertion.soft).length;
        clauses.forEach((clause, index) => walk(clause.childForFieldName('body')!, { ...state, other: true, handler: catching < 0 || index === catching ? handler : facade }));
        facts.tryBlocks.push({
          span: spanOfNode(node), kind: 'try-catch', assertionsInside: inside, catches: [...new Set(types.flat())], catchesAssertionFailures: catching >= 0,
          handlerRethrows: handler.rethrows, handlerFails: handler.fails, handlerAsserts: handler.asserts,
        });
      }
      for (const child of node.namedChildren.filter((candidate) => candidate.type === 'finally_clause')) walk(child, state);
      return;
    }
    if (node.type === 'throw_statement') {
      const thrown = node.namedChildren.find((child) => child.type !== 'line_comment' && child.type !== 'block_comment');
      const type = thrown?.type === 'object_creation_expression' ? ctx.resolve(dottedName(thrown.childForFieldName('type')), (name) => THROWN_SKIPS.includes(name)) : null;
      if (state.handler) state.handler.rethrows = true;
      // A throw in the test's own flow fails the test. A thrown skip does not.
      else if (!state.callback && !includes(THROWN_SKIPS, type)) facts.assertions.push(make(node, state, { kind: 'fail-call', library: 'throw', matcher: 'throw', expected: operand(thrown) }));
      return;
    }
    // The `assert` statement of the language. Maven and Gradle run tests with assertions switched on.
    if (node.type === 'assert_statement') {
      const condition = node.namedChildren.find((child) => child.type !== 'line_comment' && child.type !== 'block_comment');
      if (condition) facts.assertions.push(fromCondition(node, state, condition, false, 'java', 'assert', {}));
      return;
    }
    if (node.type === 'method_invocation' && isTop(node)) {
      const chain = chainOf(node);
      const found = classify(node, chain, state);
      if (found) {
        facts.assertions.push(...found);
        // What is inside the arguments is read too: the lambdas of `assertAll`, a check inside `satisfies(...)`.
        for (const link of chain.links) for (const arg of link.args) walk(arg, state);
        return;
      }
    }
    for (const child of node.namedChildren) walk(child, state);
  };

  walk(body, { cond: false, other: false, callback: false, handler: null });
  return facts;
}
