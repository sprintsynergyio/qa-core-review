// Helpers for reading JS/TS syntax trees. Node type names are those of the tree-sitter
// JavaScript and TypeScript grammars, which share them for everything used here.
import type { SyntaxNode } from '../../parse/treesitter.js';

const FUNCTION_TYPES = new Set(['arrow_function', 'function_expression', 'function', 'generator_function']);
const ESCAPES: Readonly<Record<string, string>> = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', 0: '\0' };

export function isFunction(node: SyntaxNode | null | undefined): boolean {
  return node != null && FUNCTION_TYPES.has(node.type);
}

function unescape(sequence: string): string {
  const body = sequence.slice(1);
  if (/^(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2})$/.test(body)) return String.fromCodePoint(parseInt(body.replace(/[ux{}]/g, ''), 16));
  return ESCAPES[body] ?? body;
}

/**
 * The value of a string literal, or the raw content of a template literal (`${...}` kept as
 * written). Null for any other node.
 */
export function stringValue(node: SyntaxNode | null): string | null {
  if (node?.type === 'template_string') return node.text.slice(1, -1);
  if (node?.type !== 'string') return null;
  return node.namedChildren.map((part) => (part.type === 'escape_sequence' ? unescape(part.text) : part.text)).join('');
}

/** The arguments of a call, without comments. Empty for a tagged template. */
export function argumentsOf(call: SyntaxNode): SyntaxNode[] {
  const list = call.childForFieldName('arguments');
  return list?.type === 'arguments' ? list.namedChildren.filter((node) => node.type !== 'comment') : [];
}

/**
 * A callee as a dotted chain: `test.describe.only` gives root 'test' and members
 * ['describe', 'only']. Null when the callee is anything else (a call result, `a[b]`, ...).
 * `this` is a valid root, for Mocha's `this.skip()`.
 */
export function memberChain(callee: SyntaxNode | null): { root: string; members: string[] } | null {
  const members: string[] = [];
  let node = callee;
  while (node?.type === 'member_expression') {
    const property = node.childForFieldName('property');
    if (property?.type !== 'property_identifier') return null;
    members.unshift(property.text);
    node = node.childForFieldName('object');
  }
  return node?.type === 'identifier' || node?.type === 'this' ? { root: node.text, members } : null;
}

/** The tokens of a subtree in order, without comments. Whitespace is not a token. */
export function tokensOf(node: SyntaxNode): string[] {
  const tokens: string[] = [];
  const cursor = node.walk();
  let depth = 0;
  try {
    for (;;) {
      if (cursor.nodeType !== 'comment') {
        if (cursor.gotoFirstChild()) {
          depth += 1;
          continue;
        }
        tokens.push(cursor.nodeText);
      }
      while (!cursor.gotoNextSibling()) {
        if (depth === 0 || !cursor.gotoParent()) return tokens;
        depth -= 1;
        if (depth === 0) return tokens;
      }
    }
  } finally {
    cursor.delete();
  }
}

/** True when a node of one of the given types sits between `node` and `stop` (not including `stop`). */
export function hasAncestor(node: SyntaxNode, types: ReadonlySet<string>, stop: SyntaxNode): boolean {
  for (let parent = node.parent; parent && parent.id !== stop.id; parent = parent.parent) {
    if (types.has(parent.type)) return true;
  }
  return false;
}
