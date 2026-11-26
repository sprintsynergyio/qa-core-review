// Python: what a test body checks (SPEC.md Sections 8.1 and 9.2). Finds the assertions with
// their operands, whether each one is awaited, guarded and reachable, and the `try/except`
// blocks around them.
import { clipText } from '../../model/build.js';
import type { AssertionKind, NAssertion, NTryBlock } from '../../model/types.js';
import { spanOfNode } from '../../parse/positions.js';
import type { SyntaxNode } from '../../parse/treesitter.js';
import { calleeName, isMock, numberValue, toExpr, unwrap, type Env } from './expr.js';
import { argumentsOf, dottedName, qualify, statementsOf } from './syntax.js';
import {
  ASSERTION_CATCHERS, ASSERTPY_CHECK_NAME, ASSERTPY_METHODS, ASSERTPY_MODULE, ASSERT_FUNCTION_PREFIX, ASSERT_LIBRARY, ASSERT_THAT, CHECK_METHODS, CHECK_ROOTS, COMPARISON_OPERATORS, EXCEPTION_CALLS,
  EXPECT_ROOT, FAIL_CALLS, HAMCREST_MATCHERS, HAMCREST_MODULE, HAMCREST_WRAPPERS, MOCK_ASSERTS, MOCK_STATE_ATTRIBUTES, NEGATED_MATCHER_PREFIX, NEGATED_MOCK_ASSERTS,
  PLAYWRIGHT_ASYNC_MODULE, PLAYWRIGHT_MATCHERS, PLAYWRIGHT_SYNC_MODULE, PSEUDO_MOCK_ASSERTS, RAISED_SKIPS, SNAPSHOT_CALLS, SNAPSHOT_FIXTURES, STATUS_ATTRIBUTES,
  STATUS_CHECK_METHODS, SUPPRESS_CALLS, TYPE_CHECK_FUNCTIONS, UNITTEST_ASSERTS, UNITTEST_ASSERT_PREFIX, UNITTEST_ROOT, type Check,
} from './vocab.js';

export interface BodyContext {
  env: Env;
  /** The file uses Playwright, so a bare `expect(...)` is Playwright's. */
  playwright: boolean;
  /** 'async': `expect` has to be awaited. 'sync': it does not. Null: it depends on whether the function is `async def`. */
  playwrightApi: 'async' | 'sync' | null;
  /** The file imports assertpy, so a bare `assert_that(x)` is assertpy's and not PyHamcrest's. */
  assertpy: boolean;
  /** A function or method known to contain an assertion. */
  isHelper(name: string): boolean;
}

export interface BodyFacts {
  assertions: NAssertion[];
  expectsException: boolean;
  tryBlocks: NTryBlock[];
}

export interface BodyOptions {
  /** The body of an `async def`. */
  async?: boolean;
  /** Statements that are not part of this body: the teardown of a fixture, when its setup is read. */
  skip?: ReadonlySet<number>;
  /** Read only these statements of the body: the teardown of a fixture. */
  statements?: readonly SyntaxNode[];
}

/** One link of a chain: `expect`, `(page)`, `.to_be_visible()`. `call` is set when the link is called. */
interface Step { name: string; node: SyntaxNode; call: SyntaxNode | null }
interface HandlerFacts { rethrows: boolean; fails: boolean; asserts: boolean }
/** `cond`: under an if or match. `other`: under a loop, a conditional expression, `and`/`or`, an except or a lambda. `soft`: under `with check:`. */
interface State { cond: boolean; other: boolean; callback: boolean; soft: boolean; handler: HandlerFacts | null }

const includes = (list: readonly string[], value: string | null | undefined): boolean => value != null && list.includes(value);
const LOCAL_DECLARATIONS = new Set(['function_definition', 'class_definition', 'decorated_definition']);
const LOOPS = new Set(['for_statement', 'while_statement']);
const COMPREHENSIONS = new Set(['list_comprehension', 'set_comprehension', 'dictionary_comprehension', 'generator_expression']);
const TERMINATORS = new Set(['return_statement', 'raise_statement', 'break_statement', 'continue_statement']);
const EXCEPT_CLAUSES = new Set(['except_clause', 'except_group_clause']);
const TWO_OPERANDS = new Set<AssertionKind>(['equality', 'comparison', 'contains', 'type', 'count', 'status', 'mock-call']);
const sameNode = (a: SyntaxNode | null | undefined, b: SyntaxNode): boolean => a?.id === b.id;

/** A chain as its links from the root outward, or null when it is not a plain chain. */
function chainOf(top: SyntaxNode): Step[] | null {
  const steps: Step[] = [];
  let node = top;
  let call: SyntaxNode | null = null;
  for (;;) {
    if (node.type === 'call' && !call) {
      call = node;
      const callee = node.childForFieldName('function');
      if (!callee) return null;
      node = callee;
    } else if (node.type === 'attribute') {
      steps.unshift({ name: node.childForFieldName('attribute')?.text ?? '', node, call });
      call = null;
      node = node.childForFieldName('object')!;
    } else break;
  }
  if (node.type !== 'identifier' && call) return null; // a call of a call
  steps.unshift({ name: node.type === 'identifier' ? node.text : '', node, call });
  return steps;
}

/** True when nothing continues the chain above this node. */
function isTop(node: SyntaxNode): boolean {
  const parent = node.parent;
  if (parent?.type === 'call') return !sameNode(parent.childForFieldName('function'), node);
  return parent?.type !== 'attribute' || !sameNode(parent.childForFieldName('object'), node);
}

/** What happens to the value of a call: is it awaited, is it a whole statement, is it what a `with` block is opened on? */
function usage(top: SyntaxNode): { awaited: boolean; statement: boolean; managed: boolean } {
  let node = top;
  let awaited = false;
  for (;;) {
    const parent = node.parent;
    if (parent?.type === 'await') awaited = true;
    if (parent?.type === 'await' || parent?.type === 'parenthesized_expression') node = parent;
    else if (parent?.type === 'argument_list' && /^asyncio\.(gather|wait_for)$/.test(parent.parent?.childForFieldName('function')?.text ?? '')) node = parent.parent!;
    else return { awaited, statement: parent?.type === 'expression_statement', managed: parent?.type === 'as_pattern' || parent?.type === 'with_item' };
  }
}

/** The exception types a clause or a call names: `ValueError`, `(KeyError, IndexError)`. Empty when it names none. */
function typesOf(node: SyntaxNode | null | undefined): string[] {
  const expr = node?.type === 'as_pattern' ? node.namedChildren[0] : node;
  if (!expr) return [];
  return (expr.type === 'tuple' || expr.type === 'parenthesized_expression' ? expr.namedChildren : [expr]).map((item) => dottedName(item) ?? clipText(item.text));
}
const catchesAssertions = (types: readonly string[]): boolean => types.some((type) => type === '*' || includes(ASSERTION_CATCHERS, type.split('.').at(-1)));

/** Reads the body of a test, a hook or a helper function. */
export function readBody(body: SyntaxNode, ctx: BodyContext, options: BodyOptions = {}): BodyFacts {
  const facts: BodyFacts = { assertions: [], expectsException: false, tryBlocks: [] };
  const { env } = ctx;
  const skip = options.skip ?? new Set<number>();
  const nameOf = (node: SyntaxNode | null | undefined): string | null => qualify(dottedName(node), env.aliases);
  const needsAwait = ctx.playwrightApi === 'async' || (ctx.playwrightApi === null && options.async === true);

  /** False when an unconditional return, raise, break or fail call comes before the node in one of its blocks. */
  const isReachable = (node: SyntaxNode): boolean => {
    for (let current = node; current.id !== body.id && current.parent; current = current.parent) {
      if (current.parent.type !== 'block') continue;
      for (const sibling of statementsOf(current.parent)) {
        if (sibling.id === current.id) break;
        if (TERMINATORS.has(sibling.type)) return false;
        const call = sibling.type === 'expression_statement' && sibling.namedChildren[0] ? unwrap(sibling.namedChildren[0]) : null;
        if (call?.type === 'call' && Object.hasOwn(FAIL_CALLS, nameOf(call.childForFieldName('function')) ?? '')) return false;
      }
    }
    return true;
  };

  const make = (node: SyntaxNode, state: State, fields: Pick<NAssertion, 'kind' | 'library'> & Partial<NAssertion>): NAssertion => {
    const { kind, library, ...rest } = fields;
    if (state.handler) state.handler[kind === 'fail-call' ? 'fails' : 'asserts'] = true;
    return {
      span: spanOfNode(node), text: clipText(node.text), kind, library,
      actual: null, expected: null, matcher: null, negated: false, soft: state.soft, complete: true, awaited: 'not-needed',
      // `if not ok: pytest.fail()` is a check in itself: the condition is the assertion.
      guarded: kind === 'fail-call' ? state.other : state.cond || state.other,
      reachable: isReachable(node), viaHelper: null, ...rest,
    };
  };
  const operand = (node: SyntaxNode | null | undefined): NAssertion['actual'] => (node ? toExpr(node, env) : null);
  /** The status codes an assertion names (`200`, or `(200, 201)`) when the other side reads a status. Empty when it does not. */
  const statusCodes = (value: SyntaxNode | null | undefined, codes: SyntaxNode | null | undefined): number[] => {
    const read = value ? unwrap(value) : null;
    if (read?.type !== 'attribute' || !includes(STATUS_ATTRIBUTES, read.childForFieldName('attribute')?.text)) return [];
    const expr = codes ? unwrap(codes) : null;
    const items = expr && ['tuple', 'list', 'set'].includes(expr.type) ? expr.namedChildren : expr ? [expr] : [];
    return items.map((item) => numberValue(item)).filter((code): code is number => code !== null && Number.isInteger(code));
  };
  /** An assertion from a table entry: the kind, the two operands in the right order, and a status check when one side reads a status. */
  const fromCheck = (node: SyntaxNode, state: State, library: string, matcher: string, check: Check | undefined, first: SyntaxNode | undefined, second: SyntaxNode | undefined, more: Partial<NAssertion> = {}): NAssertion => {
    const [actual, expected] = check?.swap ? [second, first] : [first, second];
    const codes = [...statusCodes(actual, expected), ...statusCodes(expected, actual)];
    let kind = check?.kind ?? 'other';
    if (codes.length > 0 && TWO_OPERANDS.has(kind)) kind = 'status';
    if (kind === 'throws' && !check?.negated) facts.expectsException = true;
    return make(node, state, {
      kind, library, matcher, negated: check?.negated === true,
      // What is expected of a `raises` check is the exception type, its first argument.
      actual: kind === 'throws' ? null : operand(actual), expected: kind === 'throws' ? operand(first) : TWO_OPERANDS.has(kind) ? operand(expected) : null,
      ...(check?.operator ? { operator: check.operator } : {}), ...(kind === 'status' ? { statusCodes: codes } : {}), ...more,
    });
  };
  /** A check that expects an exception does nothing as a bare statement: it needs a `with` block or a function to call. */
  const raisesComplete = (top: SyntaxNode, call: SyntaxNode): boolean => {
    const used = usage(top);
    return used.managed || !used.statement || argumentsOf(call).positional.length >= 2;
  };
  /** For a check that is one link of a longer chain: start its span at the link. */
  const fromMember = (assertion: NAssertion, step: Step): NAssertion => {
    const start = spanOfNode(step.node.childForFieldName('attribute')!);
    return { ...assertion, span: { ...assertion.span, startLine: start.startLine, startColumn: start.startColumn } };
  };

  /** `assert <condition>` or `assert <condition>, "message"`. */
  const fromAssert = (node: SyntaxNode, state: State): NAssertion => fromCondition(node, state, node.namedChildren.find((child) => child.type !== 'comment'), false, ASSERT_LIBRARY, 'assert');
  /** A condition that must be true: the one of an `assert` statement, or a comparison handed to `self.assertTrue(...)`. */
  const fromCondition = (node: SyntaxNode, state: State, start: SyntaxNode | undefined, negatedAtStart: boolean, library: string, bare: string): NAssertion => {
    let negated = negatedAtStart;
    let condition = start;
    // A tuple is kept as it is: `assert (x, "message")` is always true.
    while (condition && (condition.type === 'not_operator' || (condition.type === 'parenthesized_expression' && condition.namedChildCount === 1))) {
      if (condition.type === 'not_operator') negated = !negated;
      condition = condition.namedChildren.find((child) => child.type !== 'comment');
    }
    if (!condition) return make(node, state, { kind: 'other', library, complete: false });
    const base = { library };
    const pseudo = pseudoMock(condition);
    if (pseudo) return make(node, state, { ...base, ...pseudo });

    if (condition.type === 'comparison_operator' && condition.namedChildCount >= 2) {
      // The first operator: '==', 'not in', 'is not', '<'. In `0 < x <= 10` the first pair is read.
      const first = condition.children.find((child) => !child.isNamed)!.text.replace(/\s+/g, ' ');
      let [left, right] = [condition.namedChildren[0]!, condition.namedChildren[1]!];
      const turned = first.startsWith('not') || first === '!=' || first === 'is not';
      const snapshot = [left, right].some((side) => includes(SNAPSHOT_FIXTURES, side.type === 'call' ? side.childForFieldName('function')?.text : side.text));
      let kind: AssertionKind = 'equality';
      let comparison = COMPARISON_OPERATORS[first];
      if (snapshot) kind = 'snapshot';
      else if (first.endsWith('in')) {
        kind = 'contains';
        // `assert "a" in items` checks the items. `assert status in (200, 201)` checks the status.
        if (!['tuple', 'list', 'set'].includes(unwrap(right).type)) [left, right] = [right, left];
      } else if (comparison) kind = 'comparison';
      else if (unwrap(right).type === 'none') kind = 'nullness';
      // The value under test is the side that is not a literal: `assert 200 == response.status_code`.
      if (!first.endsWith('in') && toExpr(left, env).kind === 'literal' && toExpr(right, env).kind !== 'literal') {
        [left, right] = [right, left];
        if (comparison) comparison = ({ '>': '<', '>=': '<=', '<': '>', '<=': '>=' } as const)[comparison];
      }
      const codes = [...statusCodes(left, right), ...statusCodes(right, left)];
      if (codes.length > 0 && kind !== 'snapshot') kind = 'status';
      else if (mockState(left)) kind = 'mock-call';
      return make(node, state, {
        ...base, kind, matcher: first, negated: negated !== turned, actual: operand(left), expected: kind === 'nullness' ? null : operand(right),
        ...(comparison && kind === 'comparison' ? { operator: comparison } : {}), ...(kind === 'status' ? { statusCodes: codes } : {}),
      });
    }
    if (condition.type === 'call' && includes(TYPE_CHECK_FUNCTIONS, condition.childForFieldName('function')?.text)) {
      const { positional } = argumentsOf(condition);
      return make(node, state, { ...base, kind: 'type', matcher: condition.childForFieldName('function')!.text, negated, actual: operand(positional[0]), expected: operand(positional[1]) });
    }
    return make(node, state, { ...base, kind: mockState(condition) ? 'mock-call' : 'truthiness', matcher: bare, negated, actual: operand(condition) });
  };
  /** `send.called`, `send.call_count`: an attribute that says how a mock was called. */
  const mockState = (node: SyntaxNode): boolean => {
    const expr = unwrap(node);
    return expr.type === 'attribute' && includes(MOCK_STATE_ATTRIBUTES, expr.childForFieldName('attribute')?.text);
  };
  /** `send.called_once_with(1)` or `send.assert_called_once` with no call: it reads like a mock assertion and checks nothing. */
  const pseudoMock = (node: SyntaxNode): (Pick<NAssertion, 'kind' | 'library'> & Partial<NAssertion>) | null => {
    const expr = unwrap(node);
    const attribute = expr.type === 'call' ? expr.childForFieldName('function') : expr;
    if (attribute?.type !== 'attribute') return null;
    const name = attribute.childForFieldName('attribute')?.text ?? '';
    const object = attribute.childForFieldName('object')!;
    const real = includes(MOCK_ASSERTS, name);
    const fake = includes(PSEUDO_MOCK_ASSERTS, name) || (name.startsWith(ASSERT_FUNCTION_PREFIX) && !real && isMock(object, env));
    if (!fake && !(real && expr.type !== 'call')) return null;
    return { kind: 'mock-call', library: 'unittest.mock', matcher: name, complete: false, actual: { ...toExpr(object, env), isMock: true } };
  };

  /** Null when the chain is not an assertion. */
  const classify = (top: SyntaxNode, steps: Step[], state: State): NAssertion[] | null => {
    const [root, ...rest] = steps as [Step, ...Step[]];
    const last = steps.at(-1)!;
    const used = usage(top);
    /** The qualified name of the first links that are not called: `pytest.raises` for `pytest.raises(E)`. */
    const lead = steps.findIndex((step) => step.call !== null);
    const named = (count: number): string | null => (root.name === '' ? null : qualify(steps.slice(0, count).map((step) => step.name).join('.'), env.aliases));
    const full = named(lead < 0 ? steps.length : lead + 1);
    const head = lead < 0 ? null : steps[lead]!;
    const leadCall = head?.call ?? null;
    const args = leadCall ? argumentsOf(leadCall).positional : [];
    /** The links after the first call: the matcher of `expect(x).to_be_visible()`. */
    const after = lead < 0 ? [] : steps.slice(lead + 1);

    // Playwright: expect(locator).to_be_visible()
    if (head?.name === EXPECT_ROOT && (full === `${PLAYWRIGHT_SYNC_MODULE}.${EXPECT_ROOT}` || full === `${PLAYWRIGHT_ASYNC_MODULE}.${EXPECT_ROOT}` || (full === EXPECT_ROOT && ctx.playwright))) {
      const matcher = after[0];
      const complete = matcher?.call != null;
      if (!complete && !used.statement) return null; // `e = expect(x)` may be finished later
      const name = matcher?.name ?? null;
      const negated = name?.startsWith(NEGATED_MATCHER_PREFIX) === true;
      const kind = (name !== null && PLAYWRIGHT_MATCHERS[negated ? name.slice(NEGATED_MATCHER_PREFIX.length) : name]) || 'other';
      return [make(top, state, {
        kind, library: 'playwright', matcher: name, negated, complete, actual: operand(args[0]), expected: operand(matcher?.call ? argumentsOf(matcher.call).positional[0] : null),
        awaited: needsAwait ? (used.awaited ? 'yes' : 'no') : 'not-needed',
      })];
    }

    // assert_that(actual, matcher) of PyHamcrest, assert_that(actual).is_equal_to(expected) of assertpy.
    if (head?.name === ASSERT_THAT && (full === `${HAMCREST_MODULE}.${ASSERT_THAT}` || full === `${ASSERTPY_MODULE}.${ASSERT_THAT}` || full === ASSERT_THAT)) {
      if (full === `${ASSERTPY_MODULE}.${ASSERT_THAT}` || (full === ASSERT_THAT && ctx.assertpy)) {
        // `.when_called_with(...)` and `.described_as(...)` are part of a chain and check nothing themselves.
        const checks = after.filter((step) => step.call && (ASSERTPY_METHODS[step.name] || ASSERTPY_CHECK_NAME.test(step.name)));
        if (checks.length === 0) return used.statement ? [make(top, state, { kind: 'other', library: 'assertpy', complete: false, actual: operand(args[0]) })] : null;
        return checks.map((step) => {
          const [value] = argumentsOf(step.call!).positional;
          return fromMember(fromCheck(top, state, 'assertpy', step.name, ASSERTPY_METHODS[step.name], args[0], value, ASSERTPY_METHODS[step.name]?.kind === 'throws' ? { expected: operand(value) } : {}), step);
        });
      }
      let negated = false;
      let matcher: SyntaxNode | undefined = args[1];
      // `is_(not_(equal_to(5)))`: the wrappers are passed through. `is_(5)` is equal_to(5).
      while (matcher?.type === 'call' && Object.hasOwn(HAMCREST_WRAPPERS, calleeName(matcher) ?? '')) {
        negated = negated !== HAMCREST_WRAPPERS[calleeName(matcher)!];
        matcher = argumentsOf(matcher).positional[0];
      }
      if (!matcher) return [make(top, state, { kind: 'truthiness', library: 'hamcrest', matcher: ASSERT_THAT, actual: operand(args[0]) })];
      const name = matcher.type === 'call' ? calleeName(matcher) : null;
      const check = name !== null && HAMCREST_MATCHERS[name] ? HAMCREST_MATCHERS[name] : name === null ? { kind: 'equality' as const } : undefined;
      const value = name === null ? matcher : argumentsOf(matcher).positional[0];
      const assertion = fromCheck(top, state, 'hamcrest', name ?? 'equal_to', check, args[0], value, check?.kind === 'throws' ? { expected: operand(value) } : {});
      return [{ ...assertion, negated: assertion.negated !== negated }];
    }

    // pytest.raises(ValueError), pytest.fail("...")
    if (leadCall && lead === steps.length - 1 && includes(EXCEPTION_CALLS, full)) {
      facts.expectsException = true;
      return [make(top, state, { kind: 'throws', library: 'pytest', matcher: full, expected: operand(args[0]), complete: raisesComplete(top, leadCall) })];
    }
    if (leadCall && lead === steps.length - 1 && full !== null && Object.hasOwn(FAIL_CALLS, full)) return [make(top, state, { kind: 'fail-call', library: FAIL_CALLS[full]!, matcher: full })];

    // unittest: self.assertEqual(a, b), and any other self.assert* method.
    if (root.name === UNITTEST_ROOT && !root.call && steps.length === 2 && last.call && last.name.startsWith(UNITTEST_ASSERT_PREFIX)) {
      const check = UNITTEST_ASSERTS[last.name];
      const second = args[1];
      // `self.assertTrue(a, b)` checks only `a`. A second argument that is not a message is kept, so a rule can see it.
      const extra = check?.kind === 'truthiness' && second && !['string', 'concatenated_string'].includes(second.type) ? { expected: operand(second) } : {};
      // `self.assertTrue(a == b)` and `self.assertFalse(len(rows) < 0)` are read as the comparison they hold.
      if (check?.kind === 'truthiness' && !('expected' in extra) && args[0] && ['comparison_operator', 'not_operator'].includes(unwrap(args[0]).type)) {
        return [{ ...fromCondition(top, state, args[0], check.negated ?? false, 'unittest', last.name), matcher: last.name }];
      }
      return [fromCheck(top, state, 'unittest', last.name, check, args[0], second, { ...extra, ...(check?.kind === 'throws' ? { complete: raisesComplete(top, last.call) } : {}) })];
    }

    // pytest-check: check.equal(a, b) fails the test at its end.
    if (steps.length >= 2 && last.call && includes(CHECK_ROOTS, named(steps.length - 1)) && steps.slice(0, -1).every((step) => !step.call)) {
      return [fromCheck(top, state, 'pytest-check', last.name, CHECK_METHODS[last.name], args[0], args[1], { soft: true })];
    }
    if (last.call && includes(SNAPSHOT_CALLS, full) && lead === steps.length - 1) return [make(top, state, { kind: 'snapshot', library: 'snapshot', matcher: last.name, actual: operand(args[0]) })];

    // Mock assertions, real ones and look-alikes.
    if (rest.length > 0 && last.call && includes(MOCK_ASSERTS, last.name)) {
      const object = last.node.childForFieldName('object')!;
      return [make(top, state, {
        kind: 'mock-call', library: 'unittest.mock', matcher: last.name, negated: includes(NEGATED_MOCK_ASSERTS, last.name),
        actual: { ...toExpr(object, env), isMock: true }, expected: operand(argumentsOf(last.call).positional[0]),
      })];
    }
    const pseudo = rest.length > 0 && used.statement ? pseudoMock(top) : null;
    if (pseudo) return [make(top, state, pseudo)];

    if (!last.call) return null;
    if (rest.length > 0 && includes(STATUS_CHECK_METHODS, last.name)) return [make(top, state, { kind: 'status', library: 'http-client', matcher: last.name, actual: operand(last.node.childForFieldName('object')) })];
    if (ctx.isHelper(last.name)) return [make(top, state, { kind: 'other', library: 'helper', viaHelper: last.name })];
    // A helper that is handed over to be called later, `for_each_item(check_price)`: its checks run when and if the callee calls it.
    const given = argumentsOf(last.call);
    const handed = [...given.positional, ...given.keywords.values()].find((value) => value.type === 'identifier' && ctx.isHelper(value.text));
    if (handed) return [{ ...make(top, state, { kind: 'other', library: 'helper', viaHelper: handed.text }), guarded: true }];
    // A function named assert_something is an assertion by its name: numpy.testing, pandas.testing and many more.
    return last.name.startsWith(ASSERT_FUNCTION_PREFIX) && steps.every((step, index) => index === steps.length - 1 || !step.call)
      ? [make(top, state, { kind: 'other', library: 'assert-function', matcher: last.name, actual: operand(args[0]), expected: operand(args[1]) })] : null;
  };

  /** A block whose failures something catches: `try/except`, `with suppress(...)`, `with pytest.raises(...)`. */
  const block = (node: SyntaxNode, kind: NTryBlock['kind'], state: State, protectedPart: SyntaxNode | null, catches: string[], handler: HandlerFacts): void => {
    const before = facts.assertions.length;
    if (protectedPart) walk(protectedPart, state);
    facts.tryBlocks.push({
      span: spanOfNode(node), kind, catches: [...new Set(catches)], catchesAssertionFailures: catchesAssertions(catches),
      // A soft assertion does not raise, so a handler cannot hide it.
      assertionsInside: facts.assertions.slice(before).filter((assertion) => !assertion.soft).length,
      handlerRethrows: handler.rethrows, handlerFails: handler.fails, handlerAsserts: handler.asserts,
    });
  };

  const walk = (node: SyntaxNode, state: State): void => {
    if (node.type === 'comment' || skip.has(node.id) || LOCAL_DECLARATIONS.has(node.type)) return; // a local helper is read through its calls
    const field = (name: string): SyntaxNode | null => node.childForFieldName(name);
    const each = (change: (child: SyntaxNode) => Partial<State>): void => {
      for (const child of node.namedChildren) walk(child, { ...state, ...change(child) });
    };
    if (node.type === 'if_statement' || node.type === 'match_statement') return each((child) => (sameNode(field('condition') ?? field('subject'), child) ? {} : { cond: true }));
    if (node.type === 'conditional_expression') return each((child) => (sameNode(node.namedChildren[1], child) ? {} : { other: true }));
    if (node.type === 'boolean_operator') return each((child) => (sameNode(field('left'), child) ? {} : { other: true }));
    if (LOOPS.has(node.type)) {
      // `for n in [1, 2, 3]:` always runs its body, so what it checks is not conditional. Any other loop may run zero times.
      const over = node.type === 'for_statement' ? field('right') : null;
      const always = over !== null && ['list', 'tuple', 'set'].includes(over.type) && over.namedChildren.some((item) => item.type !== 'comment');
      return each((child) => ((child.type === 'block' && !always) || child.type === 'else_clause' ? { other: true } : {}));
    }
    if (COMPREHENSIONS.has(node.type)) return each((child) => (sameNode(field('body'), child) ? { other: true } : {}));
    if (node.type === 'lambda') return each(() => ({ other: true, callback: true }));

    if (node.type === 'try_statement') {
      const clauses = node.namedChildren.filter((child) => EXCEPT_CLAUSES.has(child.type));
      const others = node.namedChildren.filter((child) => child.type === 'else_clause' || child.type === 'finally_clause');
      if (clauses.length === 0) walk(field('body')!, state);
      else {
        const types = clauses.map((clause) => {
          const named = typesOf(clause.namedChildren.find((child) => child.type !== 'block' && child.type !== 'comment'));
          return named.length > 0 ? named : ['*'];
        });
        // Python runs the first clause that matches, so that clause decides what happens to a failed assertion.
        const catching = types.findIndex((named) => catchesAssertions(named));
        const handler: HandlerFacts = { rethrows: false, fails: false, asserts: false };
        const facade: HandlerFacts = { rethrows: false, fails: false, asserts: false };
        block(node, 'try-catch', state, field('body'), types.flat(), handler);
        clauses.forEach((clause, index) => walk(clause.namedChildren.find((child) => child.type === 'block')!, { ...state, other: true, handler: catching < 0 || index === catching ? handler : facade }));
        Object.assign(facts.tryBlocks.at(-1)!, { handlerRethrows: handler.rethrows, handlerFails: handler.fails, handlerAsserts: handler.asserts });
      }
      for (const clause of others) walk(clause, state);
      return;
    }
    if (node.type === 'with_statement') {
      const body = field('body');
      const items = node.namedChildren.find((child) => child.type === 'with_clause')?.namedChildren.filter((child) => child.type === 'with_item') ?? [];
      let inner = state;
      let around: { kind: NTryBlock['kind']; catches: string[] } | null = null;
      for (const item of items) {
        const value = item.childForFieldName('value');
        const expr = value?.type === 'as_pattern' ? value.namedChildren[0]! : value;
        if (!expr) continue;
        walk(expr, state);
        const call = expr.type === 'call' ? expr : null;
        const name = nameOf(call ? call.childForFieldName('function') : expr);
        if (includes(CHECK_ROOTS, name)) inner = { ...inner, soft: true };
        else if (call && includes(SUPPRESS_CALLS, name)) around = { kind: 'try-catch', catches: argumentsOf(call).positional.flatMap((type) => typesOf(type)) };
        else if (call && (includes(EXCEPTION_CALLS, name) || (name?.startsWith(`${UNITTEST_ROOT}.`) && UNITTEST_ASSERTS[name.slice(UNITTEST_ROOT.length + 1)]?.kind === 'throws'))) {
          around = { kind: 'expected-exception-block', catches: typesOf(argumentsOf(call).positional[0]) };
        }
      }
      if (around) block(node, around.kind, inner, body, around.catches, { rethrows: false, fails: false, asserts: false });
      else if (body) walk(body, inner);
      return;
    }
    if (node.type === 'raise_statement') {
      const raised = node.namedChildren[0];
      const skips = includes(RAISED_SKIPS, nameOf(raised?.type === 'call' ? raised.childForFieldName('function') : raised));
      if (state.handler) state.handler.rethrows = true;
      // A raise in the test's own flow fails the test. A raised skip does not.
      else if (!state.callback && !skips) facts.assertions.push(make(node, state, { kind: 'fail-call', library: 'raise', matcher: 'raise', expected: operand(raised) }));
      return;
    }
    if (node.type === 'assert_statement') {
      facts.assertions.push(fromAssert(node, state));
      return;
    }
    if ((node.type === 'call' || node.type === 'attribute') && isTop(node)) {
      const steps = chainOf(node);
      const found = steps && classify(node, steps, state);
      if (steps && found) {
        facts.assertions.push(...found);
        for (const step of steps) {
          const list = step.call?.childForFieldName('arguments');
          if (list) walk(list, state);
        }
        return;
      }
    }
    for (const child of node.namedChildren) walk(child, state);
  };

  const start: State = { cond: false, other: false, callback: false, soft: false, handler: null };
  for (const statement of options.statements ?? [body]) walk(statement, start);
  return facts;
}
