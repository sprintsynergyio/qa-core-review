// The text output of a review (SPEC.md Section 11.4) and the flags that shape it.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { formatPretty, languageName, resolveConfig, runReview, useColor } from '../dist/index.js';
import { repoRoot } from './helpers/schema.mjs';
import { toyRules } from './helpers/toy-rules.mjs';

const DOT = String.fromCharCode(0xb7);
const ESC = String.fromCharCode(27);
const options = (extra = {}) => ({ color: false, quiet: false, maxFindings: 200, reportPaths: ['.qa-core/review/report.json'], unicode: true, ...extra });

function project(t, files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcr-pretty-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const [name, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), text);
  }
  return dir;
}
const SHOP = {
  'package.json': '{ "devDependencies": { "@playwright/test": "^1.49.0" } }',
  'tests/cart.spec.ts': "import { test, expect } from '@playwright/test';\n\ntest.describe('Cart', () => {\n  test('adds an item', async ({ page }) => {\n    await page.locator('#add').click();\n    await page.waitForTimeout(3000);\n    await expect(page.locator('.badge')).toHaveText('1');\n  });\n\n  test('opens', async ({ page }) => {\n    await page.goto('/cart');\n    await page.waitForTimeout(500);\n  });\n\n  test('is empty at first', async ({ page }) => {\n    await expect(page.locator('.badge')).toBeHidden();\n  });\n});\n",
  'tests/a.spec.ts': "import { test, expect } from '@playwright/test';\ntest('first file, passes', async ({ page }) => { await expect(page).toHaveTitle('Shop'); });\n",
  'specs/CartSpec.scala': 'class CartSpec\n', 'src/test/java/CartTest.java': 'class CartTest {}\n',
};
const shop = async (t) => (await runReview({ root: project(t, SHOP), config: resolveConfig({}).config, git: false, rules: toyRules })).report;

test('the layout: header, fail then review then pass, file findings, summary, languages, reports', async (t) => {
  const report = await shop(t);
  assert.deepEqual(formatPretty(report, options()).split('\n'), [
    `qa-core-review ${report.tool.version} ${DOT} 4 files ${DOT} 4 tests ${DOT} static rules ${DOT} TypeScript, Java, Scala`,
    '',
    'fail  tests/cart.spec.ts:10  Cart > opens',
    '  QCR-T001  error  10:3  This test checks nothing.',
    '    Evidence: opens',
    '    Fix: Add an assertion.',
    '  QCR-T002  warn   12:11  Hard wait of 500 ms.',
    '    Evidence: page.waitForTimeout(500)',
    '',
    'review  tests/cart.spec.ts:4  Cart > adds an item',
    '  QCR-T002  warn   6:11  Hard wait of 3000 ms.',
    '    Evidence: page.waitForTimeout(3000)',
    '',
    'pass  tests/a.spec.ts:2  first file, passes',
    '',
    'pass  tests/cart.spec.ts:15  Cart > is empty at first',
    '',
    'file  tests/a.spec.ts',
    '  QCR-T003  info   1:1  One of 4 files.',
    '    Evidence: tests/a.spec.ts with spaces',
    '',
    'file  tests/cart.spec.ts',
    '  QCR-T003  info   1:1  One of 4 files.',
    '    Evidence: tests/cart.spec.ts with spaces',
    '',
    'Summary: 2 pass, 1 review, 1 fail. 1 error, 2 warnings, 2 info. 0 suppressed.',
    'By language: TypeScript 4 tests, Java 1 file (not reviewed in this build), Scala 1 file (LLM only).',
    'Reports: .qa-core/review/report.json',
    '',
  ]);
});

test('quiet, max-findings, color, the plain dot and suppressed findings', async (t) => {
  const report = await shop(t);
  assert.equal(formatPretty(report, options({ quiet: true })), 'Summary: 2 pass, 1 review, 1 fail. 1 error, 2 warnings, 2 info. 0 suppressed.\n');

  const capped = formatPretty(report, options({ maxFindings: 2 })).split('\n');
  assert.deepEqual([capped.filter((line) => /^ {2}QCR-/.test(line)).length, capped.at(-6)], [2, '3 more findings are not shown (--max-findings 2). The report file has all of them.']);
  assert.ok(capped.includes('review  tests/cart.spec.ts:4  Cart > adds an item') && !capped.includes('file  tests/a.spec.ts'));
  assert.match(formatPretty(report, options({ maxFindings: 4 })), /\n1 more finding is not shown \(--max-findings 4\)/);
  assert.equal(formatPretty(report, options({ maxFindings: 0 })).includes('QCR-T00'), false);

  const colored = formatPretty(report, options({ color: true }));
  assert.ok(colored.includes(`${ESC}[31mfail${ESC}[0m  tests/cart.spec.ts:10`) && colored.includes(`${ESC}[33mreview${ESC}[0m  `) && colored.includes(`${ESC}[32mpass${ESC}[0m  `));
  assert.equal(colored.replaceAll(/\u001b\[\d+m/g, ''), formatPretty(report, options()));
  assert.equal(formatPretty(report, options()).includes(ESC), false);
  assert.match(formatPretty(report, options({ unicode: false })), /^qa-core-review \S+ - 4 files - 4 tests - static rules - TypeScript, Java, Scala\n/);
  assert.match(formatPretty(report, options({ reportPaths: ['a/report.json', 'a/model.json'] })), /\nReports: a\/report\.json, a\/model\.json\n$/);

  // A suppressed finding is only in the JSON report.
  const hushed = structuredClone(report);
  for (const finding of hushed.findings) finding.suppressed = finding.ruleId === 'QCR-T003';
  assert.equal(formatPretty(hushed, options()).includes('QCR-T003'), false);
  // With no file at all there is no language line.
  const empty = (await runReview({ root: project(t, { 'readme.txt': 'x' }), config: resolveConfig({}).config, git: false })).report;
  assert.deepEqual(formatPretty(empty, options()).split('\n'), [`qa-core-review ${empty.tool.version} ${DOT} 0 files ${DOT} 0 tests ${DOT} static rules`, '', 'Summary: 0 pass, 0 review, 0 fail. 0 errors, 0 warnings, 0 info. 0 suppressed.', 'Reports: .qa-core/review/report.json', '']);
  assert.deepEqual(['typescript', 'csharp', 'php', 'robot', 'scala', 'rust'].map(languageName), ['TypeScript', 'C#', 'PHP', 'Robot Framework', 'Scala', 'Rust']);
});

test('color is on for a terminal or FORCE_COLOR, and --no-color and NO_COLOR turn it off', () => {
  const table = [
    [{ noColorFlag: false, env: {}, isTTY: true }, true], [{ noColorFlag: false, env: {}, isTTY: false }, false], [{ noColorFlag: true, env: {}, isTTY: true }, false],
    [{ noColorFlag: false, env: { NO_COLOR: '1' }, isTTY: true }, false], [{ noColorFlag: false, env: { NO_COLOR: '' }, isTTY: true }, true],
    [{ noColorFlag: false, env: { FORCE_COLOR: '1' }, isTTY: false }, true], [{ noColorFlag: false, env: { FORCE_COLOR: '0' }, isTTY: false }, false],
    [{ noColorFlag: true, env: { FORCE_COLOR: '1' }, isTTY: false }, false], [{ noColorFlag: false, env: { FORCE_COLOR: '1', NO_COLOR: '1' }, isTTY: false }, false],
  ];
  for (const [input, expected] of table) assert.equal(useColor(input), expected, JSON.stringify(input));
});

test('the review command: --quiet, --no-color, NO_COLOR and --max-findings', (t) => {
  const dir = project(t, { 'a.test.ts': "test('a', () => { expect(total).toBe(1); });", 'empty.test.ts': '', 'other.spec.ts': '' });
  const run = (args, env = {}) => spawnSync(process.execPath, [path.join(repoRoot, 'dist', 'cli.js'), ...args], { cwd: dir, encoding: 'utf8', windowsHide: true, shell: false, env: Object.fromEntries(Object.entries({ ...process.env, NO_COLOR: undefined, FORCE_COLOR: undefined, ...env }).filter(([, value]) => value !== undefined)) });
  const plain = run([]);
  assert.deepEqual([plain.status, plain.stderr, plain.stdout.includes(ESC)], [0, '', false]); // a pipe is not a terminal
  assert.ok(plain.stdout.includes('pass  a.test.ts:1  a\n') && plain.stdout.includes('file  empty.test.ts\n  QCR-X001  info   1:1  No test was found in this file, although its name says it is a test file.\n    Evidence: empty.test.ts\n    Fix: '));
  assert.equal(run(['--quiet']).stdout, 'Summary: 1 pass, 0 review, 0 fail. 0 errors, 0 warnings, 2 info. 0 suppressed.\n');

  const forced = run([], { FORCE_COLOR: '1' });
  assert.ok(forced.stdout.includes(`${ESC}[32mpass${ESC}[0m  a.test.ts:1  a`));
  assert.equal(run(['--no-color'], { FORCE_COLOR: '1' }).stdout, plain.stdout);
  assert.equal(run([], { FORCE_COLOR: '1', NO_COLOR: '1' }).stdout, plain.stdout);

  const capped = run(['--max-findings', '1']);
  assert.ok(capped.stdout.includes('file  empty.test.ts') && !capped.stdout.includes('file  other.spec.ts') && capped.stdout.includes('\n1 more finding is not shown (--max-findings 1).'));
  // The report file is not capped.
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, '.qa-core', 'review', 'report.json'), 'utf8')).findings.length, 2);
});
