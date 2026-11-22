// The one place that runs git. Always without a shell, and always read-only.
import { spawnSync } from 'node:child_process';

/** Runs `git <args>` in `cwd`. Returns stdout, or null when git is missing or the command fails. */
export function git(args: string[], cwd: string): string | null {
  // core.fsmonitor can name a program for git to run. A repo's own config must not start one here.
  const ran = spawnSync('git', ['-c', 'core.fsmonitor=false', ...args], { cwd, encoding: 'utf8', windowsHide: true, shell: false, maxBuffer: 256 * 1024 * 1024 });
  return ran.error || ran.status !== 0 ? null : ran.stdout;
}

/**
 * The files git knows under `cwd`: tracked and untracked, minus ignored ones and minus tracked
 * files that were deleted from disk. Paths are relative to `cwd` with '/' separators.
 * Null when `cwd` is not inside a git repo or git is not installed.
 */
export function gitListFiles(cwd: string): string[] | null {
  const listed = git(['ls-files', '--cached', '--others', '--exclude-standard', '-z'], cwd);
  if (listed === null) return null;
  const deleted = new Set((git(['ls-files', '--deleted', '-z'], cwd) ?? '').split('\0'));
  return [...new Set(listed.split('\0'))].filter((file) => file !== '' && !deleted.has(file));
}
