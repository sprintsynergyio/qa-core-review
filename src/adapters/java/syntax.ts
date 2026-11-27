// Java: small readers for syntax tree nodes, shared by the parts of the adapter.
import type { SyntaxNode } from '../../parse/treesitter.js';

const COMMENTS = new Set(['line_comment', 'block_comment']);
export const isComment = (node: SyntaxNode): boolean => COMMENTS.has(node.type);

const ESCAPES: Readonly<Record<string, string>> = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', s: ' ', '0': '\0', '"': '"', "'": "'", '\\': '\\' };
const decode = (escape: string): string => {
  const unicode = /^\\u+([0-9a-fA-F]{4})$/.exec(escape);
  if (unicode) return String.fromCharCode(parseInt(unicode[1]!, 16));
  return ESCAPES[escape[1]!] ?? escape;
};

/**
 * The value of a string literal, with its escapes decoded. Literals joined with `+` are
 * joined, and a text block keeps its lines. Null for anything that is not written out.
 */
export function stringValue(node: SyntaxNode | null | undefined): string | null {
  if (!node) return null;
  if (node.type === 'parenthesized_expression') return stringValue(node.namedChildren[0]);
  if (node.type === 'binary_expression' && node.childForFieldName('operator')?.type === '+') {
    const [left, right] = [stringValue(node.childForFieldName('left')), stringValue(node.childForFieldName('right'))];
    return left === null || right === null ? null : left + right;
  }
  if (node.type !== 'string_literal') return null;
  return node.namedChildren.map((part) => (part.type === 'escape_sequence' ? decode(part.text) : part.text)).join('');
}

/** `org.junit.Test` for a name with dots, `Test` for a plain one. Null for anything else (a call result, `a[0].b`). */
export function dottedName(node: SyntaxNode | null | undefined): string | null {
  if (!node) return null;
  if (node.type === 'identifier' || node.type === 'type_identifier') return node.text;
  if (node.type === 'scoped_identifier' || node.type === 'scoped_type_identifier') {
    const scope = dottedName(node.childForFieldName('scope') ?? node.namedChildren[0]);
    const name = node.childForFieldName('name') ?? node.namedChildren.at(-1);
    return scope === null || !name ? null : `${scope}.${name.text}`;
  }
  if (node.type === 'field_access') {
    const object = dottedName(node.childForFieldName('object'));
    const field = node.childForFieldName('field');
    return object === null || !field ? null : `${object}.${field.text}`;
  }
  if (node.type === 'generic_type') return dottedName(node.namedChildren[0]);
  return null;
}

/** The annotations written on a class, a method or a field, in source order. */
export function annotationsOf(declaration: SyntaxNode): SyntaxNode[] {
  const modifiers = declaration.namedChildren.find((child) => child.type === 'modifiers');
  return modifiers ? modifiers.namedChildren.filter((child) => child.type === 'annotation' || child.type === 'marker_annotation') : [];
}

/** True when a declaration has this keyword among its modifiers: `public`, `static`, `abstract`. */
export function hasModifier(declaration: SyntaxNode, keyword: string): boolean {
  const modifiers = declaration.namedChildren.find((child) => child.type === 'modifiers');
  return modifiers !== undefined && modifiers.children.some((child) => child !== null && child.type === keyword);
}

/** The elements of an annotation by name. A single value with no name is `value`, as in Java. */
export function elementsOf(annotation: SyntaxNode): Map<string, SyntaxNode> {
  const elements = new Map<string, SyntaxNode>();
  for (const part of annotation.childForFieldName('arguments')?.namedChildren ?? []) {
    if (isComment(part)) continue;
    if (part.type !== 'element_value_pair') elements.set('value', part);
    else {
      const [key, value] = [part.childForFieldName('key'), part.childForFieldName('value')];
      if (key && value) elements.set(key.text, value);
    }
  }
  return elements;
}

/** The items of `{ a, b }` in an annotation or an array, or the one value when there are no braces. */
export function itemsOf(value: SyntaxNode | null | undefined): SyntaxNode[] {
  if (!value) return [];
  return value.type === 'element_value_array_initializer' || value.type === 'array_initializer' ? value.namedChildren.filter((item) => !isComment(item)) : [value];
}

/** The statements of a block, without comments. */
export const statementsOf = (block: SyntaxNode | null | undefined): SyntaxNode[] => (block ? block.namedChildren.filter((node) => !isComment(node)) : []);

/** The tokens of a body in order, without comments. Braces are tokens in Java, so nesting is part of the stream. */
export function tokensOf(node: SyntaxNode): string[] {
  const tokens: string[] = [];
  const visit = (current: SyntaxNode): void => {
    if (isComment(current)) return;
    // A string is one token, whatever is inside it.
    if (current.childCount === 0 || current.type === 'string_literal' || current.type === 'character_literal') {
      if (current.text !== '') tokens.push(current.text);
      return;
    }
    for (const child of current.children) if (child) visit(child);
  };
  visit(node);
  return tokens;
}

/** True when a node of one of the given types sits between `node` and `stop` (not including `stop`). */
export function hasAncestor(node: SyntaxNode, types: ReadonlySet<string>, stop: SyntaxNode): boolean {
  for (let parent = node.parent; parent && parent.id !== stop.id; parent = parent.parent) {
    if (types.has(parent.type)) return true;
  }
  return false;
}

const OWN_SCOPES = new Set(['lambda_expression', 'class_body', 'class_declaration']);

/** Every node of the given types inside `body`, not counting what sits in a lambda or in a class declared there. */
export function ownDescendants(body: SyntaxNode, types: ReadonlySet<string>): SyntaxNode[] {
  const found: SyntaxNode[] = [];
  const visit = (node: SyntaxNode): void => {
    for (const child of node.namedChildren) {
      if (types.has(child.type)) found.push(child);
      if (!OWN_SCOPES.has(child.type)) visit(child);
    }
  };
  visit(body);
  return found;
}
