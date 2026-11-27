// Java expressions as model operands (SPEC.md Section 8.1, `NExpr`): what kind of value an
// expression is, and whether it is an element, a count or a mock.
import { clipText } from '../../model/build.js';
import type { NExpr } from '../../model/types.js';
import type { SyntaxNode } from '../../parse/treesitter.js';
import { annotationsOf, dottedName, itemsOf, statementsOf, stringValue, tokensOf } from './syntax.js';
import {
  COUNT_FIELDS, COUNT_METHODS, EXPECTED_EXCEPTION_TYPE, LOCATOR_FIELD_ANNOTATIONS, LOCATOR_METHODS, LOCATOR_REFINERS, LOCATOR_TYPES, MOCK_FACTORIES, MOCK_FIELD_ANNOTATIONS, SELENIDE_SELECTORS, SOFT_TYPES,
} from './vocab.js';

/** What is known about the names in scope of one body. Names of fields are kept without `this.`. */
export interface Env {
  locators: Set<string>;
  counts: Set<string>;
  mocks: Set<string>;
  /** Objects that collect soft failures. `own`: made with `new` in this body, so this body has to report them. */
  soft: Map<string, { own: boolean }>;
  /** Fields of the JUnit 4 `ExpectedException` rule. */
  expectedExceptions: Set<string>;
  /** The type a name is declared with, as it is written: `WebDriverWait`, `List<WebElement>`. */
  types: Map<string, string>;
}

export const emptyEnv = (): Env => ({ locators: new Set(), counts: new Set(), mocks: new Set(), soft: new Map(), expectedExceptions: new Set(), types: new Map() });
export const copyEnv = (env: Env): Env => ({ locators: new Set(env.locators), counts: new Set(env.counts), mocks: new Set(env.mocks), soft: new Map(env.soft), expectedExceptions: new Set(env.expectedExceptions), types: new Map(env.types) });

const WRAPPERS = new Set(['parenthesized_expression', 'cast_expression']);
const NUMBERS = new Set(['decimal_integer_literal', 'hex_integer_literal', 'octal_integer_literal', 'binary_integer_literal', 'decimal_floating_point_literal', 'hex_floating_point_literal']);
const includes = (list: readonly string[], value: string | null | undefined): boolean => value != null && list.includes(value);
const lastPart = (name: string): string => name.slice(name.lastIndexOf('.') + 1);

/** The expression inside `(x)` and `(Type) x`. */
export function unwrap(node: SyntaxNode): SyntaxNode {
  let current = node;
  while (WRAPPERS.has(current.type)) {
    const inner = current.type === 'cast_expression' ? current.childForFieldName('value') : current.namedChildren[0];
    if (!inner) break;
    current = inner;
  }
  return current;
}

/** The source of a node on one line, with comments and spare whitespace removed. */
export function normalizedText(node: SyntaxNode): string {
  let text = '';
  for (const token of tokensOf(node)) text += /\w$/.test(text) && /^\w/.test(token) ? ` ${token}` : token;
  return text;
}

/** The value of a whole number literal: `500`, `60_000`, `3000L`. Null for anything else. */
export function intValue(node: SyntaxNode | null | undefined): number | null {
  if (node?.type !== 'decimal_integer_literal') return null;
  const value = Number(node.text.replace(/_/g, '').replace(/[lL]$/, ''));
  return Number.isInteger(value) ? value : null;
}

/** A name as the tables know it: `cart` for `cart` and for `this.cart`. Null for anything that is not a plain name. */
export function nameOf(node: SyntaxNode | null | undefined): string | null {
  const name = dottedName(node && node.type === 'field_access' && node.childForFieldName('object')?.type === 'this' ? node.childForFieldName('field') : node);
  return name ?? null;
}

/** The name an expression starts with: `cart` for `cart.total().add(1)` and for `this.cart.size()`. */
export function rootName(node: SyntaxNode | null | undefined): string | null {
  let current = node ? unwrap(node) : null;
  for (;;) {
    if (!current) return null;
    if (current.type === 'method_invocation' || current.type === 'array_access') {
      const next: SyntaxNode | null = current.childForFieldName(current.type === 'method_invocation' ? 'object' : 'array');
      if (!next) return null;
      current = unwrap(next);
    } else if (current.type === 'field_access' && current.childForFieldName('object')?.type !== 'this') current = unwrap(current.childForFieldName('object')!);
    else return nameOf(current);
  }
}

export function isLocator(node: SyntaxNode, env: Env): boolean {
  const expr = unwrap(node);
  if (expr.type === 'identifier' || expr.type === 'field_access') return env.locators.has(nameOf(expr) ?? '');
  if (expr.type !== 'method_invocation') return false;
  const name = expr.childForFieldName('name')?.text;
  // `driver.findElement(...)`, `page.locator(...)`, and the `$(...)` of Selenide, which gives an element that is never null.
  if (includes(LOCATOR_METHODS, name) || Object.hasOwn(SELENIDE_SELECTORS, name ?? '')) return true;
  const object = expr.childForFieldName('object');
  // `rows.first()`, `page.locator("li").nth(2)`, and `elements.get(0)` on a list of elements.
  return object !== null && (includes(LOCATOR_REFINERS, name) || name === 'get') && isLocator(object, env);
}

export function isCount(node: SyntaxNode, env: Env): boolean {
  const expr = unwrap(node);
  if (expr.type === 'identifier') return env.counts.has(expr.text);
  if (expr.type === 'field_access') return includes(COUNT_FIELDS, expr.childForFieldName('field')?.text);
  // `rows.size()`, `text.length()`, `locator.count()`. With an argument it is another method: `count("apple")`.
  return expr.type === 'method_invocation' && includes(COUNT_METHODS, expr.childForFieldName('name')?.text) && statementsOf(expr.childForFieldName('arguments')).length === 0;
}

/** A call that makes a mock: `mock(Mailer.class)`, `Mockito.spy(cart)`. */
export const createsMock = (node: SyntaxNode): boolean => node.type === 'method_invocation' && includes(MOCK_FACTORIES, node.childForFieldName('name')?.text);

export function isMock(node: SyntaxNode, env: Env): boolean {
  const expr = unwrap(node);
  return createsMock(expr) || env.mocks.has(rootName(expr) ?? '');
}

export function toExpr(node: SyntaxNode, env: Env): NExpr {
  const expr = unwrap(node);
  const result: NExpr = { text: clipText(node.text), normalized: normalizedText(node), kind: 'other', isLocator: isLocator(expr, env), isCount: isCount(expr, env), isMock: isMock(expr, env) };
  const literal = (type: NonNullable<NExpr['literal']>['type'], value: string): void => {
    result.kind = 'literal';
    result.literal = { type, value };
  };
  if (NUMBERS.has(expr.type)) literal('number', expr.text);
  else if (expr.type === 'unary_expression' && NUMBERS.has(expr.namedChildren[0]?.type ?? '')) literal('number', expr.text.replace(/\s+/g, ''));
  else if (expr.type === 'true' || expr.type === 'false') literal('bool', expr.text);
  else if (expr.type === 'null_literal') literal('null', expr.text);
  else if (expr.type === 'string_literal' || expr.type === 'character_literal') literal('string', stringValue(expr) ?? expr.text.slice(1, -1));
  else if (expr.type === 'array_initializer' || expr.type === 'array_creation_expression') {
    const items = itemsOf(expr.type === 'array_initializer' ? expr : expr.childForFieldName('value'));
    if (expr.type === 'array_creation_expression' && !expr.childForFieldName('value')) result.kind = 'call';
    else if (items.length === 0) literal('empty-collection', '{}');
    else result.kind = 'collection';
  } else if (expr.type === 'identifier') result.kind = 'identifier';
  else if (expr.type === 'field_access' || expr.type === 'array_access') result.kind = 'member';
  else if (expr.type === 'method_invocation' || expr.type === 'object_creation_expression') result.kind = 'call';
  return result;
}

/**
 * Reads the names declared under `root` and remembers which hold an element, a count, a mock, a
 * soft assertion object or the expected exception rule: `WebElement error = ...`,
 * `int n = rows.size()`, `@Mock Mailer mailer`, `Mailer mailer = mock(Mailer.class)`,
 * `SoftAssertions softly = new SoftAssertions()`.
 */
export function learnNames(root: SyntaxNode, env: Env): void {
  const learn = (name: string | null | undefined, type: string, value: SyntaxNode | null | undefined, marks: readonly string[], local: boolean): void => {
    if (!name) return;
    if (type !== '') env.types.set(name, type);
    // `WebElement`, `List<WebElement>`, `Locator`. Not `Locator.FilterOptions`, which is a class inside it.
    if (LOCATOR_TYPES.some((known) => new RegExp(`\\b${known}\\b(?!\\.)`).test(type)) || marks.some((mark) => includes(LOCATOR_FIELD_ANNOTATIONS, mark))) env.locators.add(name);
    if (marks.some((mark) => includes(MOCK_FIELD_ANNOTATIONS, mark))) env.mocks.add(name);
    if (includes(SOFT_TYPES, lastPart(type))) env.soft.set(name, { own: local && value?.type === 'object_creation_expression' });
    if (lastPart(type) === EXPECTED_EXCEPTION_TYPE) env.expectedExceptions.add(name);
    if (!value || value.type === 'lambda_expression') return;
    if (isLocator(value, env)) env.locators.add(name);
    if (isCount(value, env)) env.counts.add(name);
    if (createsMock(unwrap(value))) env.mocks.add(name);
  };
  const visit = (node: SyntaxNode): void => {
    if (node.type === 'local_variable_declaration' || node.type === 'field_declaration') {
      const type = node.childForFieldName('type')?.text ?? '';
      const marks = annotationsOf(node).map((mark) => lastPart(dottedName(mark.childForFieldName('name')) ?? ''));
      for (const declarator of node.namedChildren.filter((child) => child.type === 'variable_declarator')) {
        learn(declarator.childForFieldName('name')?.text, type, declarator.childForFieldName('value'), marks, node.type === 'local_variable_declaration');
      }
    } else if (node.type === 'formal_parameter' || node.type === 'resource') {
      learn(node.childForFieldName('name')?.text, node.childForFieldName('type')?.text ?? '', node.type === 'resource' ? node.childForFieldName('value') : undefined, annotationsOf(node).map((mark) => lastPart(dottedName(mark.childForFieldName('name')) ?? '')), false);
    } else if (node.type === 'assignment_expression') {
      learn(nameOf(node.childForFieldName('left')), '', node.childForFieldName('right'), [], false);
    }
    for (const child of node.namedChildren) visit(child);
  };
  visit(root);
}
