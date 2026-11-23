// JS/TS: what a test body checks (SPEC.md Sections 8.1 and 9.1). Finds the assertions with
// their operands, whether each one is awaited, guarded and reachable, the try blocks and
// promise catches around them, and the calls that promise assertions will run.
import { clipText } from '../../model/build.js';
import type { AssertionKind, NAssertion, NTest, NTryBlock } from '../../model/types.js';
import { spanOfNode } from '../../parse/positions.js';
import type { SyntaxNode } from '../../parse/treesitter.js';
import { calleeName, isLocator, rootName, toExpr, unwrap, type Env } from './expr.js';
import { argumentsOf, isFunction, memberChain, stringValue } from './syntax.js';
import {
  ALWAYS_RUN_CALLBACKS, ASSERTION_GUARDS, ASSERT_ROOT, ASYNC_ASSERT_METHODS, CHAIN_WORDS, CYPRESS_ASSERT_COMMANDS, CYPRESS_CONTAINS, CYPRESS_ROOT,
  CYPRESS_UI_WORDS, EXCEPTION_MATCHERS, EXPECT_ROOT, EXPECT_VARIANTS, FAIL_CALLS, HANDLER_FAIL_CALLS, LIBRARY_OWNERS, MATCHER_KINDS, NEGATED_ASSERT_METHOD,
  NEGATIONS, PLAYWRIGHT_ASYNC_MATCHERS, PROMISE_CATCH, PROMISE_MATCHERS, PROMISE_MEMBERS, PROMISE_MODIFIERS, PROPERTY_MATCHERS, RETRYING_VARIANTS, SHOULD_MEMBER,
  SOFT_VARIANT, STATUS_MEMBERS,
} from './vocab.js';

export interface BodyContext {
  env: Env;
  /** The library behind `expect` in this file: 'expect', 'playwright', 'expect-webdriverio' or 'chai'. */
  expectLibrary: string;
  /** The library behind `assert`: 'node-assert' or 'chai'. */
  assertLibrary: string;
  /** A function or method known to contain an assertion. */
  isHelper(name: string): boolean;
}

export interface BodyFacts {
  assertions: NAssertion[];
  guards: NTest['assertionGuards'];
  expectsException: boolean;
  tryBlocks: NTryBlock[];
}

/** One link of a chain: `expect`, `.not`, `.toBe(1)`. `call` is set when the link is called. */
interface Step { name: string; node: SyntaxNode; call: SyntaxNode | null }
interface HandlerFacts { rethrows: boolean; fails: boolean; asserts: boolean }
/** `cond`: under an if or switch. `other`: under a loop, ternary, short-circuit, catch or callback. `callback`: in a function that may never run. */
interface State { cond: boolean; other: boolean; callback: boolean; handler: HandlerFacts | null }

const KIND_OF = new Map<string, AssertionKind>();
for (const [kind, names] of Object.entries(MATCHER_KINDS)) for (const name of names) KIND_OF.set(name, kind as AssertionKind);

const includes = (list: readonly string[], value: string | undefined): boolean => value !== undefined && list.includes(value);
const LOOPS = new Set(['for_statement', 'for_in_statement', 'while_statement', 'do_statement']);
const LOCAL_DECLARATIONS = new Set(['function_declaration', 'generator_function_declaration', 'class_declaration']);
const TERMINATORS = new Set(['return_statement', 'throw_statement', 'break_statement', 'continue_statement']);
const PASS_THROUGH = new Set(['parenthesized_expression', 'array', 'binary_expression', 'ternary_expression', 'sequence_expression']);
const TWO_OPERANDS = new Set<AssertionKind>(['equality', 'comparison', 'contains', 'type', 'count', 'status', 'mock-call']);
// `response.status`, `response.status()`, and Cypress `.its('status')`.
const STATUS = new RegExp(`\\.(?:(${STATUS_MEMBERS.join('|')})(\\(\\))?|its\\(['"](${STATUS_MEMBERS.join('|')})['"]\\))$`);
const SHORT_CIRCUIT = new Set(['&&', '||', '??']);
const sameNode = (a: SyntaxNode | null | undefined, b: SyntaxNode): boolean => a?.id === b.id;

/** A chain as its links from the root outward, or null when it is not a plain chain. */
function chainOf(top: SyntaxNode): Step[] | null {
  const steps: Step[] = [];
  let node = top;
  let call: SyntaxNode | null = null;
  for (;;) {
    if (node.type === 'call_expression' && !call) {
      call = node;
      node = node.childForFieldName('function')!;
    } else if (node.type === 'member_expression') {
      steps.unshift({ name: node.childForFieldName('property')!.text, node, call });
      call = null;
      node = node.childForFieldName('object')!;
    } else break;
  }
  const named = node.type === 'identifier' || node.type === 'this';
  if (!named && call) return null; // a call of a call
  steps.unshift({ name: named ? node.text : '', node, call });
  return steps;
}

/** True when nothing continues the chain above this node. Promise handling (`.then`, `.catch`) is not part of it. */
function isTop(node: SyntaxNode): boolean {
  const parent = node.parent;
  if (parent?.type === 'call_expression') return !sameNode(parent.childForFieldName('function'), node);
  if (parent?.type !== 'member_expression' || !sameNode(parent.childForFieldName('object'), node)) return true;
  return includes(PROMISE_MEMBERS, parent.childForFieldName('property')?.text);
}

/**
 * What happens to the value of a chain: is it awaited or handed on (returned, stored, passed
 * to a call), and is it a whole statement? Looks above parentheses and promise handling.
 */
function usage(top: SyntaxNode): { awaited: boolean; statement: boolean } {
  let node = top;
  let awaited = false;
  for (;;) {
    const parent = node.parent!;
    const chained = parent.type === 'member_expression' && parent.parent?.type === 'call_expression';
    const promiseAll = parent.type === 'arguments' && /^Promise\.\w+$/.test(parent.parent?.childForFieldName('function')?.text ?? '');
    if (parent.type === 'await_expression') awaited = true;
    if (chained || promiseAll) node = parent.parent!;
    else if (parent.type === 'await_expression' || PASS_THROUGH.has(parent.type)) node = parent;
    else if (parent.type === 'expression_statement') return { awaited, statement: true };
    else return { awaited: true, statement: false };
  }
}

/** False when an unconditional return, throw, break or fail call comes before the node in one of its blocks. */
function isReachable(node: SyntaxNode, body: SyntaxNode): boolean {
  for (let current = node; current.id !== body.id && current.parent; current = current.parent) {
    if (current.parent.type !== 'statement_block') continue;
    for (const sibling of current.parent.namedChildren) {
      if (sibling.id === current.id) break;
      if (TERMINATORS.has(sibling.type)) return false;
      const call = sibling.type === 'expression_statement' && sibling.namedChildren[0] ? unwrap(sibling.namedChildren[0]) : null;
      const chain = call?.type === 'call_expression' ? memberChain(call.childForFieldName('function')) : null;
      if (chain && includes(FAIL_CALLS, [chain.root, ...chain.members].join('.'))) return false;
    }
  }
  return true;
}

/** The status codes an assertion names (`200`, or `[200, 201]`) when one side reads a status. Empty when it does not. */
function statusCodes(value: SyntaxNode | null, codes: SyntaxNode | null): number[] {
  if (!value || !STATUS.test(unwrap(value).text)) return [];
  const expr = codes ? unwrap(codes) : null;
  const items = expr?.type === 'array' ? expr.namedChildren : expr ? [expr] : [];
  return items.filter((item) => item.type === 'number').map((item) => Number(item.text)).filter((code) => Number.isInteger(code));
}

/** Reads the body of a test, a hook or a helper function. */
export function readBody(body: SyntaxNode, ctx: BodyContext): BodyFacts {
  const facts: BodyFacts = { assertions: [], guards: { expectedCount: false, hasAssertions: false }, expectsException: false, tryBlocks: [] };
  const { env } = ctx;
  const statements = body.type === 'statement_block' ? body.namedChildren.filter((node) => node.type !== 'comment') : [body];
  const lastStatement = statements.at(-1) ?? null;

  const make = (node: SyntaxNode, state: State, fields: Pick<NAssertion, 'kind' | 'library'> & Partial<NAssertion>, top: SyntaxNode = node): NAssertion => {
    const { kind, library, ...rest } = fields;
    if (state.handler) state.handler[kind === 'fail-call' ? 'fails' : 'asserts'] = true;
    return {
      span: spanOfNode(node), text: clipText(node.text), kind, library,
      actual: null, expected: null, matcher: null, negated: false, soft: false, complete: true,
      awaited: 'not-needed',
      // `if (!ok) fail()` is a check in itself: the condition is the assertion.
      guarded: kind === 'fail-call' ? state.other : state.cond || state.other,
      reachable: isReachable(top, body), viaHelper: null, ...rest,
    };
  };

  /** `expect(actual)` or `actual.should`, then the words and the matcher that follow. */
  const fromChain = (top: SyntaxNode, state: State, actual: SyntaxNode | null, rest: Step[], library: string, variant: string | null): NAssertion[] | null => {
    let negated = false;
    let promise: string | null = null;
    let words = false;
    let matcher: Step | null = null;
    for (const step of rest) {
      if (includes(NEGATIONS, step.name) && !step.call) negated = !negated;
      else if (includes(PROMISE_MODIFIERS, step.name) && !step.call) promise = step.name;
      else if (includes(CHAIN_WORDS, step.name) && !step.call) words = true;
      else if (!matcher || (!matcher.call && step.call)) matcher = step;
    }
    const complete = matcher !== null && (matcher.call !== null || includes(PROPERTY_MATCHERS, matcher.name));
    const used = usage(top);
    // An unfinished chain is only reported when it is a whole statement; `const e = expect(x)` may be finished later.
    if (!complete && !used.statement) return null;
    const name = matcher?.name;
    const expectedNode = matcher?.call ? argumentsOf(matcher.call)[0] ?? null : null;
    let kind = (name !== undefined && KIND_OF.get(name)) || 'other';
    const codes = [...statusCodes(actual, expectedNode), ...statusCodes(expectedNode, actual)];
    if (codes.length > 0 && TWO_OPERANDS.has(kind)) kind = 'status';
    if (!negated && (includes(EXCEPTION_MATCHERS, promise ?? undefined) || includes(EXCEPTION_MATCHERS, name))) facts.expectsException = true;
    const needsAwait = includes(RETRYING_VARIANTS, variant ?? undefined) || promise !== null || includes(PROMISE_MATCHERS, name)
      || (library === 'playwright' && includes(PLAYWRIGHT_ASYNC_MATCHERS, name))
      || (library === 'expect-webdriverio' && (kind === 'ui-state' || kind === 'count') && actual !== null && (isLocator(actual, env) || rootName(actual) === 'browser'));
    return [make(top, state, {
      kind, library: words ? 'chai' : library, matcher: name ?? null, negated, complete, soft: variant === SOFT_VARIANT,
      actual: actual && toExpr(actual, env), expected: expectedNode && toExpr(expectedNode, env),
      awaited: needsAwait ? (used.awaited ? 'yes' : 'no') : 'not-needed',
      ...(kind === 'status' && codes.length > 0 ? { statusCodes: codes } : {}),
    })];
  };

  /** Null when the chain is not an assertion. An empty list when it is handled but adds none (a guard). */
  const classify = (top: SyntaxNode, steps: Step[], state: State): NAssertion[] | null => {
    const [root, ...rest] = steps as [Step, ...Step[]];
    const dotted = `${root.name}.${rest[0]?.name ?? ''}`;

    if (root.name === CYPRESS_ROOT) {
      const found: NAssertion[] = [];
      let subject: SyntaxNode | null = null; // what `.should(...).and(...)` checks: the chain before the first of them
      for (const step of rest) {
        const args = step.call ? argumentsOf(step.call) : [];
        const chainer = includes(CYPRESS_ASSERT_COMMANDS, step.name) ? stringValue(args[0] ?? null) : null;
        subject = includes(CYPRESS_ASSERT_COMMANDS, step.name) ? subject ?? step.node.childForFieldName('object')! : null;
        if (chainer !== null && subject) {
          const words = chainer.split('.');
          const last = words.at(-1)!;
          const codes = statusCodes(subject, args[1] ?? null);
          const assertion = make(step.call!, state, {
            kind: codes.length > 0 ? 'status' : includes(CYPRESS_UI_WORDS, last) ? 'ui-state' : KIND_OF.get(last) ?? 'other',
            library: 'cypress-should', matcher: chainer, negated: words.includes('not'),
            actual: toExpr(subject, env), expected: args[1] ? toExpr(args[1], env) : null, ...(codes.length > 0 ? { statusCodes: codes } : {}),
          }, top);
          // The span starts at `should`, so two checks on one chain do not share a line.
          const start = spanOfNode(step.node.childForFieldName('property')!);
          assertion.span = { ...assertion.span, startLine: start.startLine, startColumn: start.startColumn };
          found.push(assertion);
        } else if (step.call && KIND_OF.get(step.name) === 'visual') found.push(make(step.call, state, { kind: 'visual', library: 'cypress', matcher: step.name }, top));
        else if (step.call && ctx.isHelper(step.name)) found.push(make(step.call, state, { kind: 'other', library: 'helper', viaHelper: step.name }, top)); // a custom command
      }
      const last = rest.at(-1);
      const trailing = lastStatement !== null && sameNode(lastStatement.type === 'expression_statement' ? lastStatement.namedChildren[0] : lastStatement, top);
      if (found.length === 0 && last?.name === CYPRESS_CONTAINS && last.call && trailing) {
        const text = argumentsOf(last.call).at(-1);
        found.push(make(top, state, { kind: 'ui-state', library: 'cypress', matcher: CYPRESS_CONTAINS, actual: toExpr(top, env), expected: text ? toExpr(text, env) : null }));
      }
      return found.length > 0 ? found : null;
    }
    // A promise handled inside the chain: the assertion, if any, is the part before `.then` or `.catch`.
    if (rest.some((step) => step.call && includes(PROMISE_MEMBERS, step.name))) return null;

    if (includes(FAIL_CALLS, root.name) && root.call && rest.length === 0) return [make(top, state, { kind: 'fail-call', library: 'fail', matcher: root.name })];
    if (includes(FAIL_CALLS, dotted) && rest[0]!.call) return [make(top, state, { kind: 'fail-call', library: root.name === ASSERT_ROOT ? ctx.assertLibrary : ctx.expectLibrary, matcher: dotted })];

    if (root.name === EXPECT_ROOT) {
      if (root.call) return fromChain(top, state, argumentsOf(root.call)[0] ?? null, rest, ctx.expectLibrary, null);
      const guard = ASSERTION_GUARDS[dotted];
      if (guard && rest[0]!.call) {
        facts.guards[guard] = true;
        return [];
      }
      const variant = rest[0];
      if (!variant?.call || !includes(EXPECT_VARIANTS, variant.name)) return null;
      return fromChain(top, state, argumentsOf(variant.call)[0] ?? null, rest.slice(1), ctx.expectLibrary, variant.name);
    }

    // `chai.expect(x)`: expect one level down.
    if (rest[0]?.name === EXPECT_ROOT && rest[0].call && root.name !== '') {
      return fromChain(top, state, argumentsOf(rest[0].call)[0] ?? null, rest.slice(1), LIBRARY_OWNERS[root.name] ?? ctx.expectLibrary, null);
    }

    // `assert(x)`, `assert.equal(a, b)`, and `sinon.assert.x(...)` or `t.assert.x(...)` one level down.
    const viaMember = rest[0]?.name === ASSERT_ROOT && !rest[0].call && root.name !== '';
    if (root.name === ASSERT_ROOT || viaMember) {
      const method = (viaMember ? rest.slice(1) : rest).at(-1);
      const library = viaMember ? LIBRARY_OWNERS[root.name] ?? 'node-assert' : ctx.assertLibrary;
      if (!method) return root.call ? [make(top, state, { kind: 'truthiness', library, matcher: ASSERT_ROOT, actual: operand(root.call, 0) })] : null;
      if (!method.call) return null;
      const negated = NEGATED_ASSERT_METHOD.test(method.name);
      let kind: AssertionKind = library === 'sinon' ? 'mock-call' : KIND_OF.get(method.name) ?? 'other';
      const args = argumentsOf(method.call);
      const codes = statusCodes(args[0] ?? null, args[1] ?? null);
      if (codes.length > 0 && TWO_OPERANDS.has(kind)) kind = 'status';
      if (!negated && includes(EXCEPTION_MATCHERS, method.name)) facts.expectsException = true;
      return [make(top, state, {
        kind, library, matcher: method.name, negated, actual: operand(method.call, 0), expected: TWO_OPERANDS.has(kind) ? operand(method.call, 1) : null,
        awaited: includes(ASYNC_ASSERT_METHODS, method.name) ? (usage(top).awaited ? 'yes' : 'no') : 'not-needed',
        ...(kind === 'status' ? { statusCodes: codes } : {}),
      })];
    }

    // Chai `should`: `total.should.equal(5)`.
    const should = rest.findIndex((step) => step.name === SHOULD_MEMBER && !step.call);
    if (should >= 0) return fromChain(top, state, rest[should]!.node.childForFieldName('object'), rest.slice(should + 1), 'chai', null);

    const name = top.type === 'call_expression' ? calleeName(top) : null;
    return name !== null && ctx.isHelper(name) ? [make(top, state, { kind: 'other', library: 'helper', viaHelper: name })] : null;
  };
  const operand = (call: SyntaxNode, index: number): NAssertion['actual'] => {
    const argument = argumentsOf(call)[index];
    return argument ? toExpr(argument, env) : null;
  };

  const tryBlock = (node: SyntaxNode, kind: NTryBlock['kind'], state: State, guardedPart: SyntaxNode, handlers: SyntaxNode[]): void => {
    const before = facts.assertions.length;
    walk(guardedPart, state);
    const assertionsInside = facts.assertions.length - before;
    const handler: HandlerFacts = { rethrows: false, fails: false, asserts: false };
    for (const part of handlers) walk(part, { ...state, other: true, handler });
    facts.tryBlocks.push({
      span: spanOfNode(node), kind, assertionsInside, catches: ['*'], catchesAssertionFailures: true,
      handlerRethrows: handler.rethrows, handlerFails: handler.fails, handlerAsserts: handler.asserts,
    });
  };

  const walk = (node: SyntaxNode, state: State): void => {
    const field = (name: string): SyntaxNode | null => node.childForFieldName(name);
    const branch = (part: SyntaxNode | null, change: Partial<State>): void => {
      if (part) walk(part, { ...state, ...change });
    };
    if (node.type === 'comment' || LOCAL_DECLARATIONS.has(node.type)) return; // a local helper is read through its calls
    if (isFunction(node)) {
      if (node.parent?.type === 'variable_declarator') return;
      const owner = node.parent?.type === 'arguments' ? calleeName(node.parent.parent!) ?? undefined : undefined;
      return branch(field('body'), includes(ALWAYS_RUN_CALLBACKS, owner) ? {} : { other: true, callback: true });
    }
    if (node.type === 'method_definition') return branch(field('body'), { other: true, callback: true });
    if (node.type === 'if_statement') {
      branch(field('condition'), {});
      branch(field('consequence'), { cond: true });
      return branch(field('alternative'), { cond: true });
    }
    if (node.type === 'switch_statement') {
      branch(field('value'), {});
      return branch(field('body'), { cond: true });
    }
    if (node.type === 'ternary_expression') {
      branch(field('condition'), {});
      branch(field('consequence'), { other: true });
      return branch(field('alternative'), { other: true });
    }
    if (node.type === 'binary_expression' && SHORT_CIRCUIT.has(field('operator')?.text ?? '')) {
      branch(field('left'), {});
      return branch(field('right'), { other: true });
    }
    if (LOOPS.has(node.type)) {
      for (const child of node.namedChildren) branch(child, sameNode(field('body'), child) ? { other: true } : {});
      return;
    }
    if (node.type === 'try_statement') {
      const handler = field('handler');
      if (handler) tryBlock(node, 'try-catch', state, field('body')!, [handler.childForFieldName('body')!]);
      else branch(field('body'), {});
      return branch(field('finalizer'), {});
    }
    if (node.type === 'throw_statement') {
      if (state.handler) state.handler.rethrows = true;
      // A throw in the test's own flow fails the test. In a callback it may be a mock that throws.
      else if (!state.callback) facts.assertions.push(make(node, state, { kind: 'fail-call', library: 'throw', matcher: 'throw' }));
    }
    if (node.type === 'call_expression') {
      const callee = field('function')!;
      const args = argumentsOf(node);
      if (state.handler && callee.type === 'identifier' && includes(HANDLER_FAIL_CALLS, callee.text) && args.length > 0) state.handler.fails = true;
      if (callee.type === 'member_expression' && calleeName(node) === PROMISE_CATCH && args.length > 0 && rootName(callee) !== CYPRESS_ROOT) {
        return tryBlock(node, 'promise-catch', state, callee.childForFieldName('object')!, args);
      }
    }
    if ((node.type === 'call_expression' || node.type === 'member_expression') && isTop(node)) {
      const steps = chainOf(node);
      const found = steps && classify(node, steps, state);
      if (steps && found) {
        facts.assertions.push(...found);
        if (steps[0]!.name === '') walk(steps[0]!.node, state);
        for (const step of steps) for (const argument of step.call ? argumentsOf(step.call) : []) walk(argument, state);
        return;
      }
    }
    for (const child of node.namedChildren) walk(child, state);
  };

  walk(body, { cond: false, other: false, callback: false, handler: null });
  return facts;
}
