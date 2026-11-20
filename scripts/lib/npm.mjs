// Runs npm without a shell. npm is started through its JavaScript entry with the current
// Node binary, so this works the same on Windows (where npm is npm.cmd), Linux and macOS.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export function npmCliPath() {
  const fromNpm = process.env.npm_execpath;
  if (fromNpm && /npm-cli\.(c|m)?js$/.test(fromNpm) && fs.existsSync(fromNpm)) return fromNpm;
  const nodeDir = path.dirname(process.execPath);
  const candidates = [
    path.join(nodeDir, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    path.join(nodeDir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error('cannot find npm-cli.js. Run this script through `npm run`.');
  return found;
}

/** Runs `npm <args>` in `cwd` and returns its stdout. Throws when npm fails. */
export function npm(args, cwd) {
  const ran = spawnSync(process.execPath, [npmCliPath(), ...args], { cwd, encoding: 'utf8', windowsHide: true, shell: false });
  if (ran.error) throw new Error(`npm ${args.join(' ')} failed to start: ${ran.error.message}`);
  if (ran.status !== 0) throw new Error(`npm ${args.join(' ')} exited ${ran.status}\n${ran.stderr || ''}`);
  return ran.stdout;
}

/** `npm pack --json` prints a JSON array. Lifecycle script output may come before it. */
export function parsePackJson(stdout) {
  const start = stdout.search(/^\[/m);
  if (start === -1) throw new Error(`npm pack printed no JSON:\n${stdout}`);
  return JSON.parse(stdout.slice(start));
}
