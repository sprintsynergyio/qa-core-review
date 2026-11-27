// action.yml and the workflows (SPEC.md Section 14.3). The first tests read the files. The
// last ones run the shell of the action's steps, the way the runner does (bash --noprofile
// --norc -eo pipefail), in a temp git repo and against a fake GitHub API on this machine.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { parse } from 'yaml';
import { cleanEnv, cliPath, fakeGitHub, runAsync } from './helpers/fake-github.mjs';
import { repoRoot } from './helpers/schema.mjs';

const read = (...segments) => fs.readFileSync(path.join(repoRoot, ...segments), 'utf8');
const action = parse(read('action.yml'));
const workflowNames = fs.readdirSync(path.join(repoRoot, '.github', 'workflows')).filter((name) => name.endsWith('.yml')).sort();
const workflows = workflowNames.map((name) => [name, parse(read('.github', 'workflows', name))]);
const steps = action.runs.steps;
const stepNamed = (name) => steps.find((step) => step.name === name);

/** Every value under a key, at any depth. */
function valuesOf(node, key, found = []) {
  if (Array.isArray(node)) node.forEach((item) => valuesOf(item, key, found));
  else if (node !== null && typeof node === 'object') {
    for (const [name, value] of Object.entries(node)) {
      if (name === key) found.push(value);
      valuesOf(value, key, found);
    }
  }
  return found;
}

test('no run block of the action or of a workflow holds an expression', () => {
  const blocks = [['action.yml', action], ...workflows].flatMap(([file, document]) => valuesOf(document, 'run').map((script) => [file, script]));
  // The action has 5 run steps. A count that drops means the test stopped reading them.
  assert.equal(blocks.filter(([file]) => file === 'action.yml').length, 5);
  assert.ok(blocks.length >= 7);
  assert.deepEqual(blocks.filter(([, script]) => typeof script !== 'string' || script.includes('${{')), []);
});

test('inputs reach a run block only through the env of its step', () => {
  const runSteps = steps.filter((step) => step.run !== undefined);
  const used = runSteps.map((step) => [...new Set(step.run.match(/\bQCR_[A-Z_]+/g) ?? [])].sort());
  const declared = runSteps.map((step) => Object.keys(step.env ?? {}).filter((name) => name.startsWith('QCR_')).sort());
  assert.deepEqual(used, declared);
  // Every input is read somewhere: in an env, an if or a with of a step.
  const text = JSON.stringify(steps);
  assert.deepEqual(Object.keys(action.inputs).filter((name) => !text.includes(`inputs.${name} `) && !text.includes(`inputs.${name}}`)), []);
  // The token is given to the comment step and to no other step.
  assert.deepEqual(steps.filter((step) => JSON.stringify(step).includes('github-token')).map((step) => step.name), ['Comment on the pull request']);
  assert.deepEqual(runSteps.map((step) => step.shell), runSteps.map(() => 'bash'));
});

test('the inputs and their defaults are the documented ones', () => {
  assert.equal(action.runs.using, 'composite');
  assert.deepEqual(Object.fromEntries(Object.entries(action.inputs).map(([name, input]) => [name, input.default])), {
    'base-ref': '', paths: '', 'fail-on': 'error', comment: 'true', 'github-token': '${{ github.token }}', 'comment-author': 'github-actions[bot]',
    sarif: 'false', junit: 'false', version: '', 'node-version': '22', cli: '',
  });
  assert.deepEqual(Object.values(action.inputs).filter((input) => typeof input.description !== 'string' || input.description.length < 20 || input.required !== false), []);
  assert.deepEqual(Object.keys(action.outputs), ['exit-code']);
  // docs/github-action.md has a row for every input.
  const docs = read('docs', 'github-action.md');
  assert.deepEqual(Object.keys(action.inputs).filter((name) => !docs.includes(`| \`${name}\` |`)), []);
});

test('every action that is used is one of four, at a major version, and nothing publishes', () => {
  const used = [['action.yml', action], ...workflows].flatMap(([, document]) => valuesOf(document, 'uses'));
  assert.deepEqual([...new Set(used)].sort(), ['./', 'actions/checkout@v7', 'actions/setup-node@v7', 'actions/upload-artifact@v7', 'github/codeql-action/upload-sarif@v4']);
  const scripts = [['action.yml', action], ...workflows].flatMap(([, document]) => valuesOf(document, 'run')).join('\n');
  assert.doesNotMatch(scripts, /npm publish|docker push|git push|git tag|gh release/);
  // The self review only reads the repo and writes pull request comments.
  const self = workflows.find(([name]) => name === 'self-review.yml')[1];
  assert.deepEqual([Object.keys(self.on), self.permissions], [['pull_request'], { contents: 'read', 'pull-requests': 'write' }]);
  const own = self.jobs.review.steps.find((step) => step.uses === './');
  assert.deepEqual(own.with, { cli: 'dist/cli.js', 'fail-on': 'never', paths: 'tests/*.test.mjs\ntests/adapters/*.test.mjs\n' });
});

test('the steps run in the documented order, and an upload runs only when the review wrote its file', () => {
  assert.deepEqual(steps.map((step) => step.name), [
    'Check Node', 'Set up Node', 'Review the tests', 'Add the report to the job summary', 'Comment on the pull request',
    'Upload SARIF to code scanning', 'Upload the report', 'Result',
  ]);
  assert.deepEqual([stepNamed('Review the tests').id, action.outputs['exit-code'].value], ['review', '${{ steps.review.outputs.exit-code }}']);
  assert.equal(stepNamed('Comment on the pull request').if, "inputs.comment == 'true'");
  assert.deepEqual([stepNamed('Upload SARIF to code scanning').if, stepNamed('Upload the report').if], ["inputs.sarif == 'true' && steps.review.outputs.sarif == 'true'", "steps.review.outputs.report == 'true'"]);
  // The report folder starts with a dot, and the upload leaves such folders out unless it is told not to.
  assert.deepEqual(stepNamed('Upload the report').with, { name: 'qa-core-review-report', path: '.qa-core/review/', 'include-hidden-files': true, 'if-no-files-found': 'ignore', overwrite: true });
});

// The steps are bash. On Windows the tests have no bash they can count on, so these run on Linux and macOS.
const BASH = '/bin/bash';
const needsBash = process.platform !== 'win32' && fs.existsSync(BASH) ? {} : { skip: 'needs /bin/bash (Linux or macOS)' };
const hasGit = spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0;
const needsBashAndGit = needsBash.skip ? needsBash : hasGit ? {} : { skip: 'git is not installed' };

function tempDir(t, prefix) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/** Runs the script of one step the way the runner does, and gives back what it wrote to GITHUB_OUTPUT. */
async function runStep(t, name, { env = {}, cwd, pathDirs } = {}) {
  const step = stepNamed(name);
  const scratch = tempDir(t, 'qcr-step-');
  const script = path.join(scratch, 'step.sh');
  fs.writeFileSync(script, step.run);
  const files = { GITHUB_OUTPUT: path.join(scratch, 'output'), GITHUB_STEP_SUMMARY: path.join(scratch, 'summary') };
  for (const file of Object.values(files)) fs.writeFileSync(file, '');
  const base = cleanEnv({ ...files, ...env });
  if (pathDirs) base.PATH = pathDirs.join(path.delimiter);
  const ran = await runAsync(BASH, ['--noprofile', '--norc', '-eo', 'pipefail', script], { env: base, cwd: cwd ?? scratch });
  const output = Object.fromEntries(fs.readFileSync(files.GITHUB_OUTPUT, 'utf8').split('\n').filter((line) => line !== '').map((line) => line.split(/=(.*)/s).slice(0, 2)));
  return { ...ran, output, summary: fs.readFileSync(files.GITHUB_STEP_SUMMARY, 'utf8') };
}

test('the Node setup step is skipped when Node 22.6 or later is there', needsBash, async (t) => {
  const setup = stepNamed('Set up Node');
  assert.deepEqual([setup.if, setup.uses, setup.with], ["steps.node.outputs.setup == 'true'", 'actions/setup-node@v7', { 'node-version': '${{ inputs.node-version }}' }]);
  assert.equal(stepNamed('Check Node').id, 'node');

  /** The answer of the check with a fake `node` that prints `version`, or with no node at all. */
  const check = async (version) => {
    const bin = tempDir(t, 'qcr-node-');
    if (version !== null) fs.writeFileSync(path.join(bin, 'node'), `#!/bin/sh\necho "${version}"\n`, { mode: 0o755 });
    const ran = await runStep(t, 'Check Node', { pathDirs: [bin] });
    assert.equal(ran.status, 0, ran.stderr);
    return ran.output.setup;
  };
  const versions = ['v22.6.0', 'v22.12.1', 'v24.0.0', 'v100.1.0', 'v22.5.9', 'v20.19.0', 'v18.20.4', 'v9.11.2', 'not a version', '', null];
  const answers = [];
  for (const version of versions) answers.push(await check(version));
  assert.deepEqual(answers, ['false', 'false', 'false', 'false', 'true', 'true', 'true', 'true', 'true', 'true', 'true']);
});

const GOOD = `import { expect, test } from '@playwright/test';

test('opens the cart', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/cart.html');
  await expect(page.getByTestId('cart-list')).toBeVisible();
});
`;
const BAD = `import { expect, test } from '@playwright/test';

test('adds an item', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');
  await page.waitForTimeout(3000);
});
`;

/** A repo with a good test on main and a branch that adds a bad one, in tests/ and again in other/. */
function makeRepo(t) {
  const dir = tempDir(t, 'qcr-action-');
  const git = (...args) => {
    const ran = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
    assert.equal(ran.status, 0, `git ${args.join(' ')}: ${ran.stderr}`);
  };
  const write = (file, text) => {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), text);
  };
  git('init', '--quiet', '--initial-branch=main');
  git('config', 'user.name', 'Test');
  git('config', 'user.email', 'test@example.test');
  write('package.json', JSON.stringify({ devDependencies: { '@playwright/test': '1.49.0' } }));
  write('tests/cart.spec.ts', GOOD);
  git('add', '.');
  git('commit', '--quiet', '-m', 'base');
  git('switch', '--quiet', '-c', 'feature');
  write('tests/add.spec.ts', BAD);
  write('other/with space/add.spec.ts', BAD);
  git('add', '.');
  git('commit', '--quiet', '-m', 'adds a test');
  return dir;
}

const reviewEnv = (extra = {}) => ({ QCR_ACTION_PATH: repoRoot, QCR_BASE_REF: 'main', QCR_CLI: cliPath, QCR_FAIL_ON: 'error', QCR_JUNIT: 'false', QCR_PATHS: '', QCR_SARIF: 'false', QCR_VERSION: '', ...extra });
const reportFiles = (dir) => (fs.existsSync(path.join(dir, '.qa-core', 'review')) ? fs.readdirSync(path.join(dir, '.qa-core', 'review')).sort() : []);

test('the steps of the action: review, job summary, comment and the exit code', needsBashAndGit, async (t) => {
  const repo = makeRepo(t);
  const api = await fakeGitHub(t);
  const event = path.join(tempDir(t, 'qcr-event-'), 'event.json');
  fs.writeFileSync(event, JSON.stringify({ pull_request: { number: 4, head: { repo: { full_name: 'example-org/shop' } } } }));

  // Review: only the tests the branch changed, and the exit code is kept, not thrown.
  const review = await runStep(t, 'Review the tests', { cwd: repo, env: reviewEnv() });
  assert.deepEqual([review.status, review.stderr], [0, '']);
  assert.deepEqual(review.output, { version: '', 'exit-code': '1', report: 'true' });
  assert.match(review.stdout, /^Summary: 0 pass, 0 review, 2 fail\. /);
  assert.deepEqual(reportFiles(repo), ['report.json', 'report.md']);
  const report = JSON.parse(fs.readFileSync(path.join(repo, '.qa-core', 'review', 'report.json'), 'utf8'));
  assert.deepEqual([report.mode.diffBase, report.files.map((file) => file.file)], ['main', ['other/with space/add.spec.ts', 'tests/add.spec.ts']]);

  // Job summary: the Markdown report.
  const summary = await runStep(t, 'Add the report to the job summary', { cwd: repo });
  assert.equal(summary.status, 0);
  assert.equal(summary.summary, fs.readFileSync(path.join(repo, '.qa-core', 'review', 'report.md'), 'utf8'));
  assert.match(summary.summary, /^<!-- qa-core-review -->\n## Test review\n\n2 tests need changes/);

  // Comment: created on the first run, updated on the second.
  const commentEnv = { GITHUB_TOKEN: 'test-token-not-a-real-one', QCR_CLI: cliPath, QCR_COMMENT_AUTHOR: 'github-actions[bot]', QCR_VERSION: '', GITHUB_REPOSITORY: 'example-org/shop', GITHUB_EVENT_PATH: event, GITHUB_API_URL: api.url, GITHUB_ACTIONS: 'true' };
  const first = await runStep(t, 'Comment on the pull request', { cwd: repo, env: commentEnv });
  assert.deepEqual([first.status, first.stderr], [0, '']);
  assert.match(first.stdout, /^qa-core-review: Posted the review comment on pull request #4/);
  assert.equal(api.comments.length, 1);
  assert.equal(api.comments[0].body, summary.summary);

  // Paths, one per line: a space belongs to the path. And the two extra formats.
  const narrow = await runStep(t, 'Review the tests', { cwd: repo, env: reviewEnv({ QCR_PATHS: '\n  other/with space  \n\n', QCR_SARIF: 'true', QCR_JUNIT: 'true', QCR_FAIL_ON: 'never' }) });
  assert.deepEqual([narrow.status, narrow.stderr, narrow.output], [0, '', { version: '', 'exit-code': '0', report: 'true', sarif: 'true' }]);
  assert.match(narrow.stdout, /^Summary: 0 pass, 0 review, 1 fail\. /);
  assert.deepEqual(reportFiles(repo), ['report.json', 'report.junit.xml', 'report.md', 'report.sarif']);
  const second = await runStep(t, 'Comment on the pull request', { cwd: repo, env: commentEnv });
  assert.match(second.stdout, /^qa-core-review: Updated the review comment on pull request #4/);
  assert.equal(api.comments.length, 1);
  assert.match(api.comments[0].body, /\n1 test needs changes, 0 need review, 0 pass\./);

  // The last step ends the job with the exit code of the review.
  const result = async (code) => (await runStep(t, 'Result', { env: code === undefined ? {} : { QCR_EXIT_CODE: code } })).status;
  assert.deepEqual([await result('0'), await result('1'), await result('2'), await result('')], [0, 1, 2, 3]);
});

test('the steps of the action when things go wrong: a usage error, no base, and a comment that fails', needsBashAndGit, async (t) => {
  const repo = makeRepo(t);

  // A wrong fail-on is a usage error of the review. The reports of the run before are gone, so nothing old is posted.
  const before = await runStep(t, 'Review the tests', { cwd: repo, env: reviewEnv({ QCR_FAIL_ON: 'never' }) });
  assert.deepEqual([before.output['exit-code'], reportFiles(repo)], ['0', ['report.json', 'report.md']]);
  const wrong = await runStep(t, 'Review the tests', { cwd: repo, env: reviewEnv({ QCR_FAIL_ON: 'sometimes' }) });
  assert.deepEqual([wrong.status, wrong.output, reportFiles(repo)], [0, { version: '', 'exit-code': '2' }, []]);
  assert.match(wrong.stderr, /^qa-core-review: --fail-on must be error, warn, info or never, not "sometimes"/);
  const summary = await runStep(t, 'Add the report to the job summary', { cwd: repo });
  assert.deepEqual([summary.status, summary.summary], [0, '']);
  const skipped = await runStep(t, 'Comment on the pull request', { cwd: repo, env: { GITHUB_TOKEN: 'test-token-not-a-real-one', QCR_CLI: cliPath, QCR_COMMENT_AUTHOR: 'github-actions[bot]', QCR_VERSION: '' } });
  assert.deepEqual([skipped.status, skipped.stdout], [0, '::notice title=qa-core-review::The review wrote no report, so there is no comment to post.\n']);

  // No base ref and no pull request: every test file is reviewed, with a notice.
  const whole = await runStep(t, 'Review the tests', { cwd: repo, env: reviewEnv({ QCR_BASE_REF: '', QCR_FAIL_ON: 'never' }) });
  assert.match(whole.stdout, /^::notice title=qa-core-review::This run has no base branch, so every test file is reviewed, not only the changed ones\.\nSummary: 1 pass, 0 review, 2 fail\. /);
  // In a pull request run the base is origin/ plus the base branch. This repo has no remote, so git does not know it: exit 2.
  const pull = await runStep(t, 'Review the tests', { cwd: repo, env: reviewEnv({ QCR_BASE_REF: '', GITHUB_BASE_REF: 'main' }) });
  assert.equal(pull.output['exit-code'], '2');
  assert.match(pull.stderr, /origin\/main/);

  // A comment that cannot be posted is a warning. The step does not fail.
  await runStep(t, 'Review the tests', { cwd: repo, env: reviewEnv() });
  const failing = await runStep(t, 'Comment on the pull request', { cwd: repo, env: { GITHUB_TOKEN: '', QCR_CLI: cliPath, QCR_COMMENT_AUTHOR: 'github-actions[bot]', QCR_VERSION: '', GITHUB_REPOSITORY: 'example-org/shop' } });
  assert.equal(failing.status, 0);
  assert.match(failing.stderr, /^qa-core-review: GITHUB_EVENT_PATH is not set/);
  assert.equal(failing.stdout, '::warning title=qa-core-review::The pull request comment was not posted. The result of the review is not affected.\n');
});

test('without the cli input the action runs the npm package at the version of the action', needsBash, async (t) => {
  // A fake npx and a fake node: the first records how it was called, the second answers the version question.
  const bin = tempDir(t, 'qcr-npx-');
  const log = path.join(bin, 'calls.txt');
  fs.writeFileSync(path.join(bin, 'npx'), `#!/bin/sh\nfor arg in "$@"; do printf '[%s]' "$arg" >> "${log}"; done\nprintf '\\n' >> "${log}"\nexit 1\n`, { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'node'), `#!/bin/sh\nexec "${process.execPath}" "$@"\n`, { mode: 0o755 });
  const pathDirs = [bin, '/usr/bin', '/bin'];
  const version = JSON.parse(read('package.json')).version;

  const own = await runStep(t, 'Review the tests', { env: reviewEnv({ QCR_CLI: '', QCR_BASE_REF: 'main', QCR_PATHS: 'tests/*.spec.ts' }), pathDirs });
  assert.deepEqual([own.status, own.output], [0, { version, 'exit-code': '1' }]);
  const pinned = await runStep(t, 'Review the tests', { env: reviewEnv({ QCR_CLI: '', QCR_VERSION: '0.1.0', QCR_BASE_REF: '' }), pathDirs });
  assert.deepEqual(pinned.output, { version: '0.1.0', 'exit-code': '1' });
  assert.deepEqual(fs.readFileSync(log, 'utf8').split('\n'), [
    `[--yes][qa-core-review@${version}][review][--format][json,markdown][--output][.qa-core/review][--fail-on][error][--diff][main][--][tests/*.spec.ts]`,
    '[--yes][qa-core-review@0.1.0][review][--format][json,markdown][--output][.qa-core/review][--fail-on][error]',
    '',
  ]);
});
