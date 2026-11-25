// A minimal XML reader and a structural check against an XSD, for tests only (SPEC.md Section
// 11.7). It reads what the JUnit report and the JUnit XSD use: a declaration, comments,
// elements, attributes, text and CDATA. It is not a full XML parser and not a full XSD
// validator: it checks which elements, attributes and text each element may hold, which
// attributes are required, and the patterns of simple types. It does not check the order or
// the number of child elements.

const NAME = /[A-Za-z_][\w.:-]*/y;
const INVALID = /[^\t\n\r -퟿-�\u{10000}-\u{10FFFF}]/u;
const ENTITIES = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

function decode(raw, where) {
  if (raw.includes('<')) throw new Error(`"<" in ${where}`);
  return raw.replace(/&([^;&\s]*);?/g, (all, body) => {
    if (!all.endsWith(';')) throw new Error(`"&" that starts no reference in ${where}`);
    if (body in ENTITIES) return ENTITIES[body];
    const code = /^#x[0-9a-fA-F]+$/.test(body) ? Number.parseInt(body.slice(2), 16) : /^#[0-9]+$/.test(body) ? Number(body.slice(1)) : NaN;
    if (Number.isNaN(code) || INVALID.test(String.fromCodePoint(code))) throw new Error(`bad reference &${body}; in ${where}`);
    return String.fromCodePoint(code);
  });
}

/** Reads a document. Returns its root element: { name, attributes, children, text }. Throws on text that is not well formed. */
export function parseXml(source) {
  const bad = INVALID.exec(source);
  if (bad) throw new Error(`a character that XML 1.0 does not allow: U+${bad[0].codePointAt(0).toString(16).toUpperCase()}`);
  let at = 0;
  const fail = (message) => {
    throw new Error(`${message} at offset ${at}`);
  };
  const skipSpace = () => {
    while (/\s/.test(source[at] ?? '')) at += 1;
  };
  const skipMisc = () => {
    for (;;) {
      skipSpace();
      const close = source.startsWith('<?', at) ? '?>' : source.startsWith('<!--', at) ? '-->' : null;
      if (close === null) return;
      const end = source.indexOf(close, at);
      if (end < 0) fail('unclosed declaration or comment');
      at = end + close.length;
    }
  };
  const name = () => {
    NAME.lastIndex = at;
    const found = NAME.exec(source);
    if (!found) fail('a name was expected');
    at = NAME.lastIndex;
    return found[0];
  };
  const element = () => {
    if (source[at] !== '<') fail('"<" was expected');
    at += 1;
    const node = { name: name(), attributes: {}, children: [], text: '' };
    for (;;) {
      const before = at;
      skipSpace();
      if (source.startsWith('/>', at)) {
        at += 2;
        return node;
      }
      if (source[at] === '>') {
        at += 1;
        break;
      }
      if (at === before) fail('a space was expected before an attribute');
      const key = name();
      skipSpace();
      if (source[at] !== '=') fail(`"=" was expected after ${key}`);
      at += 1;
      skipSpace();
      const quote = source[at];
      if (quote !== '"' && quote !== "'") fail(`a quoted value was expected for ${key}`);
      const end = source.indexOf(quote, at + 1);
      if (end < 0) fail(`unclosed value of ${key}`);
      if (key in node.attributes) fail(`attribute ${key} is given twice`);
      node.attributes[key] = decode(source.slice(at + 1, end), `attribute ${key} of <${node.name}>`);
      at = end + 1;
    }
    for (;;) {
      const next = source.indexOf('<', at);
      if (next < 0) fail(`<${node.name}> is not closed`);
      node.text += decode(source.slice(at, next), `text of <${node.name}>`);
      at = next;
      if (source.startsWith('<![CDATA[', at)) {
        const end = source.indexOf(']]>', at);
        if (end < 0) fail('unclosed CDATA');
        node.text += source.slice(at + 9, end);
        at = end + 3;
      } else if (source.startsWith('<!--', at)) {
        const end = source.indexOf('-->', at);
        if (end < 0) fail('unclosed comment');
        at = end + 3;
      } else if (source.startsWith('</', at)) {
        at += 2;
        const closing = name();
        if (closing !== node.name) fail(`</${closing}> closes <${node.name}>`);
        skipSpace();
        if (source[at] !== '>') fail('">" was expected');
        at += 1;
        return node;
      } else node.children.push(element());
    }
  };
  skipMisc();
  const root = element();
  skipMisc();
  if (at < source.length) fail('text after the root element');
  return root;
}

const descendants = (node, name) => node.children.flatMap((child) => [...(child.name === name ? [child] : []), ...descendants(child, name)]);

/**
 * Reads an XSD into a table: for each element name, the attributes it may have (with `required`
 * and a `pattern` when the type has one), the child elements it may hold, and whether it may
 * hold text.
 */
export function readXsd(xsdText) {
  const schema = parseXml(xsdText);
  const top = (name) => schema.children.filter((child) => child.name === name);
  const patterns = new Map(top('xs:simpleType').map((type) => [type.attributes.name, new RegExp(`^(?:${descendants(type, 'xs:pattern')[0].attributes.value})$`)]));
  const named = new Map(top('xs:complexType').map((type) => [type.attributes.name, type]));
  const elements = new Map();
  const shape = (type) => ({
    attributes: new Map(type.children.filter((child) => child.name === 'xs:attribute').map((attribute) => [attribute.attributes.name, {
      required: attribute.attributes.use === 'required', pattern: patterns.get(attribute.attributes.type) ?? null,
    }])),
    children: new Set(descendants(type, 'xs:element').map((child) => child.attributes.ref ?? child.attributes.name)),
    text: type.attributes.mixed === 'true',
  });
  const declare = (element) => {
    const { name, type } = element.attributes;
    const inline = element.children.find((child) => child.name === 'xs:complexType');
    if (inline) elements.set(name, shape(inline));
    else if (named.has(type)) elements.set(name, shape(named.get(type)));
    else elements.set(name, { attributes: new Map(), children: new Set(), text: true }); // xs:string
  };
  for (const element of top('xs:element')) declare(element);
  // Elements that a named type declares in place, such as <stackTrace>.
  for (const type of named.values()) for (const local of descendants(type, 'xs:element').filter((child) => child.attributes.name)) declare(local);
  return elements;
}

/**
 * The problems of a document against the table of readXsd, as short lines. Empty when it fits.
 * `extra` names attributes that the XSD does not have and the document may use all the same,
 * per element: { testcase: ['file', 'line'] }.
 */
export function xsdProblems(elements, root, { rootName, extra = {} } = {}) {
  const problems = [];
  if (rootName !== undefined && root.name !== rootName) problems.push(`the root is <${root.name}>, not <${rootName}>`);
  const visit = (node, where) => {
    const shape = elements.get(node.name);
    if (!shape) {
      problems.push(`${where}: unknown element`);
      return;
    }
    for (const [name, value] of Object.entries(node.attributes)) {
      const declared = shape.attributes.get(name);
      if (!declared && !(extra[node.name] ?? []).includes(name)) problems.push(`${where}: unknown attribute ${name}`);
      else if (declared?.pattern && !declared.pattern.test(value)) problems.push(`${where}: attribute ${name}="${value}" does not match its type`);
    }
    for (const [name, declared] of shape.attributes) if (declared.required && !(name in node.attributes)) problems.push(`${where}: attribute ${name} is required`);
    if (!shape.text && node.text.trim() !== '') problems.push(`${where}: text is not allowed here`);
    node.children.forEach((child, index) => {
      if (!shape.children.has(child.name)) problems.push(`${where}: <${child.name}> is not allowed here`);
      else visit(child, `${where}/${child.name}[${index}]`);
    });
  };
  visit(root, `/${root.name}`);
  return problems;
}
