// A toy language adapter for tests. It reads a made-up line format (.toy) and has no parser
// dependency, so it proves the adapter interface and capability gating without tree-sitter.
//
// The format, one item per line:
//   # comment
//   suite <title>
//   test <title>          also test.skip <title> and test.only <title>
//     do <step>
//     assert <actual> == <expected>     or: assert <expression>
//     sleep <milliseconds>
// A test runs until the next `test` or `suite` line. A suite runs until the next `suite` line.

import { testId } from '../../dist/index.js';

/** @typedef {import('../../dist/index.js').LanguageAdapter} LanguageAdapter */
/** @typedef {import('../../dist/index.js').NFile} NFile */

const CAPABILITIES = ['tests', 'suites', 'modifiers', 'assertions', 'assertion-operands', 'waits'];

function span(lineNumber, text) {
  const startColumn = text.length - text.trimStart().length + 1;
  return { startLine: lineNumber, startColumn, endLine: lineNumber, endColumn: text.trimEnd().length + 1 };
}

function expr(text) {
  const literal = /^(true|false)$/.test(text) ? { type: 'bool', value: text } : /^-?\d+(\.\d+)?$/.test(text) ? { type: 'number', value: text } : null;
  return {
    text,
    normalized: text.replace(/\s+/g, ' '),
    kind: literal ? 'literal' : 'identifier',
    ...(literal ? { literal } : {}),
    isLocator: false,
    isCount: false,
    isMock: false,
  };
}

function assertion(lineNumber, line, body) {
  const [left, right] = body.split('==').map((part) => part.trim());
  return {
    span: span(lineNumber, line),
    text: line.trim(),
    kind: right === undefined ? 'truthiness' : 'equality',
    library: 'toy',
    actual: expr(left),
    expected: right === undefined ? null : expr(right),
    matcher: right === undefined ? null : '==',
    negated: false,
    soft: false,
    complete: true,
    awaited: 'not-needed',
    guarded: false,
    reachable: true,
    viaHelper: null,
  };
}

/** @returns {NFile} */
function normalize(parsed) {
  const { file } = parsed;
  const suites = [];
  const tests = [];
  const seenTitles = new Map();
  let suite = null;
  let test = null;

  parsed.tokens.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) return;
    const [keyword, ...rest] = trimmed.split(' ');
    const text = rest.join(' ').trim();

    if (keyword === 'suite') {
      suite = { title: text, span: span(lineNumber, line), modifiers: [], hooks: [], testIds: [], suites: [] };
      suites.push(suite);
      test = null;
      return;
    }

    if (keyword === 'test' || keyword === 'test.skip' || keyword === 'test.only') {
      const modifier = keyword.split('.')[1];
      const suitePath = suite ? [suite.title] : [];
      const fullTitle = [...suitePath, text].join(' > ');
      const occurrence = seenTitles.get(fullTitle) ?? 0;
      seenTitles.set(fullTitle, occurrence + 1);
      const declared = span(lineNumber, line);
      test = {
        id: testId(file.path, fullTitle, occurrence),
        title: text,
        fullTitle,
        suitePath,
        kind: 'test',
        span: declared,
        // An empty body is a zero-width span at the end of the title line.
        bodySpan: { startLine: lineNumber, startColumn: declared.endColumn, endLine: lineNumber, endColumn: declared.endColumn },
        modifiers: modifier ? [modifier] : [],
        skip: modifier === 'skip' ? { unconditional: true, conditional: false, reason: null } : null,
        parameterized: null,
        assertions: [],
        assertionGuards: { expectedCount: false, hasAssertions: false },
        expectsException: false,
        waits: [],
        selectors: [],
        tryBlocks: [],
        mocks: [],
        resources: [],
        data: [],
        steps: [],
        statementCount: 0,
        bodyHash: null,
      };
      tests.push(test);
      if (suite) {
        suite.testIds.push(test.id);
        suite.span.endLine = lineNumber;
        suite.span.endColumn = declared.endColumn;
      }
      return;
    }

    if (!test) return;
    const here = span(lineNumber, line);
    if (test.statementCount === 0) test.bodySpan = { ...here };
    test.statementCount += 1;
    for (const target of suite ? [test.span, test.bodySpan, suite.span] : [test.span, test.bodySpan]) {
      target.endLine = lineNumber;
      target.endColumn = here.endColumn;
    }
    if (keyword === 'assert') test.assertions.push(assertion(lineNumber, line, text));
    else if (keyword === 'sleep') test.waits.push({ span: here, text: trimmed, kind: 'fixed-sleep', ms: Number(text) });
    else test.steps.push({ span: here, text: trimmed, kind: 'action' });
  });

  return {
    path: file.path,
    language: 'generic',
    languageHint: 'toy',
    adapter: 'toy',
    tier: 3,
    runner: 'unknown',
    libraries: [],
    role: 'test',
    parseStatus: parsed.parseStatus,
    capabilities: [...CAPABILITIES],
    suites,
    tests,
    fileHooks: [],
    fileMocks: [],
    fileResources: [],
    imports: [],
    subject: null,
    suppressions: [],
  };
}

/** @type {LanguageAdapter} */
export const toyAdapter = {
  id: 'toy',
  tier: 3,
  languages: ['generic'],
  extensions: ['.toy'],
  grammars: [],
  frameworks: [],
  defaultInclude: ['**/*.toy'],
  defaultExclude: [],
  commentSyntax: { line: ['#'] },
  capabilities: [...CAPABILITIES],

  languageOf() {
    return 'generic';
  },
  detectProject(probe) {
    if (!probe.hasFile('toy.manifest')) return null;
    return { dir: probe.dir, adapterId: 'toy', languages: ['generic'], frameworks: [], evidence: ['toy.manifest'] };
  },
  classifyFile(file) {
    return file.path.endsWith('.toy') ? 'test' : 'ignore';
  },
  detectFrameworks() {
    return { runner: 'unknown', libraries: [], confidence: 'low' };
  },
  async parse(file) {
    return { file, tree: null, tokens: file.text.split('\n'), parseStatus: 'ok' };
  },
  normalize,
};

/** A SourceFile for the toy adapter, from a root-relative path and the file text. */
export function toySourceFile(relPath, text) {
  return { path: relPath, absPath: `/virtual/${relPath}`, text: text.replace(/\r\n/g, '\n'), language: 'generic', project: null };
}

/** The context adapters receive. The toy adapter reads none of it. */
export const toyContext = {
  config: { testIdAttribute: 'data-testid', assertionHelpers: [], rules: {}, adapters: {} },
  helperIndex: { has: () => false, get: () => [] },
  parser: { parse: async () => null },
};
