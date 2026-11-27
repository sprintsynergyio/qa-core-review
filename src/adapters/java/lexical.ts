// Java without a syntax tree (SPEC.md Section 7.2): when the grammar cannot be loaded or the
// file is too broken to parse, the lexical scanner still finds the test methods, their skip
// annotations, the lines that assert and the fixed sleeps. It works on lines and on the
// nesting of braces, so spans cover whole lines and nothing is known about operands.
import { clipText, emptyTest, parseSuppression } from '../../model/build.js';
import { testId } from '../../model/hash.js';
import type { Capability, NFile, Span } from '../../model/types.js';
import { JAVA_LEXICAL, scanLines, type ScannedLine } from '../../parse/lexical.js';
import type { AdapterContext, FrameworkGuess, SourceFile } from '../types.js';
import { unparsedJava } from './normalize.js';
import { LEXICAL_ANNOTATION, LEXICAL_ASSERTION, LEXICAL_CLASS, LEXICAL_FIXED_WAIT, LEXICAL_SKIP, LEXICAL_TEST } from './vocab.js';

/** What the lexical scanner fills in. Rules that need anything else are skipped for the file. */
export const JAVA_LEXICAL_CAPABILITIES: Capability[] = ['tests', 'modifiers', 'assertions', 'waits'];

const lineSpan = (line: ScannedLine, last: ScannedLine = line): Span => ({ startLine: line.line, startColumn: line.indent + 1, endLine: last.line, endColumn: last.text.length + 1 });
const count = (text: string, sign: string): number => text.split(sign).length - 1;

export function normalizeJavaLexical(file: SourceFile, frameworks: FrameworkGuess, ctx: AdapterContext, role: NFile['role']): NFile {
  const lines = scanLines(file.text, JAVA_LEXICAL);
  const model = unparsedJava(file, frameworks, ctx, 'failed', role);
  model.suppressions = lines.flatMap((line) => line.comments.flatMap((comment) => parseSuppression(comment.text, { ...lineSpan(line), startColumn: comment.column }) ?? []));
  const blank = (line: ScannedLine): boolean => line.codeNoStrings.trim() === '';
  /** How many braces are open before each line, and after the last one. */
  const depth = [0];
  for (const line of lines) depth.push(depth.at(-1)! + count(line.codeNoStrings, '{') - count(line.codeNoStrings, '}'));
  /** The line at which the braces that open at `from` or after it are closed again: -1 when they never are, null when a `;` comes before any brace. */
  const closeOf = (from: number): number | null => {
    for (let index = from; index < lines.length; index += 1) {
      const code = lines[index]!.codeNoStrings;
      if (code.includes('{')) return lines.findIndex((_, later) => later >= index && depth[later + 1]! <= depth[from]!);
      if (code.includes(';')) return null;
    }
    return null;
  };
  const seen = new Map<string, number>();
  /** The classes that are open at the current line, with the line each one ends at. */
  const classes: Array<{ title: string; end: number }> = [];

  lines.forEach((line, index) => {
    while (classes.length > 0 && classes.at(-1)!.end < index) classes.pop();
    const declared = LEXICAL_CLASS.exec(line.codeNoStrings);
    const end = declared ? closeOf(index) : null;
    if (declared && end !== null) classes.push({ title: declared[1]!, end: end < 0 ? lines.length : end });
    // A test starts at its test annotation. The annotations right above it belong to it, and so do those below, down to the method.
    if (!LEXICAL_TEST.test(line.codeNoStrings) || (index > 0 && LEXICAL_TEST.test(lines[index - 1]!.codeNoStrings))) return;
    let first = index;
    while (first > 0 && LEXICAL_ANNOTATION.test(lines[first - 1]!.codeNoStrings)) first -= 1;
    let at = index;
    let open = 0;
    let name: string | null = null;
    for (; at < lines.length && name === null; at += 1) {
      // An annotation may run over several lines: `@CsvSource({` ... `})`. What follows the last annotation on a line is the method.
      const rest = open > 0 ? '' : lines[at]!.codeNoStrings.replace(/^(\s*@[\w.]+(\s*\((?:[^()]|\([^()]*\))*\))?)+/, '');
      open += count(lines[at]!.codeNoStrings, '(') - count(lines[at]!.codeNoStrings, ')');
      if (rest.trim() !== '' && !rest.trim().startsWith('@') && !rest.trim().startsWith('(')) name = /(\w+)\s*\(/.exec(rest)?.[1] ?? '';
      if (name !== null) break;
      open = Math.max(open, 0);
    }
    const last = name ? closeOf(at) : null;
    if (!name || last === null || last < 0) return; // no method follows, or it has no body, or the body never ends
    const marks = lines.slice(first, at + 1);
    // The body is what stands between the braces. A method on one line is its own body.
    const body = (last === at ? [lines[at]!] : lines.slice(at + 1, last)).filter((candidate) => !blank(candidate));
    const suitePath = classes.map((entry) => entry.title);
    const fullTitle = [...suitePath, name].join(' > ');
    const occurrence = seen.get(fullTitle) ?? 0;
    seen.set(fullTitle, occurrence + 1);
    const span = lineSpan(lines[first]!, lines[last]);
    const test = emptyTest({ id: testId(file.path, fullTitle, occurrence), title: name, fullTitle, suitePath, span, bodySpan: body.length > 0 ? lineSpan(body[0]!, body.at(-1)) : span });
    if (marks.some((mark) => LEXICAL_SKIP.test(mark.codeNoStrings))) {
      test.modifiers.push('skip');
      test.skip = { unconditional: true, conditional: false, reason: null };
    }
    test.statementCount = body.length;
    for (const candidate of body) {
      const entry = { span: lineSpan(candidate), text: clipText(candidate.text.trim()) };
      if (LEXICAL_ASSERTION.test(candidate.codeNoStrings)) {
        test.assertions.push({
          ...entry, kind: 'other', library: 'unknown', actual: null, expected: null, matcher: null, negated: false, soft: false, complete: true,
          awaited: 'not-needed', guarded: false, reachable: true, viaHelper: null,
        });
      }
      const wait = LEXICAL_FIXED_WAIT.exec(candidate.codeNoStrings);
      // Thread.sleep and waitForTimeout both take milliseconds.
      const amount = wait?.[1] ?? wait?.[2];
      if (wait) test.waits.push({ ...entry, kind: 'fixed-sleep', ms: amount !== undefined ? Number(amount.replace(/_/g, '')) : null });
    }
    model.tests.push(test);
  });

  // With no test found the scanner has nothing to offer, and the file stays 'failed'.
  if (model.tests.length > 0) Object.assign(model, { role: 'test', parseStatus: 'partial', capabilities: [...JAVA_LEXICAL_CAPABILITIES] });
  return model;
}
