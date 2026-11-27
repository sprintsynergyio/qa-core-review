// The `comment` command and src/integrations/github.ts (SPEC.md Section 14.3), against a fake
// GitHub API on this machine (tests/helpers/fake-github.mjs). The real API is never called.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { BOT, fakeGitHub, runCli } from './helpers/fake-github.mjs';
import { repoRoot } from './helpers/schema.mjs';
import { reviewFiles } from './helpers/temp-project.mjs';

const { apiBase, pullRequestOf, upsertComment, GitHubError, GitHubSetupError } = await import(pathToFileURL(path.join(repoRoot, 'dist', 'integrations', 'github.js')).href);
const { formatMarkdown, MARKDOWN_MARKER } = await import(pathToFileURL(path.join(repoRoot, 'dist', 'index.js')).href);

const REPO = 'example-org/shop';
const TOKEN = 'test-token-not-a-real-one';
const BAD_SPEC = `
import { test, expect } from '@playwright/test';

test('adds an item to the cart', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');
  await page.waitForTimeout(3000);
});
`;
const GOOD_SPEC = `
import { test, expect } from '@playwright/test';

test('adds an item to the cart', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');
  await expect(page.getByTestId('cart-badge')).toHaveText('1');
});
`;
const reportOf = async (source) => (await reviewFiles({ 'tests/cart.spec.ts': source }, { dependencies: { '@playwright/test': '1.49.0' } })).report;
const badReport = await reportOf(BAD_SPEC);
const goodReport = await reportOf(GOOD_SPEC);

const pullEvent = (number, head = REPO) => ({ pull_request: { number, head: { repo: head === null ? null : { full_name: head } }, base: { repo: { full_name: REPO } } } });

/** A folder with report.json and event.json, and the environment a workflow run would give the command. */
function workspace(t, api, { report = badReport, event = pullEvent(7), env = {} } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcr-comment-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const reportFile = path.join(dir, 'report.json');
  fs.writeFileSync(reportFile, JSON.stringify(report));
  fs.writeFileSync(path.join(dir, 'event.json'), JSON.stringify(event));
  const set = (next) => fs.writeFileSync(reportFile, JSON.stringify(next));
  return { dir, reportFile, set, env: { GITHUB_TOKEN: TOKEN, GITHUB_REPOSITORY: REPO, GITHUB_EVENT_PATH: path.join(dir, 'event.json'), GITHUB_API_URL: api?.url ?? 'http://127.0.0.1:9', ...env } };
}
const comment = (space, extra = [], env = {}) => runCli(['comment', '--report', space.reportFile, ...extra], { ...space.env, ...env });
const calls = (api) => api.requests.map((request) => `${request.method} ${request.path}`);

test('comment creates a comment, then updates the same one', async (t) => {
  const api = await fakeGitHub(t);
  const space = workspace(t, api);

  const first = await comment(space);
  assert.deepEqual([first.status, first.stderr], [0, '']);
  assert.match(first.stdout, /^qa-core-review: Posted the review comment on pull request #7: https:\/\/github\.example\.test\/comment\/1\n$/);
  assert.deepEqual(calls(api), ['GET /repos/example-org/shop/issues/7/comments', 'POST /repos/example-org/shop/issues/7/comments']);
  assert.equal(api.comments.length, 1);
  assert.equal(api.comments[0].body, formatMarkdown(badReport, { reportPath: space.reportFile.split('\\').join('/') }));
  assert.match(api.comments[0].body, /^<!-- qa-core-review -->\n## Test review\n\n1 test needs changes, 0 need review, 0 pass\./);

  // The tests were fixed: the next run rewrites the same comment and adds no second one.
  space.set(goodReport);
  const second = await comment(space);
  assert.deepEqual([second.status, second.stderr], [0, '']);
  assert.match(second.stdout, /^qa-core-review: Updated the review comment on pull request #7: /);
  assert.deepEqual(calls(api).slice(2), ['GET /repos/example-org/shop/issues/7/comments', 'PATCH /repos/example-org/shop/issues/comments/1']);
  assert.equal(api.comments.length, 1);
  assert.match(api.comments[0].body, /^<!-- qa-core-review -->\n## Test review\n\nThe 1 test passes review\./);

  // Nothing changed since: the comment is left alone.
  const third = await comment(space);
  assert.match(third.stdout, /^qa-core-review: The review comment already says the same on pull request #7/);
  assert.deepEqual(calls(api).slice(4), ['GET /repos/example-org/shop/issues/7/comments']);
});

test('every request carries the token in the Authorization header, and the token is never printed', async (t) => {
  const api = await fakeGitHub(t);
  const space = workspace(t, api);
  const ran = await comment(space);
  assert.equal(api.requests.length, 2);
  assert.deepEqual(api.requests.map((request) => request.headers.authorization), [`Bearer ${TOKEN}`, `Bearer ${TOKEN}`]);
  assert.match(api.requests[0].headers['user-agent'], /^qa-core-review\/\d+\.\d+\.\d+$/);
  assert.equal(api.requests[0].headers.accept, 'application/vnd.github+json');
  assert.equal(api.requests[0].query, '?per_page=100&page=1');
  assert.equal(`${ran.stdout}${ran.stderr}`.includes(TOKEN), false);
  assert.equal(JSON.stringify(api.comments).includes(TOKEN), false);
});

test('a pull request from a fork is skipped with a notice and no request', async (t) => {
  const api = await fakeGitHub(t);
  const fork = await comment(workspace(t, api, { event: pullEvent(12, 'someone-else/shop') }));
  assert.deepEqual([fork.status, fork.stdout], [0, '']);
  assert.match(fork.stderr, /^qa-core-review: Pull request #12 comes from a fork\. The token of such a run cannot write comments, so the comment is skipped\./);

  // A fork that was deleted has no head repository. No token is needed to find that out.
  const gone = await comment(workspace(t, api, { event: pullEvent(13, null), env: { GITHUB_TOKEN: '' } }));
  assert.equal(gone.status, 0);
  assert.match(gone.stderr, /Pull request #13 comes from a fork/);
  assert.deepEqual(api.requests, []);
});

test('a 403 from GitHub gives a warning and exit 0', async (t) => {
  const refuse = () => ({ status: 403, body: { message: 'Resource not accessible by integration' } });
  const onList = await fakeGitHub(t, { answer: refuse });
  const first = await comment(workspace(t, onList));
  assert.deepEqual([first.status, first.stdout], [0, '']);
  assert.equal(first.stderr, 'qa-core-review: warning: The review comment was not posted: GitHub answered 403: Resource not accessible by integration. The job needs "permissions: pull-requests: write" for the token it passes.\n');

  // The token may read and not write: the list works and the create is refused.
  const onCreate = await fakeGitHub(t, { answer: (request) => (request.method === 'POST' ? refuse() : null) });
  const second = await comment(workspace(t, onCreate));
  assert.equal(second.status, 0);
  assert.match(second.stderr, /^qa-core-review: warning: The review comment was not posted: GitHub answered 403/);
  assert.deepEqual(onCreate.comments, []);
});

test('inside a workflow run the notes are annotations on the run', async (t) => {
  const api = await fakeGitHub(t, { answer: () => ({ status: 403, body: { message: 'No\nwrite 100%' } }) });
  const refused = await comment(workspace(t, api), [], { GITHUB_ACTIONS: 'true' });
  assert.deepEqual([refused.status, refused.stderr], [0, '']);
  assert.match(refused.stdout, /^::warning title=qa-core-review::The review comment was not posted: GitHub answered 403: No write 100%25\. /);

  const push = await comment(workspace(t, api, { event: { ref: 'refs/heads/main' } }), [], { GITHUB_ACTIONS: 'true' });
  assert.deepEqual([push.status, push.stdout], [0, '::notice title=qa-core-review::This run has no pull request, so there is no comment to post.\n']);
});

test('another error from GitHub, or no answer at all, is exit 1 with one line', async (t) => {
  const broken = await fakeGitHub(t, { answer: () => ({ status: 500, body: { message: `Server Error for ${TOKEN}` } }) });
  const failed = await comment(workspace(t, broken));
  assert.deepEqual([failed.status, failed.stdout], [1, '']);
  assert.equal(failed.stderr, 'qa-core-review: the review comment was not posted: GitHub answered 500: Server Error for ***\n');

  const unauthorized = await fakeGitHub(t, { answer: () => ({ status: 401, body: { message: 'Bad credentials' } }) });
  assert.equal((await comment(workspace(t, unauthorized))).status, 1);

  // Port 9 on this machine has no server.
  const unreachable = await comment(workspace(t, null));
  assert.equal(unreachable.status, 1);
  assert.match(unreachable.stderr, /^qa-core-review: the review comment was not posted: could not reach 127\.0\.0\.1:9 \(\w+\)\n$/);
});

test('a comment with the marker by another account is never touched', async (t) => {
  const api = await fakeGitHub(t, { login: 'somebody', comments: [{ body: `${MARKDOWN_MARKER}\nnot ours` }, { body: 'a normal comment' }] });
  // New comments of this fake API are written by "somebody" too, so --author decides what is ours.
  const asBot = await comment(workspace(t, api));
  assert.match(asBot.stdout, /Posted the review comment/);
  assert.deepEqual(api.comments.map((entry) => entry.body.split('\n')[1]), ['not ours', undefined, '## Test review']);

  const asSomebody = await comment(workspace(t, api, { report: goodReport }), ['--author', 'somebody']);
  assert.match(asSomebody.stdout, /Updated the review comment on pull request #7: https:\/\/github\.example\.test\/comment\/1\n/);
  assert.equal(api.comments.length, 3);
  assert.match(api.comments[0].body, /The 1 test passes review/);
});

test('the comment is found on a later page of a long conversation', async (t) => {
  const many = Array.from({ length: 230 }, (_, index) => ({ body: index === 215 ? `${MARKDOWN_MARKER}\nold` : `comment ${index}` }));
  const api = await fakeGitHub(t, { comments: many });
  const ran = await comment(workspace(t, api));
  assert.match(ran.stdout, /Updated the review comment on pull request #7: https:\/\/github\.example\.test\/comment\/216\n/);
  assert.deepEqual(api.requests.map((request) => `${request.method} ${request.query}`), ['GET ?per_page=100&page=1', 'GET ?per_page=100&page=2', 'GET ?per_page=100&page=3', 'PATCH ']);
  assert.equal(api.comments.length, 230);
});

test('usage errors are exit 2 and make no request', async (t) => {
  const api = await fakeGitHub(t);
  const space = workspace(t, api);
  const notReport = path.join(space.dir, 'other.json');
  fs.writeFileSync(notReport, '{"schemaVersion": 1}');
  const hollow = path.join(space.dir, 'hollow.json');
  fs.writeFileSync(hollow, '{"schemaVersion": 2, "files": [{}], "findings": [], "summary": {}, "mode": {}}');
  const notJson = path.join(space.dir, 'broken.json');
  fs.writeFileSync(notJson, '{');

  const cases = [
    [await runCli(['comment'], space.env), /^qa-core-review: comment needs --report <file>, the report\.json of a review\nRun qa-core-review --help\n$/],
    [await runCli(['comment', '--report', path.join(space.dir, 'missing.json')], space.env), /^qa-core-review: cannot read --report: .*missing\.json\n/],
    [await runCli(['comment', '--report', notJson], space.env), /^qa-core-review: --report is not JSON: /],
    [await runCli(['comment', '--report', notReport], space.env), /^qa-core-review: --report is not a report this version can read \(schemaVersion 2\): .*\/other\.json\n/],
    [await runCli(['comment', '--report', hollow], space.env), /^qa-core-review: --report is not a report this version can read/],
    [await runCli(['comment', '--report', space.reportFile, 'extra'], space.env), /^qa-core-review: comment takes no paths \(got "extra"\)/],
    [await runCli(['comment', '--report', space.reportFile, '--diff', 'main'], space.env), /^qa-core-review: Unknown option '--diff'/],
    [await comment(space, [], { GITHUB_TOKEN: '' }), /^qa-core-review: GITHUB_TOKEN is not set\. The comment command runs inside a GitHub Actions job for a pull request\n/],
    [await comment(space, [], { GITHUB_REPOSITORY: '' }), /^qa-core-review: GITHUB_REPOSITORY is not set/],
    [await comment(space, [], { GITHUB_EVENT_PATH: '' }), /^qa-core-review: GITHUB_EVENT_PATH is not set/],
    [await comment(space, [], { GITHUB_EVENT_PATH: path.join(space.dir, 'no-event.json') }), /^qa-core-review: cannot read the event file \(GITHUB_EVENT_PATH\): /],
    [await comment(space, [], { GITHUB_REPOSITORY: 'example-org/shop/../../user' }), /^qa-core-review: GITHUB_REPOSITORY must be owner\/name, not "example-org\/shop\/\.\.\/\.\.\/user"\n/],
    [await comment(space, [], { GITHUB_API_URL: 'http://api.example.test' }), /^qa-core-review: GITHUB_API_URL must start with https:\/\/, not http:\/\/\n/],
    [await comment(space, [], { GITHUB_API_URL: 'not a url' }), /^qa-core-review: GITHUB_API_URL is not a URL: not a url\n/],
  ];
  assert.equal(cases.length, 14);
  assert.deepEqual(cases.map(([ran]) => [ran.status, ran.stdout]), cases.map(() => [2, '']));
  assert.deepEqual(cases.map(([ran, expected]) => expected.test(ran.stderr) || ran.stderr), cases.map(() => true));
  assert.deepEqual(api.requests, []);
});

test('comment --help explains the command and names the token variable', async () => {
  const help = await runCli(['comment', '--help']);
  assert.deepEqual([help.status, help.stderr], [0, '']);
  assert.match(help.stdout, /^Usage: qa-core-review comment --report <file> \[--author <login>\]\n/);
  assert.match(help.stdout, /GITHUB_TOKEN {8}A token that may write pull request comments\. It is sent only to GITHUB_API_URL\./);
  assert.match(help.stdout, /This is the only command that uses the network when LLM mode is off\./);
  const usage = await runCli(['--help']);
  assert.match(usage.stdout, /qa-core-review comment --report <file> {5}Post or update the review comment of a pull request/);
});

test('pullRequestOf reads the number and tells a fork by the head repository', () => {
  assert.deepEqual(pullRequestOf(pullEvent(7), REPO), { number: 7, fork: false });
  assert.deepEqual(pullRequestOf(pullEvent(7, 'Example-Org/Shop'), REPO), { number: 7, fork: false });
  assert.deepEqual(pullRequestOf(pullEvent(8, 'someone-else/shop'), REPO), { number: 8, fork: true });
  assert.deepEqual(pullRequestOf({ pull_request: { number: 9 } }, REPO), { number: 9, fork: true });
  assert.deepEqual([{}, null, [], 'text', { pull_request: null }, { pull_request: { number: '7' } }, { pull_request: { number: 0 } }, { issue: { number: 3 } }].map((event) => pullRequestOf(event, REPO)), [null, null, null, null, null, null, null, null]);
});

test('apiBase takes https addresses, and plain http only for this machine', () => {
  assert.equal(apiBase('https://api.github.com'), 'https://api.github.com');
  assert.equal(apiBase('https://github.example.test/api/v3/'), 'https://github.example.test/api/v3');
  assert.equal(apiBase('http://localhost:8080/'), 'http://localhost:8080');
  assert.equal(apiBase('http://[::1]:8080'), 'http://[::1]:8080');
  assert.throws(() => apiBase('http://api.example.test'), GitHubSetupError);
  assert.throws(() => apiBase('ftp://api.example.test'), /must start with https:\/\//);
  assert.throws(() => apiBase('https://user:secret@api.example.test'), /plain address with no user, query or fragment/);
  assert.throws(() => apiBase('https://api.example.test/?x=1'), GitHubSetupError);
});

test('upsertComment works with a fetch passed in, and reports an answer it cannot use', async () => {
  const seen = [];
  const answers = [[], { id: 5, html_url: 'https://github.example.test/comment/5' }];
  const fetchStub = async (url, init) => {
    seen.push([init.method, url, init.body ?? null]);
    return new Response(JSON.stringify(answers.shift()), { status: 200 });
  };
  const target = { apiUrl: 'https://api.example.test', repository: REPO, number: 3, token: TOKEN, author: BOT, fetch: fetchStub };
  assert.deepEqual(await upsertComment(target, 'hello'), { action: 'created', id: 5, url: 'https://github.example.test/comment/5' });
  assert.deepEqual(seen, [
    ['GET', 'https://api.example.test/repos/example-org/shop/issues/3/comments?per_page=100&page=1', null],
    ['POST', 'https://api.example.test/repos/example-org/shop/issues/3/comments', '{"body":"hello"}'],
  ]);

  const notList = { ...target, fetch: async () => new Response('{"message":"ok"}', { status: 200 }) };
  await assert.rejects(upsertComment(notList, 'hello'), (error) => error instanceof GitHubError && error.status === null && /not a list of comments/.test(error.message));
  const notJson = { ...target, fetch: async () => new Response('<html>busy</html>', { status: 502 }) };
  await assert.rejects(upsertComment(notJson, 'hello'), (error) => error instanceof GitHubError && error.status === 502 && error.message === 'GitHub answered 502');
  const thrown = { ...target, fetch: async () => { throw 'down'; } };
  await assert.rejects(upsertComment(thrown, 'hello'), /could not reach api\.example\.test \(unknown error\)/);
  const empty = { ...target, fetch: async (url, init) => new Response(init.method === 'GET' ? '[]' : '', { status: init.method === 'GET' ? 200 : 201 }) };
  assert.deepEqual(await upsertComment(empty, 'hello'), { action: 'created', id: null, url: '' });
});

test('upsertComment refuses a repository name or an API address it cannot use', async () => {
  const never = async () => assert.fail('no request may be made');
  const target = { apiUrl: 'https://api.example.test', repository: REPO, number: 3, token: TOKEN, author: BOT, fetch: never };
  await assert.rejects(upsertComment({ ...target, repository: 'shop' }, 'hello'), GitHubSetupError);
  await assert.rejects(upsertComment({ ...target, repository: 'example-org/..' }, 'hello'), /must be owner\/name, not "example-org\/\.\."/);
  await assert.rejects(upsertComment({ ...target, apiUrl: 'http://api.example.test' }, 'hello'), GitHubSetupError);
});
