// The optional line patterns of the generic adapter (SPEC.md Section 9.5). A `generic` config
// entry can give regular expressions for a language that has no static adapter. With them the
// lexical scanner splits a file into tests and marks the lines that assert, sleep, skip and
// focus. Nothing else is known about the code, so every finding from these facts is low
// confidence. Each pattern is tried on one line at a time, with comments removed.
import type { GenericPatterns } from '../../config/types.js';
import { clipText, emptyTest } from '../../model/build.js';
import { testId } from '../../model/hash.js';
import type { Capability, NTest, Span } from '../../model/types.js';
import type { ScannedLine } from '../../parse/lexical.js';
import { MARKER_LINE } from './languages.js';

export interface CompiledPatterns {
  test: RegExp;
  assertion: RegExp | null;
  sleep: RegExp | null;
  skip: RegExp | null;
  focus: RegExp | null;
}

/** The patterns of a config entry, ready to use. Null when the entry has none: the file is then listed for the LLM review only. */
export function compilePatterns(patterns: GenericPatterns | undefined): CompiledPatterns | null {
  if (patterns === undefined) return null;
  const compile = (source: string | undefined): RegExp | null => (source === undefined ? null : new RegExp(source));
  return {
    test: new RegExp(patterns.testPattern), assertion: compile(patterns.assertionPattern), sleep: compile(patterns.sleepPattern),
    skip: compile(patterns.skipPattern), focus: compile(patterns.focusPattern),
  };
}

/**
 * What a file read with these patterns holds. A pattern that is not given leaves its capability
 * out, so the rule that needs it is skipped and a missing pattern never turns into a finding.
 */
export function capabilitiesOf(patterns: CompiledPatterns): Capability[] {
  return ['tests', ...(patterns.skip || patterns.focus ? ['modifiers' as const] : []), ...(patterns.assertion ? ['assertions' as const] : []), ...(patterns.sleep ? ['waits' as const] : [])];
}

/** How many header lines below a test match are searched for the brace that opens the body. */
const HEADER_LINES = 4;

/** A line that only closes a block: at most one word, as in `end`, `})` or `done`. */
const CLOSING_LINE = /^\W*\w*\W*$/;

const lineSpan = (line: ScannedLine, last: ScannedLine = line): Span => ({ startLine: line.line, startColumn: line.indent + 1, endLine: last.line, endColumn: last.text.length + 1 });
const count = (text: string, sign: string): number => text.split(sign).length - 1;
const blank = (line: ScannedLine): boolean => line.code.trim() === '';

/**
 * Splits the scanned lines of a file into tests. A test starts at a line that matches the test
 * pattern. When the body opens with a brace on that line, or on a line right below it at the
 * same indent (`fn adds() {` under `#[test]`), the test ends at the matching closing brace.
 * Otherwise the test is the lines below the match that are indented deeper, with the line that
 * closes them (`end`). Either way it stops before the next test match at the same or a lower
 * indent. A match inside another test is not a test.
 */
export function testsFromPatterns(filePath: string, lines: readonly ScannedLine[], patterns: CompiledPatterns): NTest[] {
  const starts = lines.flatMap((line, index) => (patterns.test.test(line.code) ? [index] : []));
  const tests: NTest[] = [];
  const seen = new Map<string, number>();
  let previousEnd = -1;

  for (const start of starts) {
    if (start <= previousEnd) continue;
    const first = lines[start]!;

    // Where the body opens: a brace that is still open at the end of its line, or a body on one line that ends with its closing brace.
    // The lines in between may match the test pattern too (`[TestCase(1)]` twice above one method): they are one test.
    let open = -1;
    for (let index = start; index < Math.min(lines.length, start + HEADER_LINES + 1); index += 1) {
      const line = lines[index]!;
      if (index > start && (blank(line) || line.indent !== first.indent)) break;
      const code = line.codeNoStrings;
      if (code.includes('{') && (count(code, '{') > count(code, '}') || /\}[\s);,]*$/.test(code))) {
        open = index;
        break;
      }
    }

    const sibling = starts.find((index) => index > Math.max(open, start) && lines[index]!.indent <= first.indent) ?? lines.length;
    let end: number;
    if (open >= 0) {
      let depth = 0;
      end = sibling - 1;
      for (let index = open; index < sibling; index += 1) {
        depth += count(lines[index]!.codeNoStrings, '{') - count(lines[index]!.codeNoStrings, '}');
        if (depth <= 0) {
          end = index;
          break;
        }
      }
    } else {
      // The body is the run of deeper lines, and a closing line at the indent of the test (`end`, `})`) when one follows.
      const after = lines.findIndex((line, index) => index > start && !blank(line) && line.indent <= first.indent);
      const stop = after === -1 ? lines.length : after;
      end = stop < sibling && lines[stop]!.indent === first.indent && CLOSING_LINE.test(lines[stop]!.codeNoStrings) ? stop : stop - 1;
    }
    while (end > start && blank(lines[end]!)) end -= 1;

    // The header: marker lines right above the match, the match, and the lines down to the opening brace.
    let top = start;
    while (top - 1 > previousEnd && lines[top - 1]!.indent === first.indent && MARKER_LINE.test(lines[top - 1]!.codeNoStrings)) top -= 1;
    previousEnd = end;
    const bodyStart = Math.max(open, start);
    const opener = lines[bodyStart]!;
    const header = lines.slice(top, bodyStart + 1);
    const body = lines.slice(bodyStart + 1, end + 1).filter((line) => !blank(line));

    // What stands after the opening brace, or after the match when there is no brace, is part of the body: a test on one line has nothing else.
    const match = patterns.test.exec(first.code)!;
    const from = open >= 0 ? opener.codeNoStrings.indexOf('{') + 1 : match.index + match[0].length;
    const checked: Array<{ line: ScannedLine; code: string }> = [{ line: opener, code: opener.codeNoStrings.slice(from) }, ...body.map((line) => ({ line, code: line.codeNoStrings }))];

    // The title: the `title` group of the test pattern when it has one, or else the line that declares the test.
    const declared = lines.slice(start, bodyStart + 1).reverse()
      .map((line) => (line === opener && open >= 0 ? line.code.slice(0, line.codeNoStrings.indexOf('{')) : line.code).trim()).find((text) => text !== '') ?? first.code.trim();
    const title = clipText(match.groups?.title ?? declared);
    const occurrence = seen.get(title) ?? 0;
    seen.set(title, occurrence + 1);
    const span = lineSpan(lines[top]!, lines[end]);
    const test = emptyTest({ id: testId(filePath, title, occurrence), title, fullTitle: title, suitePath: [], span, bodySpan: body.length > 0 ? lineSpan(body[0]!, body.at(-1)) : lineSpan(opener, lines[end]) });

    // The reason of a skip is known only when the skip pattern names it with a `reason` group.
    const skips = header.flatMap((line) => {
      const found = patterns.skip?.exec(line.code);
      return found ? [found] : [];
    });
    if (skips.length > 0) {
      const reason = skips.map((found) => found.groups?.reason).find((text) => text !== undefined);
      test.modifiers.push('skip');
      test.skip = { unconditional: true, conditional: false, reason: reason === undefined ? null : clipText(reason) };
    }
    if (patterns.focus && header.some((line) => patterns.focus!.test(line.code))) test.modifiers.push('only');
    // A line with no word in it (a lone closing brace) is not a statement.
    test.statementCount = checked.filter(({ code }) => /\w/.test(code)).length;
    for (const { line, code } of checked) {
      const entry = { span: lineSpan(line), text: clipText(line.text) };
      if (patterns.assertion?.test(code)) {
        test.assertions.push({
          ...entry, kind: 'other', library: 'unknown', actual: null, expected: null, matcher: null, negated: false, soft: false, complete: true,
          awaited: 'not-needed', guarded: false, reachable: true, viaHelper: null,
        });
      }
      // The unit of the number is not known (milliseconds in one language, seconds in the next), so no duration is given.
      if (patterns.sleep?.test(code)) test.waits.push({ ...entry, kind: 'fixed-sleep', ms: null });
    }
    tests.push(test);
  }
  return tests;
}
