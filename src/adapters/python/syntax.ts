// Helpers for reading Python syntax trees. Node type names are those of the tree-sitter Python
// grammar.
import type { SyntaxNode } from '../../parse/treesitter.js';

const ESCAPES: Readonly<Record<string, string>> = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', a: '\x07', 0: '\0', '\n': '' };

function unescape(text: string): string {
  return text.replace(/\\(u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8}|x[0-9a-fA-F]{2}|[\s\S])/g, (all, body: string) => {
    if (body.length > 1) {
      const code = parseInt(body.slice(1), 16);
      return code <= 0x10ffff ? String.fromCodePoint(code) : all;
    }
    // An escape Python does not know keeps its backslash.
    return ESCAPES[body] ?? (/['"\\]/.test(body) ? body : all);
  });
}

/**
 * The value of a string literal. Strings written next to each other are joined. An f-string
 * keeps its `{...}` parts as written. Null for any other node.
 */
export function stringValue(node: SyntaxNode | null | undefined): string | null {
  if (node?.type === 'concatenated_string') {
    const parts = node.namedChildren.filter((part) => part.type !== 'comment').map((part) => stringValue(part));
    return parts.every((part): part is string => part !== null) ? parts.join('') : null;
  }
  if (node?.type !== 'string') return null;
  const start = node.namedChildren.find((child) => child.type === 'string_start');
  const end = node.namedChildren.find((child) => child.type === 'string_end');
  if (!start) return null;
  const content = node.text.slice(start.text.length, node.text.length - (end?.text.length ?? 0));
  return /r/i.test(start.text.replace(/['"]/g, '')) ? content : unescape(content);
}

/** `pytest.mark.skip` for an attribute chain, `skip` for a name. Null for anything else (a call result, `a[b].c`). */
export function dottedName(node: SyntaxNode | null | undefined): string | null {
  const parts: string[] = [];
  let current = node ?? null;
  while (current?.type === 'attribute') {
    const attribute = current.childForFieldName('attribute');
    if (attribute?.type !== 'identifier') return null;
    parts.unshift(attribute.text);
    current = current.childForFieldName('object');
  }
  if (current?.type !== 'identifier') return null;
  return [current.text, ...parts].join('.');
}

/** A name with its first part replaced by what the imports say it is: `mark.skip` gives `pytest.mark.skip`. */
export function qualify(name: string | null, aliases: ReadonlyMap<string, string>): string | null {
  if (name === null) return null;
  const dot = name.indexOf('.');
  const root = dot < 0 ? name : name.slice(0, dot);
  const known = aliases.get(root);
  return known === undefined ? name : `${known}${dot < 0 ? '' : name.slice(dot)}`;
}

export interface CallArguments {
  positional: SyntaxNode[];
  keywords: Map<string, SyntaxNode>;
}

/** The arguments of a call: those given by position, and those given by name. `*args` and `**kwargs` are left out. */
export function argumentsOf(call: SyntaxNode | null | undefined): CallArguments {
  const result: CallArguments = { positional: [], keywords: new Map() };
  const list = call?.childForFieldName('arguments');
  for (const argument of list?.type === 'argument_list' ? list.namedChildren : []) {
    if (argument.type === 'keyword_argument') {
      const name = argument.childForFieldName('name');
      const value = argument.childForFieldName('value');
      if (name && value) result.keywords.set(name.text, value);
    } else if (argument.type !== 'comment' && argument.type !== 'list_splat' && argument.type !== 'dictionary_splat') result.positional.push(argument);
  }
  return result;
}

/** The statements of a block, without comments. */
export const statementsOf = (block: SyntaxNode | null | undefined): SyntaxNode[] => (block ? block.namedChildren.filter((node) => node.type !== 'comment') : []);

const isStringStatement = (node: SyntaxNode | undefined): boolean =>
  node?.type === 'expression_statement' && node.namedChildCount === 1 && ['string', 'concatenated_string'].includes(node.namedChildren[0]!.type);

/** The docstring of a function, class or module body: a string as its first statement. */
export function docstringOf(block: SyntaxNode | null | undefined): SyntaxNode | null {
  const first = statementsOf(block)[0];
  return isStringStatement(first) ? first! : null;
}

/** `pass` and `...` do nothing: a body made of them is an empty body. */
export const isPlaceholder = (statement: SyntaxNode): boolean =>
  statement.type === 'pass_statement' || (statement.type === 'expression_statement' && statement.namedChildCount === 1 && statement.namedChildren[0]!.type === 'ellipsis');

/**
 * The tokens of a body in order, without comments and without the node `skip` (its docstring).
 * Python shows nesting by indentation, which is not a token, so the start and the end of each
 * block are added as "{" and "}": two bodies that differ only in what is inside a branch do
 * not get the same tokens.
 */
export function tokensOf(node: SyntaxNode, skip: SyntaxNode | null = null): string[] {
  const tokens: string[] = [];
  const walk = (current: SyntaxNode): void => {
    if (current.type === 'comment' || (skip !== null && current.id === skip.id)) return;
    if (current.childCount === 0) {
      if (current.text !== '') tokens.push(current.text);
      return;
    }
    const block = current.type === 'block' && current.id !== node.id;
    if (block) tokens.push('{');
    for (const child of current.children) walk(child);
    if (block) tokens.push('}');
  };
  walk(node);
  return tokens;
}

/** True when a node of one of the given types sits between `node` and `stop` (not including `stop`). */
export function hasAncestor(node: SyntaxNode, types: ReadonlySet<string>, stop: SyntaxNode): boolean {
  for (let parent = node.parent; parent && parent.id !== stop.id; parent = parent.parent) {
    if (types.has(parent.type)) return true;
  }
  return false;
}

const SCOPES = new Set(['function_definition', 'class_definition', 'lambda']);

/** Every node of the given types inside `body`, not counting what sits in a nested function, class or lambda. */
export function ownDescendants(body: SyntaxNode, types: ReadonlySet<string>): SyntaxNode[] {
  const found: SyntaxNode[] = [];
  const walk = (node: SyntaxNode): void => {
    for (const child of node.namedChildren) {
      if (types.has(child.type)) found.push(child);
      if (!SCOPES.has(child.type)) walk(child);
    }
  };
  walk(body);
  return found;
}
