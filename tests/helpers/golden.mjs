// Golden file helper for adapter tests.
//
// expectGolden(actual, goldenPath) compares a value with a committed JSON file.
// - Same content: returns 'match'.
// - Different content: throws with a readable line diff.
// - With UPDATE_GOLDEN=1 (or { update: true }): writes the file and returns 'created',
//   'updated' or 'match'. Explain every golden diff in the pull request.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/** The exact text a golden file holds: 2-space JSON, LF line endings, one trailing newline. */
export function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

const MAX_TABLE_CELLS = 4_000_000;

/**
 * A line diff in a unified style: '-' lines are in the golden file only, '+' lines are in the
 * actual value only. Returns '' when the texts are equal.
 */
export function diffLines(expectedText, actualText, { context = 2, maxLines = 80 } = {}) {
  if (expectedText === actualText) return '';
  const expected = expectedText.split('\n');
  const actual = actualText.split('\n');

  // Trim the common start and end, so the table below only covers the part that changed.
  let start = 0;
  while (start < expected.length && start < actual.length && expected[start] === actual[start]) start += 1;
  let endExpected = expected.length;
  let endActual = actual.length;
  while (endExpected > start && endActual > start && expected[endExpected - 1] === actual[endActual - 1]) {
    endExpected -= 1;
    endActual -= 1;
  }
  const a = expected.slice(start, endExpected);
  const b = actual.slice(start, endActual);

  // ops: [' ' | '-' | '+', line text] for the changed middle part.
  const ops = [];
  if (a.length * b.length > MAX_TABLE_CELLS) {
    for (const line of a) ops.push(['-', line]);
    for (const line of b) ops.push(['+', line]);
  } else {
    // Longest common subsequence table, filled from the end.
    const width = b.length + 1;
    const table = new Uint32Array((a.length + 1) * width);
    for (let i = a.length - 1; i >= 0; i -= 1) {
      for (let j = b.length - 1; j >= 0; j -= 1) {
        table[i * width + j] = a[i] === b[j]
          ? table[(i + 1) * width + j + 1] + 1
          : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < a.length || j < b.length) {
      if (i < a.length && j < b.length && a[i] === b[j]) {
        ops.push([' ', a[i]]);
        i += 1;
        j += 1;
      } else if (j >= b.length || (i < a.length && table[(i + 1) * width + j] >= table[i * width + j + 1])) {
        ops.push(['-', a[i]]);
        i += 1;
      } else {
        ops.push(['+', b[j]]);
        j += 1;
      }
    }
  }

  const before = expected.slice(Math.max(0, start - context), start).map((line) => [' ', line]);
  const after = expected.slice(endExpected, endExpected + context).map((line) => [' ', line]);
  const all = [...before, ...ops, ...after];

  // Keep changed lines and `context` unchanged lines around them.
  const keep = new Array(all.length).fill(false);
  all.forEach(([kind], index) => {
    if (kind === ' ') return;
    for (let k = Math.max(0, index - context); k <= Math.min(all.length - 1, index + context); k += 1) keep[k] = true;
  });

  const out = ['--- golden file', '+++ actual', `@@ golden line ${Math.max(1, start - before.length + 1)} @@`];
  let shown = 0;
  let gap = false;
  for (let index = 0; index < all.length; index += 1) {
    if (!keep[index]) {
      gap = true;
      continue;
    }
    if (shown >= maxLines) {
      out.push(`... diff cut after ${maxLines} lines`);
      break;
    }
    if (gap && shown > 0) out.push('  ...');
    gap = false;
    out.push(`${all[index][0]} ${all[index][1]}`);
    shown += 1;
  }
  return out.join('\n');
}

function updateRequested() {
  return process.env.UPDATE_GOLDEN === '1';
}

/**
 * Compares `actual` with the golden file. See the top of this file for the outcomes.
 * @returns {'match' | 'created' | 'updated'}
 */
export function expectGolden(actual, goldenPath, options) {
  return expectGoldenText(stableJson(actual), goldenPath, options);
}

/** The same for a golden file that is plain text, such as a Markdown or an XML report. */
export function expectGoldenText(actualText, goldenPath, { update = updateRequested() } = {}) {
  const shown = path.relative(process.cwd(), goldenPath).split(path.sep).join('/');
  const exists = fs.existsSync(goldenPath);
  const expectedText = exists ? fs.readFileSync(goldenPath, 'utf8').replace(/\r\n/g, '\n') : null;

  if (expectedText === actualText) return 'match';
  if (update) {
    fs.mkdirSync(path.dirname(goldenPath), { recursive: true });
    fs.writeFileSync(goldenPath, actualText);
    return exists ? 'updated' : 'created';
  }
  if (expectedText === null) {
    assert.fail(`Golden file is missing: ${shown}\nRun UPDATE_GOLDEN=1 npm test to create it, then review and commit it.`);
  }
  assert.fail(
    `Golden mismatch: ${shown}\n${diffLines(expectedText, actualText)}\n` +
      'If this change is intended, run UPDATE_GOLDEN=1 npm test and explain the diff in the pull request.',
  );
}
