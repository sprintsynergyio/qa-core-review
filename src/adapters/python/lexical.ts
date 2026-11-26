// Python without a syntax tree (SPEC.md Section 7.2): when the grammar cannot be loaded or the
// file is too broken to parse, the lexical scanner still finds the tests, their skip and xfail
// decorators, the lines that assert and the fixed sleeps. It works on lines and indentation, so
// spans cover whole lines and nothing is known about operands.
import { clipText, emptyTest, parseSuppression } from '../../model/build.js';
import { testId } from '../../model/hash.js';
import type { Capability, NFile, Span } from '../../model/types.js';
import { PYTHON_LEXICAL, scanLines, type ScannedLine } from '../../parse/lexical.js';
import type { AdapterContext, FrameworkGuess, SourceFile } from '../types.js';
import { unparsedPython } from './normalize.js';
import { FIXED_SLEEPS, LEXICAL_ASSERTION, LEXICAL_CLASS, LEXICAL_FIXED_WAIT, LEXICAL_SKIP, LEXICAL_TEST, LEXICAL_XFAIL, TESTCASE_SUFFIX, TEST_CLASS_PREFIX } from './vocab.js';

/** What the lexical scanner fills in. Rules that need anything else are skipped for the file. */
export const PYTHON_LEXICAL_CAPABILITIES: Capability[] = ['tests', 'modifiers', 'assertions', 'waits'];

const lineSpan = (line: ScannedLine, last: ScannedLine = line): Span => ({ startLine: line.line, startColumn: line.indent + 1, endLine: last.line, endColumn: last.text.length + 1 });
const SECONDS = Object.values(FIXED_SLEEPS)[0]!;

export function normalizePythonLexical(file: SourceFile, frameworks: FrameworkGuess, ctx: AdapterContext): NFile {
  const lines = scanLines(file.text, PYTHON_LEXICAL);
  const model = unparsedPython(file, frameworks, ctx, 'failed');
  model.suppressions = lines.flatMap((line) => line.comments.flatMap((comment) => parseSuppression(comment.text, { ...lineSpan(line), startColumn: comment.column }) ?? []));
  const blank = (line: ScannedLine): boolean => line.codeNoStrings.trim() === '';
  const seen = new Map<string, number>();
  /** The test classes that are open at the current line: their indentation, and that of their members once the first one is seen. */
  const classes: Array<{ indent: number; title: string; member: number | null }> = [];

  lines.forEach((line, index) => {
    if (blank(line)) return;
    while (classes.length > 0 && classes.at(-1)!.indent >= line.indent) classes.pop();
    const open = classes.at(-1);
    if (open && open.member === null) open.member = line.indent;
    const declared = LEXICAL_CLASS.exec(line.codeNoStrings);
    if (declared && (declared[2]!.startsWith(TEST_CLASS_PREFIX) || line.codeNoStrings.includes(TESTCASE_SUFFIX))) return void classes.push({ indent: line.indent, title: declared[2]!, member: null });
    const match = LEXICAL_TEST.exec(line.codeNoStrings);
    // A test is a function at the top of the file or a method of a test class. A function inside a function is not, and neither is a method of any other class.
    if (!match || line.indent !== (open ? open.member : 0)) return;
    // The decorators are the lines right above. The body is every line below that is indented deeper.
    let first = index;
    while (first > 0 && lines[first - 1]!.indent === line.indent && lines[first - 1]!.codeNoStrings.trim().startsWith('@')) first -= 1;
    let last = index;
    for (let next = index + 1; next < lines.length && (blank(lines[next]!) || lines[next]!.indent > line.indent); next += 1) if (!blank(lines[next]!)) last = next;
    const decorators = lines.slice(first, index);
    const body = lines.slice(index + 1, last + 1).filter((candidate) => !blank(candidate));
    const suitePath = classes.map((entry) => entry.title);
    const fullTitle = [...suitePath, match[2]!].join(' > ');
    const occurrence = seen.get(fullTitle) ?? 0;
    seen.set(fullTitle, occurrence + 1);
    const span = lineSpan(lines[first]!, lines[last]);
    const test = emptyTest({ id: testId(file.path, fullTitle, occurrence), title: match[2]!, fullTitle, suitePath, span, bodySpan: body.length > 0 ? lineSpan(body[0]!, body.at(-1)) : span });
    if (decorators.some((decorator) => LEXICAL_SKIP.test(decorator.codeNoStrings))) {
      test.modifiers.push('skip');
      test.skip = { unconditional: true, conditional: false, reason: null };
    }
    if (decorators.some((decorator) => LEXICAL_XFAIL.test(decorator.codeNoStrings))) test.modifiers.push('xfail');
    test.statementCount = body.filter((candidate) => !/^\s*(pass|\.\.\.|['"]{3}.*)\s*$/.test(candidate.codeNoStrings)).length;
    for (const candidate of body) {
      const entry = { span: lineSpan(candidate), text: clipText(candidate.text.trim()) };
      if (LEXICAL_ASSERTION.test(candidate.codeNoStrings)) {
        test.assertions.push({
          ...entry, kind: 'other', library: 'unknown', actual: null, expected: null, matcher: null, negated: false, soft: false, complete: true,
          awaited: 'not-needed', guarded: false, reachable: true, viaHelper: null,
        });
      }
      const wait = LEXICAL_FIXED_WAIT.exec(candidate.codeNoStrings);
      // time.sleep takes seconds, wait_for_timeout takes milliseconds.
      if (wait) test.waits.push({ ...entry, kind: 'fixed-sleep', ms: wait[1] !== undefined ? Math.round(Number(wait[1]) * SECONDS) : wait[2] !== undefined ? Number(wait[2]) : null });
    }
    model.tests.push(test);
  });

  // With no test found the scanner has nothing to offer, and the file stays 'failed'.
  if (model.tests.length > 0) Object.assign(model, { role: model.role === 'support' && /(^|\/)(conftest|__init__)\.py$/.test(file.path) ? 'support' : 'test', parseStatus: 'partial', capabilities: [...PYTHON_LEXICAL_CAPABILITIES] });
  return model;
}
