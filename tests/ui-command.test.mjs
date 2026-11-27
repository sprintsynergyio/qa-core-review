// The `ui` command (SPEC.md Sections 11.1, 11.2 and 13.1), run as a child process on dist/cli.js
// with --no-open, and driven through the address it prints.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { repoRoot } from './helpers/schema.mjs';
import { call } from './helpers/ui.mjs';

const cliPath = path.join(repoRoot, 'dist', 'cli.js');
const runSync = (args, cwd = repoRoot) => spawnSync(process.execPath, [cliPath, ...args], { cwd, encoding: 'utf8', windowsHide: true, shell: false });
const outputDir = (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcr-ui-cmd-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
};

/** Starts `ui --no-open` and resolves when the address is printed, with a handle that looks like a server to `call`. */
function startUi(t, args) {
  const child = spawn(process.execPath, [cliPath, 'ui', ...args, '--no-open'], { cwd: repoRoot, windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => child.kill());
  const output = { stdout: '', stderr: '' };
  child.stderr.on('data', (chunk) => (output.stderr += chunk));
  const exited = new Promise((resolve) => child.on('close', (code, signal) => resolve({ code, signal, ...output })));
  const ready = new Promise((resolve, reject) => {
    child.stdout.on('data', (chunk) => {
      output.stdout += chunk;
      const found = /^Review page: http:\/\/127\.0\.0\.1:(\d+)\/\?t=([0-9a-f]{64})$/m.exec(output.stdout);
      if (found) resolve({ port: Number(found[1]), token: found[2], child, exited, output });
    });
    exited.then((result) => reject(new Error(`ui stopped before it printed the address: ${JSON.stringify(result)}`)));
  });
  return ready;
}

test('ui reviews, prints the address, serves the page and the API, and exits 0 after Finish', async (t) => {
  const out = outputDir(t);
  const ui = await startUi(t, ['fixtures/projects/js-basic', '--output', out]);
  assert.deepEqual(ui.output.stdout.split('\n').slice(0, 2), ['Summary: 3 pass, 0 review, 1 fail. 1 error, 1 warning, 1 info. 0 suppressed.', `Reports: ${path.join(out, 'report.json').split(path.sep).join('/')}`]);

  const page = await call(ui, 'GET', `/?t=${ui.token}`, { token: null });
  assert.deepEqual([page.status, page.headers['content-security-policy']], [200, "default-src 'self'"]);
  assert.match(page.text, /<script type="module" src="app\.js"><\/script>/);

  const report = (await call(ui, 'GET', '/api/report')).json;
  assert.deepEqual(report.files.map((file) => file.file), JSON.parse(fs.readFileSync(path.join(out, 'report.json'), 'utf8')).files.map((file) => file.file));
  // The source of every file of the report, with the line ends the report counted with.
  assert.deepEqual(Object.keys(report.sources).sort(), report.files.map((file) => file.file).sort());
  const checkout = 'fixtures/projects/js-basic/tests/checkout.spec.ts';
  assert.equal(report.sources[checkout], fs.readFileSync(path.join(repoRoot, checkout), 'utf8').replace(/\r\n/g, '\n'));

  const failing = report.files.flatMap((file) => file.tests).find((entry) => entry.verdict === 'fail');
  assert.equal((await call(ui, 'PUT', `/api/session/tests/${failing.id}`, { body: { decision: 'rejected', comment: 'Check the URL.' } })).status, 200);
  assert.equal(JSON.parse(fs.readFileSync(path.join(out, 'session.json'), 'utf8')).tests[failing.id].comment, 'Check the URL.');
  assert.equal((await call(ui, 'POST', '/api/finish', { body: {} })).json.outcome, 'changes-requested');

  const ended = await ui.exited;
  assert.deepEqual([ended.code, ended.stderr], [0, '']);
  assert.match(ended.stdout, /\nDecide on each test there, then click Finish\. Press Ctrl\+C to stop\.\nReview finished: changes requested\. Decisions are saved in .*session\.json\n$/);

  // A second run finds the decision again.
  const again = await startUi(t, ['fixtures/projects/js-basic', '--output', out]);
  assert.notEqual(again.token, ui.token);
  const kept = (await call(again, 'GET', '/api/session')).json;
  assert.deepEqual([kept.tests[failing.id].decision, kept.tests[failing.id].comment, kept.outcome], ['rejected', 'Check the URL.', null]);
  await call(again, 'PUT', `/api/session/tests/${failing.id}`, { body: { decision: 'approved' } });
  await call(again, 'POST', '/api/finish', { body: {} });
  assert.match((await again.exited).stdout, /Review finished: approved\./);
});

test('ui takes --port, and stops with exit 0 and a note when it is ended before Finish', { skip: process.platform === 'win32' ? 'a child process cannot be sent Ctrl+C on Windows' : false }, async (t) => {
  const taken = await startUi(t, ['fixtures/projects/js-basic', '--output', outputDir(t)]);
  const busy = runSync(['ui', 'fixtures/projects/js-basic', '--output', outputDir(t), '--no-open', '--port', String(taken.port)]);
  assert.deepEqual([busy.status, busy.stderr.split('\n')[0]], [2, `qa-core-review: cannot use port ${taken.port} for the review page (EADDRINUSE). Leave --port out to get a free one`]);
  taken.child.kill('SIGINT');
  const ended = await taken.exited;
  assert.deepEqual([ended.code, ended.signal, ended.stderr], [0, null, '']);
  assert.match(ended.stdout, /\nThe review page was closed before Finish\. Decisions are saved in .*session\.json\n$/);

  // The port is free again, so it can be asked for by number.
  const fixed = await startUi(t, ['fixtures/projects/js-basic', '--output', outputDir(t), '--port', String(taken.port)]);
  assert.equal(fixed.port, taken.port);
  fixed.child.kill('SIGTERM');
  assert.equal((await fixed.exited).code, 0);
});

test('ui --help, flags that do not fit, and a run with nothing to review', (t) => {
  const help = runSync(['ui', '--help']);
  assert.deepEqual([help.status, help.stderr], [0, '']);
  for (const word of ['Usage: qa-core-review ui [paths...] [flags]', '--port <n>', '--no-open', '127.0.0.1', 'session.json', 'Ctrl+C']) assert.ok(help.stdout.includes(word), word);
  assert.match(runSync(['--help']).stdout, /qa-core-review ui \[paths\.\.\.\] \[flags\]/);

  for (const [args, message] of [
    [['--port', 'abc'], '--port must be a whole number from 0 to 65535, not "abc"'],
    [['--port', '70000'], '--port must be a whole number from 0 to 65535, not "70000"'],
    [['--port', '8080.5'], '--port must be a whole number from 0 to 65535, not "8080.5"'],
    [['--port='], '--port must be a whole number from 0 to 65535, not ""'],
    [['--stdout', 'json'], '--stdout does not go with ui: the review page shows the report'],
    [['--gate'], '--gate is not available yet in this development build'],
    [['--format', 'html'], '--format: unknown format "html"'],
  ]) {
    const ran = runSync(['ui', 'fixtures/projects/js-basic', '--no-open', '--output', outputDir(t), ...args]);
    assert.equal(ran.status, 2, args.join(' '));
    assert.ok(ran.stderr.includes(message), `${args.join(' ')}: ${ran.stderr}`);
  }
  // The flags of ui are not flags of review.
  assert.equal(runSync(['review', 'fixtures/projects/js-basic', '--port', '8080', '--output', outputDir(t)]).status, 2);

  const empty = outputDir(t);
  const nothing = runSync(['ui', '--root', empty, '--no-open']);
  assert.deepEqual([nothing.status, nothing.stderr], [0, '']);
  assert.match(nothing.stdout, /\nNothing to review, so the review page was not opened\.\n$/);
  assert.equal(fs.existsSync(path.join(empty, '.qa-core', 'review', 'session.json')), false);
});

test('the browser is opened with a program and its arguments, never through a shell', async () => {
  const { browserCommand } = await import('../dist/commands/ui.js');
  const url = 'http://127.0.0.1:8123/?t=abc';
  assert.deepEqual(browserCommand('darwin', url), { command: 'open', args: [url] });
  assert.deepEqual(browserCommand('win32', url), { command: 'cmd', args: ['/c', 'start', '""', url] });
  assert.deepEqual(browserCommand('linux', url), { command: 'xdg-open', args: [url] });
  assert.deepEqual(browserCommand('freebsd', url), { command: 'xdg-open', args: [url] });
  assert.equal(browserCommand('aix', url), null);
});

test('without --no-open the address goes to the opener of the system, and a missing opener is no error', { skip: process.platform === 'win32' ? 'the test puts a stand-in for open or xdg-open on the PATH, which Windows does not use' : false }, async (t) => {
  const bin = outputDir(t);
  const opened = path.join(bin, 'opened.txt');
  for (const name of ['open', 'xdg-open']) fs.writeFileSync(path.join(bin, name), `#!/bin/sh\nprintf '%s' "$1" > "${opened}"\n`, { mode: 0o755 });
  const start = (binDir) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, 'ui', 'fixtures/projects/js-basic', '--output', outputDir(t)], { cwd: repoRoot, shell: false, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PATH: binDir } });
    t.after(() => child.kill());
    let stdout = '';
    const exited = new Promise((done) => child.on('close', (code) => done(code)));
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      const found = /^Review page: (\S+)$/m.exec(stdout);
      if (found) resolve({ url: found[1], child, exited });
    });
    exited.then((code) => reject(new Error(`ui stopped with ${code}: ${stdout}`)));
  });

  const withOpener = await start(bin);
  for (let tries = 0; tries < 100 && !fs.existsSync(opened); tries += 1) await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(fs.readFileSync(opened, 'utf8'), withOpener.url);
  withOpener.child.kill('SIGINT');
  assert.equal(await withOpener.exited, 0);

  // No opener on this machine: the address is printed all the same and the page is served.
  const noOpener = await start(outputDir(t));
  const port = Number(new URL(noOpener.url).port);
  assert.equal((await call({ port, token: new URL(noOpener.url).searchParams.get('t') }, 'GET', '/api/session')).status, 200);
  noOpener.child.kill('SIGINT');
  assert.equal(await noOpener.exited, 0);
});

test('the sources sent to the page are the files of the report inside the root, with LF line ends', async (t) => {
  const { readSources } = await import('../dist/commands/ui.js');
  const root = outputDir(t);
  fs.mkdirSync(path.join(root, 'tests'));
  fs.writeFileSync(path.join(root, 'tests', 'a.spec.ts'), 'line 1\r\nline 2\r\n');
  fs.writeFileSync(path.join(root, 'tests', 'big.spec.ts'), 'x'.repeat(1024 * 1024 + 1));
  fs.writeFileSync(path.join(path.dirname(root), 'outside.txt'), 'not for the page');
  t.after(() => fs.rmSync(path.join(path.dirname(root), 'outside.txt'), { force: true }));
  const at = (file) => ({ location: { file } });
  const report = { files: [{ file: 'tests/a.spec.ts' }, { file: 'tests/gone.spec.ts' }, { file: 'tests/big.spec.ts' }, { file: '../outside.txt' }], findings: [at('tests/a.spec.ts'), at('../outside.txt'), at(path.join(path.dirname(root), 'outside.txt'))] };
  assert.deepEqual(readSources(root, report), { 'tests/a.spec.ts': 'line 1\nline 2\n' });
});
