// JS/TS expressions as model operands (SPEC.md Section 8.1, `NExpr`): what kind of value an
// expression is, and whether it is a locator, a count or a mock.
import { clipText } from '../../model/build.js';
import type { NExpr } from '../../model/types.js';
import type { SyntaxNode } from '../../parse/treesitter.js';
import { isFunction, memberChain, stringValue, tokensOf } from './syntax.js';
import {
  COUNT_METHODS, COUNT_PROPERTIES, CYPRESS_LOCATORS, CYPRESS_ROOT, LOCATOR_REFINERS, LOCATOR_TYPES, MOCK_CREATORS, PLAYWRIGHT_LOCATORS, WDIO_LOCATORS,
} from './vocab.js';

/** What is known about the names in scope, and which UI frameworks the file uses. */
export interface Env {
  locators: Set<string>;
  counts: Set<string>;
  mocks: Set<string>;
  playwright: boolean;
  webdriverio: boolean;
}

const WRAPPERS = new Set(['await_expression', 'parenthesized_expression', 'non_null_expression', 'as_expression', 'satisfies_expression']);
const LITERALS: Readonly<Record<string, NonNullable<NExpr['literal']>['type']>> = {
  string: 'string', number: 'number', true: 'bool', false: 'bool', null: 'null', undefined: 'null',
};
const includes = (list: readonly string[], value: string | undefined): boolean => value !== undefined && list.includes(value);

/** The expression inside `await x`, `(x)`, `x!` and `x as T`. */
export function unwrap(node: SyntaxNode): SyntaxNode {
  let current = node;
  while (WRAPPERS.has(current.type) && current.namedChildren[0]) current = current.namedChildren[0];
  return current;
}

/** The source of a node on one line, with comments and spare whitespace removed. */
export function normalizedText(node: SyntaxNode): string {
  let text = '';
  for (const token of tokensOf(node)) text += /[\w$]$/.test(text) && /^[\w$]/.test(token) ? ` ${token}` : token;
  return text;
}

/** The name a call is made by: `f` for `f()`, `m` for `a.b.m()`. */
export function calleeName(call: SyntaxNode): string | null {
  const callee = call.childForFieldName('function') ?? call.childForFieldName('constructor');
  if (callee?.type === 'identifier') return callee.text;
  return callee?.type === 'member_expression' ? callee.childForFieldName('property')?.text ?? null : null;
}

/** The identifier a chain starts from: `cy` for `cy.get('a').first()`. */
export function rootName(node: SyntaxNode | null): string | null {
  let current = node;
  while (current) {
    if (current.type === 'identifier' || current.type === 'this') return current.text;
    current = current.type === 'call_expression' ? current.childForFieldName('function')
      : current.type === 'member_expression' ? current.childForFieldName('object')
        : WRAPPERS.has(current.type) ? current.namedChildren[0] ?? null : null;
  }
  return null;
}

export function isLocator(node: SyntaxNode, env: Env): boolean {
  const expr = unwrap(node);
  if (expr.type === 'identifier') return env.locators.has(expr.text);
  if (expr.type !== 'call_expression') return false;
  const callee = expr.childForFieldName('function');
  const name = calleeName(expr) ?? undefined;
  if (includes(WDIO_LOCATORS, name)) return env.webdriverio;
  if (callee?.type !== 'member_expression') return false;
  const object = callee.childForFieldName('object')!;
  if (rootName(object) === CYPRESS_ROOT) return includes(CYPRESS_LOCATORS, name);
  if (includes(PLAYWRIGHT_LOCATORS, name)) return env.playwright;
  return includes(LOCATOR_REFINERS, name) && isLocator(object, env);
}

export function isCount(node: SyntaxNode, env: Env): boolean {
  const expr = unwrap(node);
  if (expr.type === 'identifier') return env.counts.has(expr.text);
  if (expr.type === 'member_expression') return includes(COUNT_PROPERTIES, expr.childForFieldName('property')?.text);
  return expr.type === 'call_expression' && expr.childForFieldName('function')?.type === 'member_expression' && includes(COUNT_METHODS, calleeName(expr) ?? undefined);
}

export function isMock(node: SyntaxNode, env: Env): boolean {
  const expr = unwrap(node);
  if (expr.type === 'call_expression') {
    const chain = memberChain(expr.childForFieldName('function'));
    if (chain && includes(MOCK_CREATORS, [chain.root, ...chain.members].join('.'))) return true;
  }
  const root = rootName(expr);
  return root !== null && env.mocks.has(root);
}

export function toExpr(node: SyntaxNode, env: Env): NExpr {
  const expr = unwrap(node);
  const result: NExpr = { text: clipText(node.text), normalized: normalizedText(node), kind: 'other', isLocator: isLocator(expr, env), isCount: isCount(expr, env), isMock: isMock(expr, env) };
  const items = expr.namedChildren.filter((child) => child.type !== 'comment');
  if (LITERALS[expr.type]) {
    result.kind = 'literal';
    result.literal = { type: LITERALS[expr.type]!, value: stringValue(expr) ?? expr.text };
  } else if (expr.type === 'template_string' && items.every((child) => child.type !== 'template_substitution')) {
    result.kind = 'literal';
    result.literal = { type: 'string', value: stringValue(expr)! };
  } else if (expr.type === 'unary_expression' && items[0]?.type === 'number') {
    result.kind = 'literal';
    result.literal = { type: 'number', value: expr.text.replace(/\s+/g, '') };
  } else if (expr.type === 'array' || expr.type === 'object') {
    result.kind = items.length === 0 ? 'literal' : 'collection';
    if (items.length === 0) result.literal = { type: 'empty-collection', value: expr.text.replace(/\s+/g, '') };
  } else if (expr.type === 'identifier' || expr.type === 'this') result.kind = 'identifier';
  else if (expr.type === 'member_expression' || expr.type === 'subscript_expression') result.kind = 'member';
  else if (expr.type === 'call_expression') result.kind = 'call';
  return result;
}

/**
 * Reads the names declared or assigned under `root` and remembers which hold a locator, a
 * count or a mock: `const rows = page.locator('tr')`, `const n = rows.length`,
 * `let button: Locator`. Subtrees whose node id is in `skip` are left out.
 */
export function learnNames(root: SyntaxNode, env: Env, skip: ReadonlySet<number> = new Set()): void {
  const visit = (node: SyntaxNode): void => {
    if (skip.has(node.id)) return;
    const declared = node.type === 'variable_declarator';
    if (declared || node.type === 'assignment_expression') {
      const name = node.childForFieldName(declared ? 'name' : 'left');
      const value = node.childForFieldName(declared ? 'value' : 'right');
      if (name?.type === 'identifier') {
        const type = node.childForFieldName('type')?.text ?? '';
        if (LOCATOR_TYPES.some((known) => new RegExp(`\\b${known}\\b`).test(type))) env.locators.add(name.text);
        if (value && !isFunction(value)) {
          if (isLocator(value, env)) env.locators.add(name.text);
          if (isCount(value, env)) env.counts.add(name.text);
          if (isMock(value, env)) env.mocks.add(name.text);
        }
      }
    }
    for (const child of node.namedChildren) visit(child);
  };
  visit(root);
}
