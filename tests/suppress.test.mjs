// Suppression (SPEC.md Section 10.17) and QCR-X002: comments in `//` and `#` syntax, entries in
// the config, the reason that is required, and what a suppressed finding does and does not do.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { FIX_TEXT, createRegistry, failsAt, parseSuppression, resolveConfig, runReview } from '../dist/index.js';
import { schemaErrors } from './helpers/schema.mjs';
import { toyAdapter } from './helpers/toy-adapter.mjs';

const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cli = path.join(repo, 'dist', 'cli.js');

/** Writes the files into a temp project and reviews it. N001 and D001 are off: these tests copy small files and are about other rules. */
async function review(files, { config = {}, ...options } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcr-suppress-'));
  try {
    fs.writeFileSync(path.join(dir, 'package.json'), '{ "devDependencies": { "@playwright/test": "^1.49.0" } }');
    for (const [file, source] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
      fs.writeFileSync(path.join(dir, file), source.replace(/^\n/, ''));
    }
    const { report } = await runReview({ root: dir, config: resolveConfig({ ...config, rules: { 'QCR-N001': 'off', 'QCR-D001': 'off', ...config.rules } }).config, git: false, ...options });
    const line = (finding) => `${finding.location.file}:${finding.location.startLine} ${finding.ruleId.slice(4)} ${finding.severity}${finding.suppressed ? ' suppressed' : ''}`;
    return { report, lines: report.findings.map(line) };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const SPEC = `
import { expect, test } from '@playwright/test';

test('adds an item', async ({ page }) => {
  // qa-core-review-disable-next-line QCR-W001 -- the animation has no event to wait for
  await page.waitForTimeout(3000);
  await page.waitForTimeout(2000);
  /* qa-core-review-disable-next-line QCR-S001, QCR-W001 -- the old grid has no test ids, tracked in SHOP-142 */
  await page.locator('//div[3]/div[2]/button[2]').click(); await page.waitForTimeout(100);
  // qa-core-review-disable-next-line QCR-A003 -- this names another rule, so the sleep below is still reported
  await page.waitForTimeout(500);
  await expect(page.getByTestId('badge')).toHaveText('1');
});

test('opens the cart', async ({ page }) => {
  // qa-core-review-disable-next-line QCR-A001 -- smoke test: it only has to load
  await page.goto('/cart.html');
});

// qa-core-review-disable-next-line QCR-A001 -- smoke test: it only has to load
test('opens the menu', async ({ page }) => {
  await page.goto('/menu.html');
});
`;

test('a next-line comment with a reason suppresses the named rules on the next line, and only there', async () => {
  const { report, lines } = await review({ 'tests/cart.spec.ts': SPEC });
  assert.deepEqual(lines, [
    'tests/cart.spec.ts:5 W001 warn suppressed',
    'tests/cart.spec.ts:6 W001 warn',
    'tests/cart.spec.ts:8 S001 warn suppressed',
    'tests/cart.spec.ts:8 W001 warn suppressed',
    'tests/cart.spec.ts:10 W001 warn',
    // The finding for a test with no assertion is on the line of the test, not inside it.
    'tests/cart.spec.ts:14 A001 error',
    'tests/cart.spec.ts:20 A001 error suppressed',
  ]);
  // A suppressed finding counts in summary.suppressed and nowhere else: not in the totals, not in a verdict.
  const { summary } = report;
  assert.deepEqual([summary.suppressed, summary.errors, summary.warnings, summary.fail, summary.review, summary.pass], [4, 1, 2, 1, 1, 1]);
  const verdicts = Object.fromEntries(report.files[0].tests.map((entry) => [entry.title, [entry.verdict, entry.findingIds.length]]));
  assert.deepEqual(verdicts, { 'adds an item': ['review', 5], 'opens the cart': ['fail', 1], 'opens the menu': ['pass', 1] });
  assert.deepEqual(schemaErrors('report.schema.json', report), []);
});

test('a whole-file comment works before the first statement only', async () => {
  const body = "import { test } from '@playwright/test';\ntest('loads', async ({ page }) => { await page.goto('/'); await page.waitForTimeout(500); });\n";
  const { lines } = await review({
    'a.spec.ts': `// Smoke tests.\n// qa-core-review-disable QCR-A001, QCR-W001 -- smoke tests only load a page\n${body}`,
    'b.spec.ts': `/**\n * qa-core-review-disable QCR-A001 -- smoke tests only load a page\n */\n${body}`,
    // After the first statement the comment is too late: it does nothing.
    'c.spec.ts': `${body}// qa-core-review-disable QCR-A001 -- too late\n`,
  });
  assert.deepEqual(lines, [
    'a.spec.ts:4 A001 error suppressed', 'a.spec.ts:4 W001 warn suppressed',
    'b.spec.ts:5 A001 error suppressed', 'b.spec.ts:5 W001 warn',
    'c.spec.ts:2 A001 error', 'c.spec.ts:2 W001 warn',
  ]);
});

test('a suppression with no reason is ignored and reported as QCR-X002', async () => {
  const { report, lines } = await review({
    'tests/cart.spec.ts': `
// qa-core-review-disable QCR-S001
import { expect, test } from '@playwright/test';
test('adds an item', async ({ page }) => {
  // qa-core-review-disable-next-line QCR-W001
  await page.waitForTimeout(3000);
  // qa-core-review-disable-next-line QCR-W001 --
  await page.waitForTimeout(2000);
  await page.locator('.css-1q2w3e4').click();
  await expect(page.getByTestId('badge')).toHaveText('1');
});
`,
  });
  assert.deepEqual(lines, [
    'tests/cart.spec.ts:1 X002 info', 'tests/cart.spec.ts:4 X002 info', 'tests/cart.spec.ts:5 W001 warn', 'tests/cart.spec.ts:6 X002 info', 'tests/cart.spec.ts:7 W001 warn', 'tests/cart.spec.ts:8 S001 warn',
  ]);
  const [whole, next] = report.findings.filter((finding) => finding.ruleId === 'QCR-X002');
  assert.deepEqual([whole.evidence, next.evidence, next.testId, next.message], [
    'qa-core-review-disable QCR-S001', 'qa-core-review-disable-next-line QCR-W001', null, 'This suppression has no reason, so it is ignored. Write the reason after " -- ".',
  ]);
  assert.deepEqual([next.fix, next.goodExample], [FIX_TEXT['QCR-X002'].fix, FIX_TEXT['QCR-X002'].examples.js.good]);
  assert.deepEqual([report.summary.suppressed, report.summary.infos], [0, 3]);
  // X002 is info: at the default --fail-on it never fails a run by itself.
  assert.equal(failsAt(report.findings.filter((finding) => finding.ruleId === 'QCR-X002'), 'error'), false);
});

test('the # comment syntax works the same, and so does a file read by the lexical scanner', async () => {
  assert.deepEqual(parseSuppression('# qa-core-review-disable-next-line QCR-W001 -- the report job has no event', { startLine: 3, startColumn: 1, endLine: 3, endColumn: 70 }), {
    span: { startLine: 3, startColumn: 1, endLine: 3, endColumn: 70 }, scope: 'next-line', rules: ['QCR-W001'], reason: 'the report job has no event',
  });
  assert.deepEqual(parseSuppression('# qa-core-review-disable QCR-A001,QCR-W001 -- why -- and more', { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 }).reason, 'why -- and more');
  assert.equal(parseSuppression('# qa-core-review is a tool', { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 }), null);

  // A language whose comments start with #, through the toy adapter.
  const toy = { registry: createRegistry([toyAdapter]), profiles: [toyAdapter] };
  const { lines } = await review({
    'cart.toy': `
# qa-core-review-disable QCR-A001 -- smoke checks only run the steps
test opens the cart
  do open cart
  # qa-core-review-disable-next-line QCR-W001 -- the report job has no event
  sleep 3000
  sleep 2000
  # qa-core-review-disable-next-line QCR-W001
  sleep 1000
`,
  }, toy);
  assert.deepEqual(lines, ['cart.toy:2 A001 error suppressed', 'cart.toy:5 W001 warn suppressed', 'cart.toy:6 W001 warn', 'cart.toy:7 X002 info', 'cart.toy:8 W001 warn']);

  // A JS file that cannot be parsed is read line by line. Its comments still count.
  const broken = await review({
    'tests/broken.test.js': `
// qa-core-review-disable QCR-F002 -- generated file, fixed in the generator
test.skip('a', () => { run(;;; ) => { (((
test('b', async () => {
  // qa-core-review-disable-next-line QCR-W001 -- the queue has no event
  await sleep(500);
  await sleep(250);
  expect(queue.size).toBe(0
`,
  });
  assert.equal(broken.report.files[0].parseStatus, 'partial');
  assert.deepEqual(broken.lines.filter((line) => / (F002|W001) /.test(line)), ['tests/broken.test.js:2 F002 warn suppressed', 'tests/broken.test.js:5 W001 warn suppressed', 'tests/broken.test.js:6 W001 warn']);
});

test('suppressions in the config: by file glob, by rule, and by the full title of a test', async () => {
  const body = (title) => `import { test } from '@playwright/test';\ntest.describe('Cart', () => {\n  test('${title}', async ({ page }) => { await page.goto('/'); await page.waitForTimeout(500); });\n  test('second', async ({ page }) => { await page.goto('/'); await page.waitForTimeout(100); });\n});\n`;
  const config = {
    suppressions: [
      { file: 'legacy/**', rules: ['QCR-A001', 'QCR-W001'], reason: 'The legacy suite is replaced in Q1.' },
      { file: 'tests/cart.spec.ts', rules: ['QCR-A001'], test: 'Cart > loads', reason: 'Smoke test.' },
      { file: '**/*.spec.ts', rules: ['QCR-F002'], reason: 'No skips here anyway.' },
    ],
  };
  const { report, lines } = await review({ 'legacy/old.spec.ts': body('loads'), 'tests/cart.spec.ts': body('loads'), 'tests/other.spec.ts': body('loads') }, { config });
  assert.deepEqual(lines, [
    'legacy/old.spec.ts:3 A001 error suppressed', 'legacy/old.spec.ts:3 W001 warn suppressed', 'legacy/old.spec.ts:4 A001 error suppressed', 'legacy/old.spec.ts:4 W001 warn suppressed',
    'tests/cart.spec.ts:3 A001 error suppressed', 'tests/cart.spec.ts:3 W001 warn', 'tests/cart.spec.ts:4 A001 error', 'tests/cart.spec.ts:4 W001 warn',
    'tests/other.spec.ts:3 A001 error', 'tests/other.spec.ts:3 W001 warn', 'tests/other.spec.ts:4 A001 error', 'tests/other.spec.ts:4 W001 warn',
  ]);
  assert.equal(report.summary.suppressed, 5);
  // A config suppression needs a reason too: without one the config is not valid.
  assert.throws(() => resolveConfig({ suppressions: [{ file: 'legacy/**', rules: ['QCR-A001'] }] }), /reason/);
});

test('suppressed findings are only in the JSON output and never change the exit code', async () => {
  const files = {
    'tests/cart.spec.ts': `
import { test } from '@playwright/test';
// qa-core-review-disable-next-line QCR-A001, QCR-F001 -- smoke test, focused on purpose in this demo
test.only('opens the cart', async ({ page }) => {
  await page.goto('/cart.html');
});
`,
  };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcr-suppress-cli-'));
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => name !== 'NO_COLOR' && name !== 'FORCE_COLOR'));
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: dir, encoding: 'utf8', env });
  try {
    fs.mkdirSync(path.join(dir, 'tests'));
    fs.writeFileSync(path.join(dir, 'package.json'), '{ "devDependencies": { "@playwright/test": "^1.49.0" } }');
    fs.writeFileSync(path.join(dir, 'tests/cart.spec.ts'), files['tests/cart.spec.ts'].replace(/^\n/, ''));
    const text = run('review', '--disable', 'QCR-N001');
    assert.deepEqual([text.status, text.stdout.includes('QCR-A001'), text.stdout.includes('QCR-F001')], [0, false, false]);
    assert.match(text.stdout, /pass {2}tests\/cart\.spec\.ts:3 {2}opens the cart\n\nSummary: 1 pass, 0 review, 0 fail\. 0 errors, 0 warnings, 0 info\. 2 suppressed\.\n/);
    const json = JSON.parse(run('review', '--disable', 'QCR-N001', '--stdout', 'json').stdout);
    assert.deepEqual(json.findings.map((finding) => [finding.ruleId, finding.severity, finding.suppressed]), [['QCR-A001', 'error', true], ['QCR-F001', 'error', true]]);
    // The strictest level still passes, and without the comment the same file fails.
    assert.equal(run('review', '--disable', 'QCR-N001', '--fail-on', 'info', '--quiet').status, 0);
    assert.equal(run('review', '--disable', 'QCR-N001', '--rules', 'QCR-A001,QCR-F001', '--quiet').status, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
