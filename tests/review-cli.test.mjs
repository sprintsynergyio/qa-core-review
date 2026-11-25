// The `review` command (SPEC.md Sections 11.1 to 11.3), run as a child process on dist/cli.js.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { repoRoot, schemaErrors } from './helpers/schema.mjs';

const cliPath = path.join(repoRoot, 'dist', 'cli.js');
const run = (cwd, args, { nodeArgs = [], env = {} } = {}) => spawnSync(process.execPath, [...nodeArgs, cliPath, ...args], { cwd, encoding: 'utf8', windowsHide: true, shell: false, env: { ...process.env, ...env } });
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

/** A temp project with a passing test, a test file with no test in it, and a helper. */
function project(t, extra = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcr-cli-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const files = {
    'package.json': '{ "devDependencies": { "vitest": "^2.0.0" } }', 'src/cart.test.ts': "import { test, expect } from 'vitest';\ntest('adds', () => { expect(1 + 1).toBe(2); });\n",
    'src/empty.test.js': '// to do\n', 'tests/helpers/util.ts': 'export const x = 1;\n', ...extra,
  };
  for (const [name, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), text);
  }
  return dir;
}

test('review on the js-basic fixture writes a valid report.json and prints the text layout, with exit 1 for its error', (t) => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'qcr-out-'));
  t.after(() => fs.rmSync(out, { recursive: true, force: true }));
  const ran = run(repoRoot, ['review', 'fixtures/projects/js-basic', '--output', out]);
  assert.deepEqual([ran.status, ran.stderr], [1, '']);
  const report = readJson(path.join(out, 'report.json'));
  assert.deepEqual(schemaErrors('report.schema.json', report), []);
  assert.deepEqual(report.files.map((file) => [file.file, file.runner, file.tests.length]), [
    ['fixtures/projects/js-basic/src/cart.test.ts', 'jest', 2], ['fixtures/projects/js-basic/tests/checkout.spec.ts', 'playwright', 2], ['fixtures/projects/js-basic/tests/helpers/login.ts', 'playwright', 0],
  ]);
  assert.deepEqual(report.projects, [{ dir: 'fixtures/projects/js-basic', adapter: 'js', frameworks: ['playwright', 'jest'] }]);
  const dot = process.platform === 'win32' && process.env.WT_SESSION === undefined ? '-' : String.fromCharCode(0xb7);
  assert.deepEqual(ran.stdout.split('\n'), [
    `qa-core-review ${report.tool.version} ${dot} 3 files ${dot} 4 tests ${dot} static rules ${dot} TypeScript`, '',
    'fail  fixtures/projects/js-basic/tests/checkout.spec.ts:11  Checkout > opens the cart page',
    '  QCR-A001  error  11:3  This test has no assertion, so it passes whatever the code does.',
    '    Evidence: opens the cart page',
    '    Fix: Add an assertion that checks the result of the action, for example the URL, a visible element or the response body.',
    '  QCR-W001  warn   14:11  Hard wait of 2000 ms.',
    '    Evidence: page.waitForTimeout(2000)',
    '    Fix: Wait for a condition instead: a web-first assertion, an explicit wait (WebDriverWait, waitForResponse) or a polling helper. For timing failures that come and go, see qa-core-flaky.', '',
    'pass  fixtures/projects/js-basic/src/cart.test.ts:4  Cart > adds an item', '',
    'pass  fixtures/projects/js-basic/src/cart.test.ts:11  Cart > starts empty', '',
    'pass  fixtures/projects/js-basic/tests/checkout.spec.ts:5  Checkout > adds a backpack to the cart', '',
    'file  fixtures/projects/js-basic/tests/checkout.spec.ts',
    '  QCR-N001  info   4:1  All 2 tests of "Checkout" are happy paths. Cases to think about: Checkout with an empty cart; Checkout with a missing postal code; Checkout with a payment that is declined.',
    '    Evidence: Checkout',
    '    Fix: Add at least one test for what must not work: bad input, a missing value, or a failure of something the code depends on.', '',
    'Summary: 3 pass, 0 review, 1 fail. 1 error, 1 warning, 1 info. 0 suppressed.', 'By language: TypeScript 4 tests.',
    `Reports: ${path.join(out, 'report.json').split(path.sep).join('/')}`, '',
  ]);
  assert.equal(fs.existsSync(path.join(out, 'model.json')), false);
});

test('exit codes: 0 with nothing at the level, 1 with a finding at the level, and the word "review" can be left out', (t) => {
  const dir = project(t);
  const plain = run(dir, []);
  assert.deepEqual([plain.status, plain.stderr], [0, '']);
  assert.match(plain.stdout, / 3 files . 1 test . static rules . TypeScript, JavaScript\n/);
  assert.match(plain.stdout, /\nSummary: 1 pass, 0 review, 0 fail\. 0 errors, 0 warnings, 1 info\. 0 suppressed\.\nBy language: TypeScript 1 test, JavaScript 0 tests\.\nReports: \.qa-core\/review\/report\.json\n$/);
  const report = readJson(path.join(dir, '.qa-core', 'review', 'report.json'));
  assert.deepEqual(report.findings.map((finding) => [finding.ruleId, finding.location.file, finding.severity]), [['QCR-X001', 'src/empty.test.js', 'info']]);

  const table = [
    [['--fail-on', 'info'], 1], [['review', '--fail-on', 'info'], 1], [['--fail-on', 'warn'], 0], [['--fail-on', 'error'], 0], [['--fail-on', 'never'], 0],
    [['--fail-on', 'info', '--disable', 'QCR-X001'], 0], [['--fail-on', 'info', '--rules', 'QCR-X001'], 1], [['--fail-on', 'info', '--language', 'typescript'], 0],
    [['--fail-on', 'info', '--language', 'javascript,typescript'], 1], [['--fail-on', 'info', 'src/cart.test.ts'], 0], [['--fail-on', 'info', 'src'], 1], [['--fail-on', 'info', 'src/*.js'], 1],
    [['--fail-on', 'info', 'tests'], 0],
  ];
  for (const [args, status] of table) assert.equal(run(dir, args).status, status, args.join(' '));
  // The config sets the level too, and the flag wins over it.
  fs.writeFileSync(path.join(dir, 'qa-core-review.config.json'), '{ "failOn": "info" }');
  assert.deepEqual([run(dir, []).status, run(dir, ['--fail-on', 'error']).status], [1, 0]);
});

test('exit code 2: a mistake in the call or in the config, on one line, with nothing on stdout', (t) => {
  const dir = project(t, { 'bad.config.json': '{ "failOn": "sometimes" }', 'a-file': 'x' });
  const table = [
    [['--no-such-flag'], /--no-such-flag/], [['--fail-on', 'maybe'], /--fail-on must be error, warn, info or never, not "maybe"/], [['--rules', 'QCR-Z999'], /--rules: unknown rule id "QCR-Z999"\. Known: QCR-A001, .*QCR-X001/],
    [['--disable', ''], /--disable: give at least one rule id/], [['--language', 'klingon'], /--language: unknown language "klingon"/], [['--framework', 'nope'], /--framework must be .*, not "nope"/],
    [['--format', 'pretty,sarif'], /the sarif format is not available yet/], [['--format', 'html'], /--format: unknown format "html"/], [['--stdout', 'junit'], /the junit format is not available yet/],
    [['--stdout', 'pretty'], /--stdout must be/], [['--max-findings', 'many'], /--max-findings must be a whole number, 0 or more, not "many"/], [['--max-findings=-1'], /--max-findings must be/], [['--max-findings', '-1'], /--max-findings' argument is ambiguous$/m], [['missing.test.ts'], /path not found: missing\.test\.ts/], [[path.join('..', 'elsewhere')], /path is outside the root/],
    [['--root', 'nowhere'], /--root is not a folder: nowhere/], [['--output', 'a-file'], /cannot write to --output a-file/], [['ui'], /the "ui" command is not available yet/],
  ];
  for (const [args, message] of table) {
    const ran = run(dir, args);
    assert.deepEqual([ran.status, ran.stdout], [2, ''], args.join(' '));
    assert.match(ran.stderr, message, args.join(' '));
    assert.match(ran.stderr, /^qa-core-review: [^\n]+\nRun qa-core-review --help\n$/, args.join(' '));
  }
  const config = run(dir, ['--config', 'bad.config.json']);
  assert.deepEqual([config.status, config.stdout], [2, '']);
  assert.match(config.stderr, /bad\.config\.json[\s\S]*\/failOn/);
});

test('exit code 3: an internal error prints the issue link, and the stack only when asked', (t) => {
  const dir = project(t);
  const preload = ['--import', pathToFileURL(path.join(repoRoot, 'tests', 'helpers', 'crash-preload.mjs')).href];
  const ran = run(dir, [], { nodeArgs: preload, env: { QA_CORE_REVIEW_DEBUG: '' } });
  assert.deepEqual([ran.status, ran.stdout, ran.stderr], [3, '', 'Internal error, please open an issue at https://github.com/sprintsynergyio/qa-core-review/issues\n']);
  const debug = run(dir, [], { nodeArgs: preload, env: { QA_CORE_REVIEW_DEBUG: '1' } });
  assert.equal(debug.status, 3);
  assert.match(debug.stderr, /^Internal error, please open an issue at [^\n]+\nTypeError: boom from the crash preload\n\s+at /);
});

test('--stdout json prints the report, --dump-model writes the models, and --output moves both', (t) => {
  const dir = project(t);
  const ran = run(dir, ['--stdout', 'json', '--dump-model', '--output', 'out/reports', '--framework', 'jest']);
  assert.deepEqual([ran.status, ran.stderr], [0, '']);
  const printed = JSON.parse(ran.stdout);
  assert.deepEqual(schemaErrors('report.schema.json', printed), []);
  assert.deepEqual(printed, readJson(path.join(dir, 'out', 'reports', 'report.json')));
  assert.deepEqual(printed.files.map((file) => file.runner), ['jest', 'jest', 'jest']);
  const models = readJson(path.join(dir, 'out', 'reports', 'model.json'));
  assert.deepEqual(models.map((model) => [model.path, model.role, schemaErrors('model.schema.json', model)]), [['src/cart.test.ts', 'test', []], ['src/empty.test.js', 'test', []], ['tests/helpers/util.ts', 'support', []]]);
  assert.match(run(dir, ['--dump-model']).stdout, /Reports: \.qa-core\/review\/report\.json, \.qa-core\/review\/model\.json\n$/);
  // --root moves the project; the report paths are relative to it.
  const elsewhere = run(os.tmpdir(), ['--root', dir, '--stdout', 'json', 'review']);
  assert.deepEqual(JSON.parse(elsewhere.stdout).files.map((file) => file.file), printed.files.map((file) => file.file));
});

test('review --help prints the flags, and notices go to stderr', (t) => {
  for (const args of [['review', '--help'], ['src', '-h']]) {
    const help = run(repoRoot, args);
    assert.deepEqual([help.status, help.stderr], [0, '']);
    for (const flag of ['--fail-on', '--rules', '--disable', '--language', '--framework', '--format', '--stdout', '--output', '--dump-model', '--max-findings', '--quiet', '--no-color', '--root', '--config']) assert.ok(help.stdout.includes(flag), flag);
    assert.match(help.stdout, /^Usage: qa-core-review review \[paths\.\.\.\] \[flags\]/);
  }
  const dir = project(t, { 'tests/test_cart.py': 'def test_a():\n    assert True\n', 'requirements.txt': 'pytest\n' });
  const ran = run(dir, []);
  assert.deepEqual([ran.status, ran.stderr], [0, 'qa-core-review: 1 python file is listed but not reviewed: this build has no static adapter for python.\n']);
  assert.match(ran.stdout, / 4 files . 1 test . /);
  assert.match(ran.stdout, /\nBy language: TypeScript 1 test, JavaScript 0 tests, Python 1 file \(not reviewed in this build\)\.\n/);
});
