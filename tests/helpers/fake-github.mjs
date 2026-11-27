// A stand-in for the GitHub REST API on this machine, for the tests of the `comment` command
// and of the action steps. It knows the three calls the tool makes: list the comments of an
// issue (in pages), create a comment, and update one. Nothing here talks to the real API.
import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { repoRoot } from './schema.mjs';

export const cliPath = path.join(repoRoot, 'dist', 'cli.js');
export const BOT = 'github-actions[bot]';

/**
 * Starts the fake API. `comments` are there from the start, and `answer(request)` may return
 * `{ status, body }` to answer a request with an error in place of doing it.
 * Gives back the address, the stored comments, and every request that came in.
 */
export async function fakeGitHub(t, { comments = [], login = BOT, answer = () => null } = {}) {
  const store = comments.map((comment, index) => ({ id: index + 1, html_url: `https://github.example.test/comment/${index + 1}`, user: { login }, ...comment }));
  const requests = [];
  const server = http.createServer((request, response) => {
    let text = '';
    request.on('data', (chunk) => (text += chunk));
    request.on('end', () => {
      const url = new URL(request.url, 'http://localhost');
      const seen = { method: request.method, path: url.pathname, query: url.search, headers: request.headers, body: text === '' ? null : JSON.parse(text) };
      requests.push(seen);
      const send = (status, body) => {
        response.writeHead(status, { 'content-type': 'application/json' });
        response.end(JSON.stringify(body));
      };
      const forced = answer(seen);
      if (forced) return send(forced.status, forced.body ?? { message: 'forced' });
      const list = /^\/repos\/[^/]+\/[^/]+\/issues\/(\d+)\/comments$/.exec(url.pathname);
      const one = /^\/repos\/[^/]+\/[^/]+\/issues\/comments\/(\d+)$/.exec(url.pathname);
      if (list && request.method === 'GET') {
        const size = Number(url.searchParams.get('per_page') ?? 30);
        const page = Number(url.searchParams.get('page') ?? 1);
        return send(200, store.slice((page - 1) * size, page * size));
      }
      if (list && request.method === 'POST') {
        const created = { id: store.length + 1, html_url: `https://github.example.test/comment/${store.length + 1}`, user: { login }, body: seen.body.body };
        store.push(created);
        return send(201, created);
      }
      const found = one ? store.find((comment) => comment.id === Number(one[1])) : undefined;
      if (found && request.method === 'PATCH') {
        found.body = seen.body.body;
        return send(200, found);
      }
      return send(404, { message: 'Not Found' });
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return { url: `http://127.0.0.1:${server.address().port}`, comments: store, requests };
}

/** The environment of this process with every GITHUB_ variable removed, so a test never sees the CI run it is part of. */
export function cleanEnv(extra = {}) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^(GITHUB_|GH_|ACTIONS_|RUNNER_)/i.test(name)));
  return { ...env, ...extra };
}

/** Runs a program without blocking this process, so the fake API can answer it. */
export function runAsync(command, args, { env, cwd } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, cwd, shell: false, windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

/** Runs the built CLI with a clean environment plus `env`. */
export const runCli = (args, env = {}, cwd = undefined) => runAsync(process.execPath, [cliPath, ...args], { env: cleanEnv(env), cwd });
