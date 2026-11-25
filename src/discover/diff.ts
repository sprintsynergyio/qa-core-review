// Diff mode (SPEC.md Section 11.2): which lines of which files changed, for `--diff <base>`
// and `--staged`. The review then keeps only the tests on those lines.
import { git } from '../util/git.js';

/** Line ranges that changed in a file, both ends included, or 'all' for a new file. */
export type ChangedLines = Map<string, Array<[number, number]> | 'all'>;

/** The diff could not be made: not a git repo, or a base that git does not know. A usage error. */
export class DiffError extends Error {}

/** `"a\\tb"` as git writes a path with special characters in it. */
function unquote(pathText: string): string {
  if (!pathText.startsWith('"')) return pathText;
  return pathText.slice(1, -1).replace(/\\(["\\tn]|[0-7]{3})/g, (_, code: string) => (code === 't' ? '\t' : code === 'n' ? '\n' : code.length === 3 ? String.fromCharCode(Number.parseInt(code, 8)) : code));
}

/**
 * Reads the output of `git diff -U0`: for each file, the line ranges of its new version that
 * were added or changed. Where lines were only removed, the line before and the line after the
 * gap count as changed, so the test around them is reviewed. Deleted files are left out.
 */
export function parseUnifiedDiff(patch: string): ChangedLines {
  const changed: ChangedLines = new Map();
  let ranges: Array<[number, number]> | null = null;
  for (const line of patch.split('\n')) {
    if (line.startsWith('+++ ')) {
      const target = unquote(line.slice(4).trimEnd());
      ranges = target === '/dev/null' ? null : [];
      if (ranges) changed.set(target.replace(/^b\//, ''), ranges);
      continue;
    }
    const hunk = ranges ? /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line) : null;
    if (!hunk) continue;
    const start = Number(hunk[1]);
    const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
    ranges!.push(count === 0 ? [Math.max(start, 1), start + 1] : [start, start + count - 1]);
  }
  return changed;
}

export function touches(ranges: Array<[number, number]> | 'all' | undefined, startLine: number, endLine: number): boolean {
  return ranges === 'all' || (ranges ?? []).some(([from, to]) => from <= endLine && to >= startLine);
}

/**
 * The changed lines under `root`. With a base: everything since the commit where the current
 * branch left the base (`git diff base...HEAD`), plus changes that are not committed yet, plus
 * untracked files. With `staged`: what `git add` has staged, for a pre-commit hook.
 * Paths are relative to `root` with '/' separators.
 */
export function changedLines(root: string, mode: { base: string } | { staged: true }): ChangedLines {
  if (git(['rev-parse', '--is-inside-work-tree'], root)?.trim() !== 'true') {
    throw new DiffError(`${'base' in mode ? '--diff' : '--staged'} needs a git repository, and ${root.split('\\').join('/')} is not inside one (or git is not installed)`);
  }
  const diff = (args: string[]): ChangedLines => parseUnifiedDiff(git(['-c', 'core.quotepath=off', 'diff', '--no-color', '--no-ext-diff', '--find-renames', '--relative', '-U0', ...args, '--'], root) ?? '');
  if ('staged' in mode) return diff(['--cached']);

  // A base that starts with a dash would be read as an option by git.
  const commit = mode.base.startsWith('-') ? null : git(['rev-parse', '--verify', '--quiet', `${mode.base}^{commit}`], root)?.trim();
  if (!commit) throw new DiffError(`--diff: git does not know the revision "${mode.base}"`);
  // `base...HEAD` means: since the commit both have in common. With no common commit, since the base itself.
  const from = git(['merge-base', commit, 'HEAD'], root)?.trim() || commit;
  const changed = diff([from]);
  for (const file of (git(['ls-files', '--others', '--exclude-standard', '-z'], root) ?? '').split('\0')) {
    if (file !== '') changed.set(file, 'all');
  }
  return changed;
}
