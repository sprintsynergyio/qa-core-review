// JS/TS without a syntax tree (SPEC.md Section 7.2): when the grammar cannot be loaded or the
// file is too broken to parse, the lexical scanner still finds the tests, their focus and skip
// markers, the lines that assert and the fixed sleeps. It works on lines and indentation, so
// spans cover whole lines and nothing is known about operands.
import { clipText, emptyTest, parseSuppression } from '../../model/build.js';
import { testId } from '../../model/hash.js';
import type { Capability, Modifier, NFile, Span } from '../../model/types.js';
import { JS_LEXICAL, scanLines, type ScannedLine } from '../../parse/lexical.js';
import type { AdapterContext, FrameworkGuess, SourceFile } from '../types.js';
import { ALIASES, LEXICAL_ASSERTION, LEXICAL_FIXED_WAIT, MODIFIER_MEMBERS, SUITE_CALLEES, SUITE_MEMBER, TEST_CALLEES, TEST_FILE_NAME } from './vocab.js';

/** What the lexical scanner fills in. Rules that need anything else are skipped for the file. */
export const JS_LEXICAL_CAPABILITIES: Capability[] = ['tests', 'modifiers', 'assertions', 'waits'];

const names = [...TEST_CALLEES, ...SUITE_CALLEES, ...Object.keys(ALIASES)].join('|');
const DECLARATION = new RegExp(`(?<![\\w$.])(${names})((?:\\.\\w+)*)\\s*\\(\\s*(['"\`])`);
const lineSpan = (line: ScannedLine, last: ScannedLine = line): Span => ({ startLine: line.line, startColumn: line.indent + 1, endLine: last.line, endColumn: last.text.length + 1 });

export function normalizeJsLexical(file: SourceFile, frameworks: FrameworkGuess, ctx: AdapterContext): NFile {
  const lines = scanLines(file.text, JS_LEXICAL);
  const model: NFile = {
    path: file.path, language: file.language, languageHint: null, adapter: 'js', tier: 1,
    runner: ctx.config.framework === 'auto' ? frameworks.runner : ctx.config.framework, libraries: frameworks.libraries,
    role: TEST_FILE_NAME.test(file.path) ? 'test' : 'support', parseStatus: 'failed', capabilities: [], suites: [], tests: [], fileHooks: [], fileMocks: [], fileResources: [], imports: [], subject: null,
    suppressions: lines.flatMap((line) => line.comments.flatMap((comment) => parseSuppression(comment.text, { ...lineSpan(line), startColumn: comment.column }) ?? [])),
  };
  const declarations = lines.flatMap((line, index) => {
    const match = DECLARATION.exec(line.codeNoStrings);
    if (!match) return [];
    const alias = ALIASES[match[1]!];
    const members = match[2]!.split('.').filter(Boolean);
    const suite = alias ? alias.kind === 'suite' : SUITE_CALLEES.some((name) => name === match[1]) || members[0] === SUITE_MEMBER;
    const modifiers = [...(alias ? [alias.modifier] : []), ...members.flatMap((member) => MODIFIER_MEMBERS[member] ?? [])];
    // The title is the string that opens at the matched quote, read from the line with its strings kept.
    const open = match.index + match[0].length;
    const close = line.code.indexOf(match[3]!, open);
    return [{ index, line, suite, modifiers: [...new Set<Modifier>(modifiers)], title: line.code.slice(open, close < 0 ? undefined : close) }];
  });

  const seen = new Map<string, number>();
  const suites: Array<{ indent: number; title: string }> = [];
  declarations.forEach((declaration, position) => {
    const { line, index, title } = declaration;
    while (suites.length > 0 && suites.at(-1)!.indent >= line.indent) suites.pop();
    if (declaration.suite) return void suites.push({ indent: line.indent, title });
    // The test runs to the line before the next declaration that is not indented deeper.
    const next = declarations.slice(position + 1).find((later) => later.line.indent <= line.indent);
    const body = lines.slice(index, next ? next.index : lines.length).filter((candidate, offset) => offset === 0 || candidate.codeNoStrings.trim() !== '');
    const suitePath = suites.map((suite) => suite.title);
    const fullTitle = [...suitePath, title].join(' > ');
    const occurrence = seen.get(fullTitle) ?? 0;
    seen.set(fullTitle, occurrence + 1);
    const span = lineSpan(line, body.at(-1));
    const test = emptyTest({ id: testId(file.path, fullTitle, occurrence), title, fullTitle, suitePath, span, bodySpan: span });
    test.modifiers = declaration.modifiers;
    if (test.modifiers.includes('skip') || test.modifiers.includes('fixme')) test.skip = { unconditional: true, conditional: false, reason: null };
    test.statementCount = body.filter((candidate) => /[\w$]/.test(candidate.codeNoStrings)).length - 1;
    for (const candidate of body) {
      const entry = { span: lineSpan(candidate), text: clipText(candidate.text) };
      if (LEXICAL_ASSERTION.test(candidate.codeNoStrings)) {
        test.assertions.push({
          ...entry, kind: 'other', library: 'unknown', actual: null, expected: null, matcher: null, negated: false, soft: false, complete: true,
          awaited: 'not-needed', guarded: false, reachable: true, viaHelper: null,
        });
      }
      const wait = LEXICAL_FIXED_WAIT.exec(candidate.codeNoStrings);
      if (wait) test.waits.push({ ...entry, kind: 'fixed-sleep', ms: wait.slice(2).some(Boolean) ? Number(wait.slice(2).find(Boolean)) : null });
    }
    model.tests.push(test);
  });

  // With no test found the scanner has nothing to offer, and the file stays 'failed'.
  if (model.tests.length > 0) Object.assign(model, { role: 'test', parseStatus: 'partial', capabilities: [...JS_LEXICAL_CAPABILITIES] });
  return model;
}
