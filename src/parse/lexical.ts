// The lexical scanner: a comment- and string-aware view of a source file, with no grammar.
//
// It is the fallback when a tree-sitter grammar is missing or the file is too broken to parse
// (SPEC.md Section 7.2), and the base of the generic adapter's line patterns (Section 9.5).
// It knows only three things about a language: its line comments, its block comments and its
// string delimiters. It is deliberately simple. Known limits: a JavaScript regex literal that
// contains a quote, and a template literal with a backtick inside `${...}`, are read wrong.
import { LineIndex } from './positions.js';

export interface StringDelimiter {
  open: string;
  close: string;
  /** False for strings that end at the end of the line when they are not closed. */
  multiline: boolean;
}

export interface LexicalSyntax {
  /** Line comment markers: ['//'] or ['#']. */
  line: string[];
  /** Block comment pairs: [['/*', '*\/']]. */
  block?: [string, string][];
  strings: StringDelimiter[];
}

const QUOTES: StringDelimiter[] = [
  { open: '"', close: '"', multiline: false },
  { open: "'", close: "'", multiline: false },
];
const TRIPLE_DOUBLE: StringDelimiter = { open: '"""', close: '"""', multiline: true };

export const JS_LEXICAL: LexicalSyntax = {
  line: ['//'],
  block: [['/*', '*/']],
  strings: [...QUOTES, { open: '`', close: '`', multiline: true }],
};
export const PYTHON_LEXICAL: LexicalSyntax = {
  line: ['#'],
  strings: [TRIPLE_DOUBLE, { open: "'''", close: "'''", multiline: true }, ...QUOTES],
};
export const JAVA_LEXICAL: LexicalSyntax = {
  line: ['//'],
  block: [['/*', '*/']],
  strings: [TRIPLE_DOUBLE, ...QUOTES],
};

/** A syntax for a language known only by its comment markers, with plain quoted strings. */
export function lexicalSyntaxFor(comments: { line: string[]; block?: [string, string][] }): LexicalSyntax {
  return { line: comments.line, ...(comments.block ? { block: comments.block } : {}), strings: QUOTES };
}

export interface Segment {
  kind: 'code' | 'string' | 'comment';
  /** Character offsets. `end` is exclusive. */
  start: number;
  end: number;
  /** For strings: the lengths of the opening and closing delimiters (0 when not closed). */
  openLength: number;
  closeLength: number;
}

/** Splits a text into code, string and comment segments that cover it from start to end. */
export function segments(text: string, syntax: LexicalSyntax): Segment[] {
  const out: Segment[] = [];
  const blocks = syntax.block ?? [];
  // Longest delimiter first, so `"""` wins over `"`.
  const strings = [...syntax.strings].sort((a, b) => b.open.length - a.open.length);
  let codeStart = 0;
  let i = 0;

  const push = (kind: Segment['kind'], start: number, end: number, openLength = 0, closeLength = 0): void => {
    if (end > start) out.push({ kind, start, end, openLength, closeLength });
  };
  const endCode = (): void => push('code', codeStart, i);

  while (i < text.length) {
    const block = blocks.find(([open]) => text.startsWith(open, i));
    if (block) {
      endCode();
      const close = text.indexOf(block[1], i + block[0].length);
      const end = close === -1 ? text.length : close + block[1].length;
      push('comment', i, end);
      codeStart = i = end;
      continue;
    }
    if (syntax.line.some((marker) => text.startsWith(marker, i))) {
      endCode();
      const newline = text.indexOf('\n', i);
      const end = newline === -1 ? text.length : newline;
      push('comment', i, end);
      codeStart = i = end;
      continue;
    }
    const delimiter = strings.find(({ open }) => text.startsWith(open, i));
    if (delimiter) {
      endCode();
      let j = i + delimiter.open.length;
      let closeLength = 0;
      while (j < text.length) {
        if (text[j] === '\\') j += 2;
        else if (text.startsWith(delimiter.close, j)) {
          closeLength = delimiter.close.length;
          j += closeLength;
          break;
        } else if (text[j] === '\n' && !delimiter.multiline) break;
        else j += 1;
      }
      const end = Math.min(j, text.length);
      push('string', i, end, delimiter.open.length, closeLength);
      codeStart = i = end;
      continue;
    }
    i += 1;
  }
  endCode();
  return out;
}

export interface ScannedLine {
  /** 1-based. */
  line: number;
  /** The line as written. */
  text: string;
  /** The line with comments blanked out. Strings are kept. Columns match `text`. */
  code: string;
  /** Like `code`, with the content of strings blanked out too. The delimiters are kept. */
  codeNoStrings: string;
  /** The number of leading spaces and tabs. */
  indent: number;
  /** The comment text on this line, with its marker, and its 1-based column. */
  comments: Array<{ column: number; text: string }>;
}

function blank(chars: string[], start: number, end: number): void {
  for (let index = start; index < end; index += 1) {
    if (chars[index] !== '\n') chars[index] = ' ';
  }
}

/**
 * The lines of an LF-normalized text, each with a view that has no comments and a view that
 * also has no string content, so line patterns do not match inside comments or strings.
 */
export function scanLines(text: string, syntax: LexicalSyntax): ScannedLine[] {
  const code = text.split('');
  const bare = [...code];
  const index = new LineIndex(text);
  const commentsByLine = new Map<number, Array<{ column: number; text: string }>>();

  for (const segment of segments(text, syntax)) {
    if (segment.kind === 'comment') {
      blank(code, segment.start, segment.end);
      blank(bare, segment.start, segment.end);
      // A block comment over several lines gives each line its own piece.
      let offset = segment.start;
      for (const piece of text.slice(segment.start, segment.end).split('\n')) {
        const { line, column } = index.positionAt(offset);
        if (piece.trim() !== '') commentsByLine.set(line, [...(commentsByLine.get(line) ?? []), { column, text: piece }]);
        offset += piece.length + 1;
      }
    } else if (segment.kind === 'string') {
      blank(bare, segment.start + segment.openLength, segment.end - segment.closeLength);
    }
  }

  const rawLines = text.split('\n');
  const codeLines = code.join('').split('\n');
  const bareLines = bare.join('').split('\n');
  return rawLines.map((raw, at) => ({
    line: at + 1,
    text: raw,
    code: codeLines[at]!,
    codeNoStrings: bareLines[at]!,
    indent: raw.length - raw.trimStart().length,
    comments: commentsByLine.get(at + 1) ?? [],
  }));
}
