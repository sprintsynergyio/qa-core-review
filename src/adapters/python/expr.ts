// Python expressions as model operands (SPEC.md Section 8.1, `NExpr`): what kind of value an
// expression is, and whether it is a locator, a count or a mock.
import { clipText } from '../../model/build.js';
import type { NExpr } from '../../model/types.js';
import type { SyntaxNode } from '../../parse/treesitter.js';
import { argumentsOf, dottedName, qualify, stringValue, tokensOf } from './syntax.js';
import {
  COUNT_ATTRIBUTES, COUNT_FUNCTIONS, COUNT_METHODS, LOCATOR_REFINERS, LOCATOR_TYPES, MOCKER_FACTORIES, MOCKER_FIXTURE, MOCK_FACTORIES, MOCK_MODULES, MOCK_PARAMETER,
  PLAYWRIGHT_LOCATORS, SELENIUM_LOCATORS, SELENIUM_OLD_LOCATOR_PREFIX,
} from './vocab.js';

/** What is known about the names in scope of one body. */
export interface Env {
  locators: Set<string>;
  counts: Set<string>;
  /** Names and attribute paths that hold a mock: `send`, `self.mailer`. */
  mocks: Set<string>;
  /** What each imported name stands for. */
  aliases: ReadonlyMap<string, string>;
}

const WRAPPERS = new Set(['parenthesized_expression', 'await']);
const LITERALS: Readonly<Record<string, NonNullable<NExpr['literal']>['type']>> = { integer: 'number', float: 'number', true: 'bool', false: 'bool', none: 'null' };
const COLLECTIONS = new Set(['list', 'tuple', 'dictionary', 'set']);
const includes = (list: readonly string[], value: string | null | undefined): boolean => value != null && list.includes(value);
/** `unittest.mock.patch`, `mock.MagicMock`, `mocker.patch.object`: every call that makes a mock. */
const MOCK_CREATORS = new Set([...MOCK_MODULES.flatMap((module) => MOCK_FACTORIES.map((name) => `${module}.${name}`)), ...MOCKER_FACTORIES.map((name) => `${MOCKER_FIXTURE}.${name}`)]);

/** The expression inside `(x)` and `await x`. */
export function unwrap(node: SyntaxNode): SyntaxNode {
  let current = node;
  while (WRAPPERS.has(current.type) && current.namedChildCount === 1) current = current.namedChildren[0]!;
  return current;
}

/** The source of a node on one line, with comments and spare whitespace removed. */
export function normalizedText(node: SyntaxNode): string {
  let text = '';
  for (const token of tokensOf(node)) text += /\w$/.test(text) && /^\w/.test(token) ? ` ${token}` : token;
  return text;
}

/** The name a call is made by: `f` for `f()`, `m` for `a.b.m()`. */
export function calleeName(call: SyntaxNode): string | null {
  const callee = call.childForFieldName('function');
  if (callee?.type === 'identifier') return callee.text;
  return callee?.type === 'attribute' ? callee.childForFieldName('attribute')?.text ?? null : null;
}

/** The value of a number literal: `500`, `60_000`, `2.5`. Null for anything else. */
export function numberValue(node: SyntaxNode | null | undefined): number | null {
  if (node?.type !== 'integer' && node?.type !== 'float') return null;
  const value = Number(node.text.replace(/_/g, ''));
  return Number.isNaN(value) ? null : value;
}

/**
 * The names an expression starts with, shortest first: `self`, `self.mailer`, `self.mailer.send`
 * for `self.mailer.send.assert_called()`. Calls and subscripts on the way are passed through.
 */
export function pathsOf(node: SyntaxNode | null): string[] {
  let current = node ? unwrap(node) : null;
  while (current && (current.type === 'call' || current.type === 'subscript' || (current.type === 'attribute' && dottedName(current) === null))) {
    current = current.childForFieldName(current.type === 'call' ? 'function' : current.type === 'subscript' ? 'value' : 'object');
    current = current ? unwrap(current) : null;
  }
  const parts = dottedName(current)?.split('.') ?? [];
  return parts.map((_, index) => parts.slice(0, index + 1).join('.'));
}

export function isLocator(node: SyntaxNode, env: Env): boolean {
  const expr = unwrap(node);
  if (expr.type === 'identifier') return env.locators.has(expr.text);
  if (expr.type === 'attribute') {
    // `page.locator("li").first`
    return includes(LOCATOR_REFINERS, expr.childForFieldName('attribute')?.text) && isLocator(expr.childForFieldName('object')!, env);
  }
  if (expr.type !== 'call') return false;
  const callee = expr.childForFieldName('function');
  if (callee?.type !== 'attribute') return false;
  const name = calleeName(expr) ?? '';
  if (includes(PLAYWRIGHT_LOCATORS, name) || includes(SELENIUM_LOCATORS, name) || name.startsWith(SELENIUM_OLD_LOCATOR_PREFIX)) return true;
  return includes(LOCATOR_REFINERS, name) && isLocator(callee.childForFieldName('object')!, env);
}

export function isCount(node: SyntaxNode, env: Env): boolean {
  const expr = unwrap(node);
  if (expr.type === 'identifier') return env.counts.has(expr.text);
  if (expr.type === 'attribute') return includes(COUNT_ATTRIBUTES, expr.childForFieldName('attribute')?.text);
  if (expr.type !== 'call') return false;
  const callee = expr.childForFieldName('function');
  return callee?.type === 'identifier' ? includes(COUNT_FUNCTIONS, callee.text) : includes(COUNT_METHODS, calleeName(expr));
}

/** A call that makes a mock: `MagicMock()`, `patch("shop.mail.send")`, `mocker.patch.object(...)`. */
export const createsMock = (node: SyntaxNode, env: Env): boolean => node.type === 'call' && MOCK_CREATORS.has(qualify(dottedName(node.childForFieldName('function')), env.aliases) ?? '');

export function isMock(node: SyntaxNode, env: Env): boolean {
  const expr = unwrap(node);
  return createsMock(expr, env) || pathsOf(expr).some((path) => env.mocks.has(path));
}

export function toExpr(node: SyntaxNode, env: Env): NExpr {
  const expr = unwrap(node);
  const result: NExpr = { text: clipText(node.text), normalized: normalizedText(node), kind: 'other', isLocator: isLocator(expr, env), isCount: isCount(expr, env), isMock: isMock(expr, env) };
  const items = expr.namedChildren.filter((child) => child.type !== 'comment');
  if (LITERALS[expr.type]) {
    result.kind = 'literal';
    result.literal = { type: LITERALS[expr.type]!, value: expr.text };
  } else if ((expr.type === 'string' || expr.type === 'concatenated_string') && expr.descendantsOfType('interpolation').length === 0) {
    result.kind = 'literal';
    result.literal = { type: 'string', value: stringValue(expr) ?? expr.text };
  } else if (expr.type === 'unary_operator' && numberValue(items[0]) !== null) {
    result.kind = 'literal';
    result.literal = { type: 'number', value: expr.text.replace(/\s+/g, '') };
  } else if (COLLECTIONS.has(expr.type)) {
    result.kind = items.length === 0 ? 'literal' : 'collection';
    if (items.length === 0) result.literal = { type: 'empty-collection', value: expr.text.replace(/\s+/g, '') };
  } else if (expr.type === 'identifier') result.kind = 'identifier';
  else if (expr.type === 'attribute' || expr.type === 'subscript') result.kind = 'member';
  else if (expr.type === 'call') result.kind = 'call';
  return result;
}

/**
 * Reads the names assigned under `root` and remembers which hold a locator, a count or a mock:
 * `rows = page.locator("tr")`, `n = len(rows)`, `self.mailer = Mock()`, `with patch(...) as send`,
 * `button: Locator`, and the parameters that `@patch` decorators or a mock-like name fill in.
 * Subtrees whose node id is in `skip` are left out.
 */
export function learnNames(root: SyntaxNode, env: Env, skip: ReadonlySet<number> = new Set()): void {
  const learn = (target: SyntaxNode | null | undefined, value: SyntaxNode | null | undefined, type: string): void => {
    const name = target?.type === 'identifier' ? target.text : dottedName(target);
    if (!name) return;
    if (LOCATOR_TYPES.some((known) => new RegExp(`\\b${known}\\b`).test(type))) env.locators.add(name);
    if (!value || value.type === 'lambda') return;
    if (isLocator(value, env)) env.locators.add(name);
    if (isCount(value, env)) env.counts.add(name);
    if (isMock(value, env)) env.mocks.add(name);
  };
  const visit = (node: SyntaxNode): void => {
    if (skip.has(node.id)) return;
    if (node.type === 'assignment') learn(node.childForFieldName('left'), node.childForFieldName('right'), node.childForFieldName('type')?.text ?? '');
    else if (node.type === 'as_pattern') learn(node.childForFieldName('alias')?.namedChildren[0], node.namedChildren[0], '');
    else if (node.type === 'function_definition') {
      const names = (node.childForFieldName('parameters')?.namedChildren ?? []).flatMap((parameter) => {
        const name = parameter.type === 'identifier' ? parameter : parameter.namedChildren.find((child) => child.type === 'identifier');
        if (name && parameter.type === 'typed_parameter') learn(name, null, parameter.childForFieldName('type')?.text ?? '');
        return name && parameter.type !== 'list_splat_pattern' && parameter.type !== 'dictionary_splat_pattern' ? [name.text] : [];
      }).filter((name) => name !== 'self' && name !== 'cls');
      // Each `@patch(...)` decorator hands the function one mock: the lowest decorator fills the first parameter.
      const decorators = node.parent?.type === 'decorated_definition' ? node.parent.namedChildren.filter((child) => child.type === 'decorator') : [];
      const patches = decorators.filter((decorator) => decorator.namedChildren[0] && createsMock(decorator.namedChildren[0], env) && !argumentsOf(decorator.namedChildren[0]).keywords.has('new')).length;
      names.forEach((name, index) => {
        if (index < patches || MOCK_PARAMETER.test(name)) env.mocks.add(name);
      });
    }
    for (const child of node.namedChildren) visit(child);
  };
  visit(root);
}
