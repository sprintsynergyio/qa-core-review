// The server of the local review page (SPEC.md Sections 13.1 and 13.2): where it listens, who it
// answers, what the API does and when it stops.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import { test } from 'node:test';
import { IDLE_MS, MAX_BODY_BYTES, startUiServer } from '../dist/index.js';
import { SOURCES, call, sampleReport, sessionFileFor } from './helpers/ui.mjs';

const { report, tests, finding } = await sampleReport();
const failing = tests['adds a backpack'];
const passing = tests['opens the cart'];
const errorId = finding('QCR-A001', failing.id).id;
const warnId = finding('QCR-W001', failing.id).id;
const readSession = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

async function start(t, options = {}) {
  const sessionFile = options.sessionFile ?? sessionFileFor(t);
  const server = await startUiServer({ report, sources: SOURCES, sessionFile, ...options });
  t.after(() => server.close());
  return { server, sessionFile };
}

/** Resolves with the error code when nothing accepts a connection there, or with 'open'. */
const connect = (host, port) => new Promise((resolve) => {
  const socket = net.connect({ host, port });
  socket.setTimeout(1500, () => {
    socket.destroy();
    resolve('ETIMEDOUT');
  });
  socket.once('connect', () => {
    socket.destroy();
    resolve('open');
  });
  socket.once('error', (error) => resolve(error.code));
});

test('the server listens on 127.0.0.1 only, on a free port, with a new 64 character token for each run', async (t) => {
  const { server } = await start(t);
  const { server: other } = await start(t);
  assert.equal(server.address, '127.0.0.1');
  assert.ok(server.port > 0 && server.port !== other.port);
  assert.match(server.token, /^[0-9a-f]{64}$/);
  assert.notEqual(server.token, other.token);
  assert.equal(server.url, `http://127.0.0.1:${server.port}/?t=${server.token}`);
  assert.equal(await connect('127.0.0.1', server.port), 'open');
  // The other addresses of this machine do not reach it.
  const outside = Object.values(os.networkInterfaces()).flat().filter((entry) => entry && entry.family === 'IPv4' && !entry.internal).map((entry) => entry.address);
  for (const address of outside) assert.notEqual(await connect(address, server.port), 'open', `reachable on ${address}`);
  if (outside.length === 0) t.diagnostic('this machine has no address besides the loopback one, so only the bound address was checked');
});

test('a taken port is an error, and --port 0 means a free one', async (t) => {
  const { server } = await start(t);
  await assert.rejects(startUiServer({ report, sources: {}, sessionFile: sessionFileFor(t), port: server.port }), { code: 'EADDRINUSE' });
  const { server: free } = await start(t, { port: 0 });
  assert.ok(free.port > 0);
});

test('an API call with no token or a wrong token gets 403, and the right token gets the data', async (t) => {
  const { server } = await start(t);
  for (const token of [null, '', 'wrong', server.token.slice(1), `${server.token}0`, server.token.toUpperCase()]) {
    for (const [method, target] of [['GET', '/api/report'], ['GET', '/api/session'], ['GET', '/api/prompt'], ['PUT', `/api/session/tests/${failing.id}`], ['POST', '/api/finish'], ['GET', '/api/nothing']]) {
      const answer = await call(server, method, target, { token, body: method === 'GET' ? undefined : { decision: 'approved' } });
      assert.deepEqual([answer.status, answer.json], [403, { error: 'the X-QCR-Token header is missing or wrong' }], `${method} ${target} with ${token}`);
    }
  }
  // The token in the address is not enough: it must come as the header.
  assert.equal((await call(server, 'GET', `/api/report?t=${server.token}`, { token: null })).status, 403);
  assert.equal((await call(server, 'GET', '/api/session')).status, 200);
  // None of the refused calls changed or finished anything.
  assert.equal((await call(server, 'GET', '/api/session')).json.tests[failing.id].decision, 'pending');
});

test('a request that names another host is refused, for the page and for the API', async (t) => {
  const { server } = await start(t);
  for (const host of ['example.test', `example.test:${server.port}`, '127.0.0.1', `127.0.0.1:${server.port + 1}`, `127.0.0.1.example.test:${server.port}`, `[::1]:${server.port}`, `0.0.0.0:${server.port}`]) {
    for (const target of ['/', '/app.js', '/api/report']) {
      const answer = await call(server, 'GET', target, { host });
      assert.deepEqual([answer.status, answer.json], [403, { error: 'this server answers only as 127.0.0.1 or localhost' }], `${target} as ${host}`);
    }
  }
  // A request with no Host header at all never reaches the page or the API: node answers it with 400.
  assert.equal((await call(server, 'GET', '/api/session', { host: null })).status, 400);
  assert.equal((await call(server, 'GET', '/api/session', { host: `localhost:${server.port}` })).status, 200);
  assert.equal((await call(server, 'GET', '/api/session', { host: `127.0.0.1:${server.port}` })).status, 200);
});

test('every answer forbids outside resources and content sniffing', async (t) => {
  const { server } = await start(t);
  const answers = [
    await call(server, 'GET', '/api/report'), await call(server, 'GET', '/api/prompt'), await call(server, 'GET', '/api/report', { token: null }),
    await call(server, 'GET', '/missing.js'), await call(server, 'GET', '/', { host: 'example.test' }), await call(server, 'PUT', '/api/session/general', { body: '{' }),
  ];
  assert.deepEqual(answers.map((answer) => answer.status), [200, 200, 403, 404, 403, 400]);
  for (const answer of answers) {
    assert.equal(answer.headers['content-security-policy'], "default-src 'self'");
    assert.equal(answer.headers['x-content-type-options'], 'nosniff');
    assert.equal(answer.headers['cache-control'], 'no-store');
    assert.equal(answer.headers['access-control-allow-origin'], undefined);
  }
});

test('only the files of the page are served, and only for reading', async (t) => {
  const { server } = await start(t);
  for (const target of ['/package.json', '/ui/app.js', '/../package.json', '/%2e%2e/package.json', '/app.js/', '/session.json', '/icon.png']) {
    assert.equal((await call(server, 'GET', target, { token: null })).status, 404, target);
  }
  for (const method of ['POST', 'PUT', 'DELETE']) assert.equal((await call(server, method, '/app.js', { token: null })).status, 405);
  // The icon a browser asks for on its own: there is none, which is said with no error.
  const icon = await call(server, 'GET', '/favicon.ico', { token: null });
  assert.deepEqual([icon.status, icon.text], [204, '']);
});

test('GET /api/report is the report with the source of its files, and GET /api/session is the session', async (t) => {
  const { server, sessionFile } = await start(t);
  const answer = await call(server, 'GET', '/api/report');
  assert.equal(answer.headers['content-type'], 'application/json; charset=utf-8');
  assert.deepEqual(answer.json, { ...JSON.parse(JSON.stringify(report)), sources: SOURCES });
  const session = (await call(server, 'GET', '/api/session')).json;
  assert.deepEqual([session.schemaVersion, session.reportCreatedAt, Object.keys(session.tests).length, session.outcome], [1, report.createdAt, 5, null]);
  // The session file is there from the start.
  assert.deepEqual(readSession(sessionFile), session);
});

test('every change is answered with the session and is in session.json at once', async (t) => {
  const { server, sessionFile } = await start(t);
  const first = await call(server, 'PUT', `/api/session/tests/${failing.id}`, { body: { decision: 'rejected', comment: 'Check the cart badge.' } });
  assert.equal(first.status, 200);
  assert.deepEqual([first.json.tests[failing.id].decision, first.json.tests[failing.id].comment], ['rejected', 'Check the cart badge.']);
  assert.deepEqual(readSession(sessionFile), first.json);

  const second = await call(server, 'PUT', `/api/session/findings/${warnId}`, { body: { testId: failing.id, dismissed: true, comment: 'Fine here.' } });
  assert.deepEqual(second.json.tests[failing.id].findings[warnId], { dismissed: true, comment: 'Fine here.' });
  assert.deepEqual(readSession(sessionFile), second.json);

  // The id of the item for a whole file has a colon and slashes in it, so it is sent encoded.
  const fileItem = encodeURIComponent('file:tests/cart.spec.ts');
  const third = await call(server, 'PUT', `/api/session/tests/${fileItem}`, { body: { comment: 'Add a test for an empty cart.' } });
  assert.deepEqual([third.status, third.json.tests['file:tests/cart.spec.ts'].comment, third.json.tests['file:tests/cart.spec.ts'].decision], [200, 'Add a test for an empty cart.', 'pending']);

  const fourth = await call(server, 'PUT', '/api/session/general', { body: { comment: 'Prefer test ids.' } });
  assert.equal(fourth.json.generalComment, 'Prefer test ids.');
  assert.deepEqual(readSession(sessionFile), (await call(server, 'GET', '/api/session')).json);
  assert.deepEqual(readSession(sessionFile), fourth.json);
});

test('a bad request is answered with 400, 404, 405 or 413 and changes nothing', async (t) => {
  const { server, sessionFile } = await start(t);
  const before = fs.readFileSync(sessionFile, 'utf8');
  const cases = [
    ['PUT', `/api/session/tests/${failing.id}`, '{ "decision": ', 400, 'the request body is not valid JSON'],
    ['PUT', `/api/session/tests/${failing.id}`, '', 400, 'the request body is not valid JSON'],
    ['PUT', `/api/session/tests/${failing.id}`, { decision: 'maybe' }, 400, 'decision must be one of: pending, approved, rejected'],
    ['PUT', `/api/session/tests/${failing.id}`, 'null', 400, 'the body must be an object'],
    ['PUT', '/api/session/tests/nope', { decision: 'approved' }, 404, 'unknown test id: nope'],
    ['PUT', '/api/session/tests/%E0%A4%A', { decision: 'approved' }, 400, 'URI malformed'],
    ['PUT', `/api/session/findings/${warnId}`, { testId: passing.id, dismissed: true }, 404, `unknown finding id for this test: ${warnId}`],
    ['PUT', `/api/session/findings/${errorId}`, { testId: failing.id, dismissed: 1 }, 400, 'dismissed must be true or false'],
    ['PUT', '/api/session/general', { text: 'x' }, 400, 'comment must be a string'],
    ['PUT', '/api/session/general', Buffer.alloc(MAX_BODY_BYTES + 1, 0x20), 413, 'the request body is larger than 1 MB'],
    ['POST', '/api/finish', 'finish', 400, 'the request body is not valid JSON'],
    ['POST', '/api/report', {}, 405, 'no such API call'],
    ['DELETE', '/api/session', undefined, 405, 'no such API call'],
    ['GET', '/api/finish', undefined, 405, 'no such API call'],
    ['GET', '/api/session/tests', undefined, 405, 'no such API call'],
    ['GET', '/api/tests', undefined, 404, 'no such API call'],
  ];
  for (const [method, target, body, status, error] of cases) {
    const answer = await call(server, method, target, { body });
    assert.deepEqual([answer.status, answer.json], [status, { error }], `${method} ${target}`);
  }
  assert.equal(fs.readFileSync(sessionFile, 'utf8'), before);
  // A body of exactly 1 MB is still read.
  const comment = 'x'.repeat(MAX_BODY_BYTES - '{"comment":""}'.length);
  assert.equal((await call(server, 'PUT', '/api/session/general', { body: { comment } })).status, 200);
});

test('decisions and comments survive a restart, and ids that the new report does not have are dropped', async (t) => {
  const { server, sessionFile } = await start(t);
  await call(server, 'PUT', `/api/session/tests/${failing.id}`, { body: { decision: 'rejected', comment: 'Check the cart badge.' } });
  await call(server, 'PUT', `/api/session/tests/${passing.id}`, { body: { decision: 'approved' } });
  await call(server, 'PUT', `/api/session/findings/${warnId}`, { body: { testId: failing.id, dismissed: true, comment: 'Fine here.' } });
  await call(server, 'PUT', '/api/session/general', { body: { comment: 'Prefer test ids.' } });
  await server.close();
  assert.notEqual(await connect('127.0.0.1', server.port), 'open');

  // The same report again, as after a page refresh or a second `ui` run with no change in the code.
  const { server: again } = await start(t, { sessionFile });
  const kept = (await call(again, 'GET', '/api/session')).json;
  assert.deepEqual(kept.tests[failing.id], { decision: 'rejected', comment: 'Check the cart badge.', findings: { [errorId]: { dismissed: false, comment: '' }, [warnId]: { dismissed: true, comment: 'Fine here.' } } });
  assert.deepEqual([kept.tests[passing.id].decision, kept.generalComment], ['approved', 'Prefer test ids.']);
  assert.notEqual(again.token, server.token);
  await again.close();

  // A later run: the passing test was deleted and the hard wait of the failing test was fixed.
  const later = {
    ...report, createdAt: '2026-11-28T08:00:00.000Z',
    files: report.files.map((file) => ({ ...file, tests: file.tests.filter((entry) => entry.id !== passing.id) })),
    findings: report.findings.filter((entry) => entry.id !== warnId),
  };
  const { server: third } = await start(t, { sessionFile, report: later });
  const restored = (await call(third, 'GET', '/api/session')).json;
  assert.deepEqual(restored.tests[failing.id], { decision: 'rejected', comment: 'Check the cart badge.', findings: { [errorId]: { dismissed: false, comment: '' } } });
  assert.equal(Object.hasOwn(restored.tests, passing.id), false);
  assert.equal(restored.reportCreatedAt, '2026-11-28T08:00:00.000Z');
  assert.deepEqual(readSession(sessionFile), restored);
});

test('a session file that is not JSON does not stop the server: the review starts fresh', async (t) => {
  const sessionFile = sessionFileFor(t);
  fs.mkdirSync(sessionFile.slice(0, -'/session.json'.length), { recursive: true });
  fs.writeFileSync(sessionFile, 'not json');
  const { server } = await start(t, { sessionFile });
  assert.equal((await call(server, 'GET', '/api/session')).json.tests[failing.id].decision, 'pending');
  assert.equal(readSession(sessionFile).schemaVersion, 1);
});

test('POST /api/finish gives the outcome, marks the session finished and stops the server', async (t) => {
  const { server, sessionFile } = await start(t);
  const answer = await call(server, 'POST', '/api/finish', { body: {} });
  // The failing test still has its error and nobody approved it.
  assert.deepEqual([answer.status, answer.json], [200, { outcome: 'changes-requested', prompt: '', path: null }]);
  assert.deepEqual(await server.finished, { outcome: 'changes-requested', prompt: '', path: null });
  const saved = readSession(sessionFile);
  assert.equal(saved.outcome, 'changes-requested');
  assert.ok(Math.abs(Date.parse(saved.finishedAt) - Date.now()) < 60_000);
  await server.close();
  assert.notEqual(await connect('127.0.0.1', server.port), 'open');

  // A second run of the same review: the error is dismissed, so the outcome is approved.
  const { server: again } = await start(t, { sessionFile });
  assert.deepEqual([(await call(again, 'GET', '/api/session')).json.outcome, readSession(sessionFile).finishedAt], [null, null]);
  await call(again, 'PUT', `/api/session/findings/${errorId}`, { body: { testId: failing.id, dismissed: true } });
  assert.equal((await call(again, 'POST', '/api/finish', { body: {} })).json.outcome, 'approved');
  assert.equal((await again.finished).outcome, 'approved');
  assert.equal(readSession(sessionFile).outcome, 'approved');
});

test('the prompt comes from the feedback function when there is one, for the preview and for Finish', async (t) => {
  const seen = [];
  const { server } = await start(t, {
    feedback: (givenReport, session, outcome) => {
      seen.push([givenReport === report, session.tests[failing.id].decision, outcome]);
      return { prompt: `Outcome: ${outcome}\n`, path: '.qa-core/review/feedback.md' };
    },
  });
  // With no feedback function (until the feedback prompt is added) the preview is empty text.
  const { server: plain } = await start(t);
  const empty = await call(plain, 'GET', '/api/prompt');
  assert.deepEqual([empty.status, empty.headers['content-type'], empty.text], [200, 'text/plain; charset=utf-8', '']);

  assert.equal((await call(server, 'GET', '/api/prompt')).text, 'Outcome: changes-requested\n');
  await call(server, 'PUT', `/api/session/tests/${failing.id}`, { body: { decision: 'approved' } });
  assert.deepEqual((await call(server, 'POST', '/api/finish', { body: {} })).json, { outcome: 'approved', prompt: 'Outcome: approved\n', path: '.qa-core/review/feedback.md' });
  assert.deepEqual(seen, [[true, 'pending', 'changes-requested'], [true, 'approved', 'approved']]);
});

test('the server stops by itself after the idle time with no request, and a request starts the time again', async (t) => {
  assert.equal(IDLE_MS, 2 * 60 * 60 * 1000);
  const { server } = await start(t, { idleMs: 400 });
  const started = Date.now();
  await new Promise((resolve) => setTimeout(resolve, 250));
  assert.equal((await call(server, 'GET', '/api/session')).status, 200);
  assert.equal(await server.finished, null);
  const lasted = Date.now() - started;
  assert.ok(lasted >= 600, `stopped after ${lasted} ms, before the idle time had passed since the last request`);
  assert.notEqual(await connect('127.0.0.1', server.port), 'open');
});

test('close() stops the server and resolves the wait with null, and may be called twice', async (t) => {
  const { server } = await start(t);
  await server.close();
  assert.equal(await server.finished, null);
  await server.close();
  assert.notEqual(await connect('127.0.0.1', server.port), 'open');
});
