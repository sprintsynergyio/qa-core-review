// Text normalization and positions.
//
// Every position the tool reports is 1-based, on LF-normalized text, with columns counted in
// UTF-16 code units (the unit of JavaScript strings and of web-tree-sitter). A span's end is
// exclusive: `endColumn` is the column just after the last character.
import type { Span } from '../model/types.js';

const BOM = String.fromCharCode(0xfeff);

/** Removes a leading byte order mark and turns CRLF and lone CR line endings into LF. */
export function toLf(text: string): string {
  const body = text.startsWith(BOM) ? text.slice(1) : text;
  return body.includes('\r') ? body.replace(/\r\n?/g, '\n') : body;
}

/** A tree-sitter point: 0-based row and column. */
export interface PointLike {
  row: number;
  column: number;
}

/** The span of a syntax node, or of anything else with tree-sitter start and end points. */
export function spanOfNode(node: { startPosition: PointLike; endPosition: PointLike }): Span {
  return {
    startLine: node.startPosition.row + 1,
    startColumn: node.startPosition.column + 1,
    endLine: node.endPosition.row + 1,
    endColumn: node.endPosition.column + 1,
  };
}

/** Converts character offsets in a text to lines and columns. Build once per file. */
export class LineIndex {
  readonly #starts: number[] = [0];
  readonly #length: number;

  constructor(text: string) {
    this.#length = text.length;
    for (let index = text.indexOf('\n'); index !== -1; index = text.indexOf('\n', index + 1)) {
      this.#starts.push(index + 1);
    }
  }

  get lineCount(): number {
    return this.#starts.length;
  }

  /** The 1-based line and column of an offset. Offsets outside the text are clamped. */
  positionAt(offset: number): { line: number; column: number } {
    const clamped = Math.max(0, Math.min(offset, this.#length));
    let low = 0;
    let high = this.#starts.length - 1;
    while (low < high) {
      const middle = (low + high + 1) >> 1;
      if (this.#starts[middle]! <= clamped) low = middle;
      else high = middle - 1;
    }
    return { line: low + 1, column: clamped - this.#starts[low]! + 1 };
  }

  /** The span from `start` (inclusive) to `end` (exclusive), both character offsets. */
  spanOf(start: number, end: number): Span {
    const from = this.positionAt(start);
    const to = this.positionAt(end);
    return { startLine: from.line, startColumn: from.column, endLine: to.line, endColumn: to.column };
  }
}
