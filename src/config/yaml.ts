// Safe YAML parsing for config files (SPEC.md Section 12.1).
//
// Loading a config must never run code. The file is parsed with the YAML core schema: plain
// data only. Anchors and aliases are allowed. Any tag outside the core schema is an error, and
// so is a file with more than one document.
import { isNode, parseAllDocuments, visit } from 'yaml';

/** The tags of plain data. Anything else (`!!binary`, `!!set`, `!custom`, ...) is refused. */
const PLAIN_TAGS = new Set(['map', 'seq', 'str', 'null', 'bool', 'int', 'float'].map((name) => `tag:yaml.org,2002:${name}`));

/** Parses YAML text into plain data. Throws an Error with a one-line message when it cannot. */
export function parseYaml(text: string): unknown {
  const documents = parseAllDocuments(text, { schema: 'core', version: '1.2', uniqueKeys: true, prettyErrors: true });
  if (documents.length > 1) throw new Error('the file holds more than one YAML document');
  const document = documents[0];
  if (!document) return null;

  const first = document.errors[0];
  if (first) {
    const position = first.linePos?.[0];
    const where = position ? ` at line ${position.line}, column ${position.col}` : '';
    // The library adds a code frame after the first line. Keep the sentence only.
    const sentence = first.message.split('\n')[0]!.replace(/ at line \d+, column \d+:?$/, '');
    throw new Error(`${sentence}${where}`);
  }

  // The parser only warns about a tag it does not know and then treats the value as plain data.
  // For a config file that is an error: nothing but plain data is accepted.
  let tag: string | null = null;
  visit(document, {
    Node(_key, node) {
      if (tag === null && isNode(node) && node.tag && !PLAIN_TAGS.has(node.tag)) tag = node.tag;
    },
  });
  const warning = document.warnings.find((item) => item.code === 'TAG_RESOLVE_FAILED');
  if (tag === null && warning) tag = warning.message.split('\n')[0]!.replace(/^Unresolved tag: /, '').replace(/ at line \d+, column \d+:?$/, '');
  if (tag !== null) throw new Error(`custom YAML tags are not allowed: ${tag.replace('tag:yaml.org,2002:', '!!')}`);

  return document.toJS({ maxAliasCount: 100 });
}
