// Diff mode (SPEC.md Section 11.2): `--diff <base>` and `--staged`, in a temp git repo. The
// repo gets its own user.name and user.email, set inside that repo only.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { DiffError, changedLines, parseUnifiedDiff, resolveConfig, runReview, touches } from '../dist/index.js';
import { schemaErrors } from './helpers/schema.mjs';

const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cli = path.join(repo, 'dist', 'cli.js');
const hasGit = spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0;
const needsGit = hasGit ? {} : { skip: 'git is not installed, so diff mode cannot be tested here' };
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => name !== 'NO_COLOR' && name !== 'FORCE_COLOR'));

const CART = `import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/inventory.html');
  await page.waitForTimeout(250);
});

test('adds an item', async ({ page }) => {
  await page.getByTestId('add').click();
  await page.waitForTimeout(3000);
  await expect(page.getByTestId('badge')).toHaveText('1');
});

test('opens the cart', async ({ page }) => {
  await page.getByTestId('cart').click();
  await page.waitForTimeout(1000);
  await expect(page.getByTestId('cart-list')).toBeVisible();
});

test.only('removes an item', async ({ page }) => {
  await page.getByTestId('remove').click();
  await expect(page.getByTestId('badge')).toBeHidden();
});
`;
const LOGIN = `import { expect, test } from '@playwright/test';

test('logs in', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);
  await expect(page).toHaveURL(/inventory/);
});
`;

/** A temp repo with one commit on `main`: two Playwright files, a Python file and a Java file. */
function makeRepo() {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'qcr-diff-')));
  const git = (...args) => {
    const ran = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
    assert.equal(ran.status, 0, `git ${args.join(' ')}: ${ran.stderr}`);
    return ran.stdout;
  };
  const write = (file, text) => {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), text);
  };
  const edit = (file, from, to) => {
    const text = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.ok(text.includes(from), `${file} has no "${from}"`);
    write(file, text.replace(from, to));
  };
  git('init', '-q');
  git('symbolic-ref', 'HEAD', 'refs/heads/main');
  // Only for this repo: nothing is written to the settings of the person or the machine.
  git('config', 'user.name', 'Diff Test');
  git('config', 'user.email', 'diff-test@example.test');
  git('config', 'core.autocrlf', 'false');
  git('config', 'commit.gpgsign', 'false');
  write('.gitignore', '.qa-core/\nnode_modules/\n');
  write('package.json', '{ "devDependencies": { "@playwright/test": "^1.49.0" } }\n');
  write('tests/cart.spec.ts', CART);
  write('tests/login.spec.ts', LOGIN);
  write('tests/test_orders.py', 'def test_lists_orders(client):\n    assert client.get("/orders").status_code == 200\n');
  write('src/test/java/shop/CartTest.java', 'package shop;\n\nclass CartTest {\n    @org.junit.jupiter.api.Test\n    void addsAnItem() {\n        org.junit.jupiter.api.Assertions.assertEquals(1, new Cart().add("backpack").size());\n    }\n}\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'first');
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: dir, encoding: 'utf8', env });
  const review = async (diff, extra = {}) => {
    const { report } = await runReview({ root: dir, config: resolveConfig({ rules: { 'QCR-N001': 'off' } }).config, diff: { base: 'base' in diff ? diff.base : 'staged', lines: changedLines(dir, diff) }, ...extra });
    return { report, lines: report.findings.map((finding) => `${finding.location.file}:${finding.location.startLine} ${finding.ruleId.slice(4)}`), tests: report.files.flatMap((file) => file.tests.map((entry) => `${file.file} > ${entry.fullTitle}`)) };
  };
  return { dir, git, write, edit, run, review, remove: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test('reading git diff -U0: added, changed and removed lines, new and deleted files, renames and odd paths', () => {
  const patch = [
    'diff --git a/tests/cart.spec.ts b/tests/cart.spec.ts', 'index 1111111..2222222 100644', '--- a/tests/cart.spec.ts', '+++ b/tests/cart.spec.ts',
    '@@ -10 +10 @@ test', '-old', '+new', '@@ -15,2 +15,3 @@', '-a', '-b', '+a', '+b', '+c', '@@ -30,4 +30,0 @@', '-x', '-y', '-z', '-w', '@@ -0,0 +1,2 @@', '+first', '+second',
    'diff --git a/tests/new.spec.ts b/tests/new.spec.ts', 'new file mode 100644', '--- /dev/null', '+++ b/tests/new.spec.ts', '@@ -0,0 +1,12 @@',
    'diff --git a/tests/gone.spec.ts b/tests/gone.spec.ts', 'deleted file mode 100644', '--- a/tests/gone.spec.ts', '+++ /dev/null', '@@ -1,9 +0,0 @@',
    'diff --git a/tests/old name.spec.ts b/tests/new name.spec.ts', 'similarity index 90%', 'rename from tests/old name.spec.ts', 'rename to tests/new name.spec.ts', '--- a/tests/old name.spec.ts', '+++ b/tests/new name.spec.ts\t', '@@ -4 +4 @@',
    'diff --git "a/tests/tab\\there.spec.ts" "b/tests/tab\\there.spec.ts"', '--- "a/tests/tab\\there.spec.ts"', '+++ "b/tests/tab\\there.spec.ts"', '@@ -2,0 +3 @@',
    'diff --git a/logo.png b/logo.png', 'Binary files a/logo.png and b/logo.png differ',
  ].join('\n');
  assert.deepEqual([...parseUnifiedDiff(patch)], [
    // Where lines were only removed, the lines on both sides of the gap count.
    ['tests/cart.spec.ts', [[10, 10], [15, 17], [30, 31], [1, 2]]],
    ['tests/new.spec.ts', [[1, 12]]],
    ['tests/new name.spec.ts', [[4, 4]]],
    ['tests/tab\there.spec.ts', [[3, 3]]],
  ]);
  assert.deepEqual([...parseUnifiedDiff('')], []);
  const ranges = [[10, 12], [30, 31]];
  assert.deepEqual([touches(ranges, 1, 9), touches(ranges, 8, 10), touches(ranges, 12, 20), touches(ranges, 13, 29), touches(ranges, 1, 99), touches('all', 5, 5), touches(undefined, 5, 5)], [false, true, true, false, true, true, false]);
});

test('--diff HEAD: only the tests whose lines changed, untracked test files, and F001 in a changed file', needsGit, async () => {
  const repoDir = makeRepo();
  try {
    // Nothing changed yet.
    const clean = await repoDir.review({ base: 'HEAD' });
    assert.deepEqual([clean.report.summary.files, clean.lines, clean.report.mode.diffBase], [0, [], 'HEAD']);

    // One line inside "opens the cart" changes. A new test file, a new Python file and a new Scala file are not tracked yet.
    repoDir.edit('tests/cart.spec.ts', "toBeVisible();", "toBeVisible({ timeout: 10_000 });");
    repoDir.write('tests/new.spec.ts', "import { test } from '@playwright/test';\n\ntest('opens the menu', async ({ page }) => {\n  await page.goto('/menu.html');\n});\n");
    repoDir.write('tests/test_refunds.py', 'def test_refunds(client):\n    assert client.post("/refunds").status_code == 201\n');
    repoDir.write('specs/RefundSpec.scala', 'class RefundSpec\n');
    repoDir.write('notes.md', 'Not a test file.\n');
    const { report, lines, tests } = await repoDir.review({ base: 'HEAD' });
    assert.deepEqual(lines, [
      // "adds an item" has a sleep too, and so has the hook. Their lines did not change, so they are not reported.
      'tests/cart.spec.ts:16 W001',
      // A focused test is reported in a changed file wherever it is.
      'tests/cart.spec.ts:20 F001',
      'tests/new.spec.ts:3 A001',
      // The new Python test posts a refund and never deletes it (info).
      'tests/test_refunds.py:2 C001',
    ]);
    assert.deepEqual(tests, ['tests/cart.spec.ts > opens the cart', 'tests/cart.spec.ts > removes an item', 'tests/new.spec.ts > opens the menu', 'tests/test_refunds.py > test_refunds']);
    // login.spec.ts, test_orders.py and CartTest.java did not change. The new Scala file is listed, with no static review.
    assert.deepEqual(report.files.map((file) => [file.file, file.parseStatus]), [['specs/RefundSpec.scala', 'llm-only'], ['tests/cart.spec.ts', 'ok'], ['tests/new.spec.ts', 'ok'], ['tests/test_refunds.py', 'ok']]);
    assert.deepEqual([report.summary.files, report.summary.tests, report.summary.llmOnlyFiles, report.mode.diffBase], [4, 4, 1, 'HEAD']);
    assert.deepEqual(schemaErrors('report.schema.json', report), []);

    // A change in the hook: the finding about the hook sits on a changed line now.
    repoDir.edit('tests/cart.spec.ts', 'waitForTimeout(250)', 'waitForTimeout(300)');
    assert.deepEqual((await repoDir.review({ base: 'HEAD' })).lines.slice(0, 2), ['tests/cart.spec.ts:5 W001', 'tests/cart.spec.ts:16 W001']);

    // Lines that are only removed still mark the test around them.
    repoDir.edit('tests/login.spec.ts', "  await page.goto('/');\n", '');
    const removed = await repoDir.review({ base: 'HEAD' });
    assert.ok(removed.lines.includes('tests/login.spec.ts:4 W001'), removed.lines.join(', '));

    // Java: a changed Java file is listed too. A path on the command line narrows the diff.
    repoDir.edit('src/test/java/shop/CartTest.java', 'assertEquals(1,', 'assertEquals(2,');
    const all = await repoDir.review({ base: 'HEAD' });
    assert.deepEqual(all.report.files.map((file) => file.file), ['specs/RefundSpec.scala', 'src/test/java/shop/CartTest.java', 'tests/cart.spec.ts', 'tests/login.spec.ts', 'tests/new.spec.ts', 'tests/test_refunds.py']);
    const narrowed = await repoDir.review({ base: 'HEAD' }, { paths: { files: [], folders: ['src'], globs: [] } });
    assert.deepEqual(narrowed.report.files.map((file) => file.file), ['src/test/java/shop/CartTest.java']);

    // The command line: the header names the base, and the exit code follows the findings that are left.
    const text = repoDir.run('--diff', 'HEAD', '--disable', 'QCR-N001,QCR-F001,QCR-A001');
    assert.equal(text.status, 0, text.stderr);
    // Four changed tests. The focused test did not change, and with F001 off nothing is left to say about it.
    assert.match(text.stdout, /^qa-core-review \S+ . changes since HEAD . 6 files . 4 tests . static rules . TypeScript, Java, Python, Scala\n/);
    assert.match(text.stdout, /Summary: 2 pass, 2 review, 0 fail\. 0 errors, 3 warnings, 1 info\. 0 suppressed\.\n/);
    assert.equal(repoDir.run('--diff', 'HEAD', '--quiet').status, 1);
    // With --root on a folder, paths and changes are those of the folder.
    const inTests = JSON.parse(repoDir.run('--root', 'tests', '--diff', 'HEAD', '--stdout', 'json').stdout);
    assert.deepEqual(inTests.files.map((file) => file.file), ['cart.spec.ts', 'login.spec.ts', 'new.spec.ts', 'test_refunds.py']);
  } finally {
    repoDir.remove();
  }
});

test('--diff <branch>: what the branch changed since it left the base, plus what is not committed', needsGit, async () => {
  const repoDir = makeRepo();
  try {
    repoDir.git('checkout', '-q', '-b', 'feature');
    repoDir.edit('tests/login.spec.ts', 'waitForTimeout(500)', 'waitForTimeout(700)');
    repoDir.git('commit', '-q', '-am', 'on the branch');
    // main moves on after the branch left it. That change is not part of the branch.
    repoDir.git('checkout', '-q', 'main');
    repoDir.edit('tests/cart.spec.ts', 'waitForTimeout(3000)', 'waitForTimeout(4000)');
    repoDir.git('commit', '-q', '-am', 'on main');
    repoDir.git('checkout', '-q', 'feature');
    assert.deepEqual((await repoDir.review({ base: 'main' })).lines, ['tests/login.spec.ts:5 W001']);
    // A change that is not committed yet is added to it.
    repoDir.edit('tests/cart.spec.ts', 'waitForTimeout(1000)', 'waitForTimeout(1500)');
    assert.deepEqual((await repoDir.review({ base: 'main' })).lines, ['tests/cart.spec.ts:16 W001', 'tests/cart.spec.ts:20 F001', 'tests/login.spec.ts:5 W001']);
    // HEAD as the base: only what is not committed.
    assert.deepEqual((await repoDir.review({ base: 'HEAD' })).lines, ['tests/cart.spec.ts:16 W001', 'tests/cart.spec.ts:20 F001']);
    assert.deepEqual([...changedLines(repoDir.dir, { base: 'HEAD' })], [['tests/cart.spec.ts', [[16, 16]]]]);
    assert.deepEqual([...changedLines(repoDir.dir, { base: 'main' }).keys()], ['tests/cart.spec.ts', 'tests/login.spec.ts']);
  } finally {
    repoDir.remove();
  }
});

test('--staged: only what git add has staged', needsGit, async () => {
  const repoDir = makeRepo();
  try {
    repoDir.edit('tests/login.spec.ts', 'waitForTimeout(500)', 'waitForTimeout(700)');
    repoDir.edit('tests/cart.spec.ts', 'waitForTimeout(1000)', 'waitForTimeout(1500)');
    repoDir.write('tests/new.spec.ts', "import { test } from '@playwright/test';\n\ntest('opens the menu', async ({ page }) => {\n  await page.goto('/menu.html');\n});\n");
    assert.deepEqual((await repoDir.review({ staged: true })).lines, []);
    repoDir.git('add', 'tests/login.spec.ts');
    const staged = await repoDir.review({ staged: true });
    assert.deepEqual([staged.lines, staged.report.mode.diffBase], [['tests/login.spec.ts:5 W001'], 'staged']);
    // A new file counts once it is staged.
    repoDir.git('add', 'tests/new.spec.ts');
    assert.deepEqual((await repoDir.review({ staged: true })).lines, ['tests/login.spec.ts:5 W001', 'tests/new.spec.ts:3 A001']);
    const text = repoDir.run('--staged', '--disable', 'QCR-N001');
    assert.equal(text.status, 1);
    assert.match(text.stdout, /^qa-core-review \S+ . staged changes . 2 files . 2 tests . static rules . TypeScript\n/);
  } finally {
    repoDir.remove();
  }
});

test('not a git repo, a base git does not know, or both flags: exit 2 with a clear message', needsGit, () => {
  const plain = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'qcr-nogit-')));
  const repoDir = makeRepo();
  try {
    const outside = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: plain, encoding: 'utf8', env: { ...env, GIT_CEILING_DIRECTORIES: path.dirname(plain) } });
    // The folder is named with '/' on every OS. Only its last part is compared, because the temp folder can be spelled in more than one way.
    const message = (flag) => new RegExp(`^qa-core-review: ${flag} needs a git repository, and [^\\\\\\n]*/${path.basename(plain)} is not inside one \\(or git is not installed\\)\\nRun qa-core-review --help\\n$`);
    const [noRepo, noRepoStaged] = [outside('--diff', 'HEAD'), outside('--staged')];
    assert.deepEqual([noRepo.status, noRepo.stdout, noRepoStaged.status], [2, '', 2]);
    assert.match(noRepo.stderr, message('--diff'));
    assert.match(noRepoStaged.stderr, message('--staged'));

    for (const base of ['no-such-branch', 'HEAD~99', '']) {
      const bad = repoDir.run('--diff', base);
      assert.deepEqual([bad.status, bad.stderr.split('\n')[0], bad.stdout], [2, `qa-core-review: --diff: git does not know the revision "${base}"`, ''], base);
    }
    // A base that starts with a dash is never handed to git as an option.
    const dashed = repoDir.run('--diff=--output=x');
    assert.deepEqual([dashed.status, dashed.stderr.split('\n')[0]], [2, 'qa-core-review: --diff: git does not know the revision "--output=x"']);
    assert.equal(fs.existsSync(path.join(repoDir.dir, 'x')), false);
    assert.deepEqual([repoDir.run('--diff', 'HEAD', '--staged').status, repoDir.run('--diff', 'HEAD', '--staged').stderr.split('\n')[0]], [2, 'qa-core-review: use --diff or --staged, not both']);
    assert.equal(repoDir.run('--diff').status, 2);
    // The same errors from the API.
    assert.throws(() => changedLines(plain, { base: 'HEAD' }), DiffError);
    assert.throws(() => changedLines(repoDir.dir, { base: 'no-such-branch' }), (error) => error instanceof DiffError && /no-such-branch/.test(error.message));
  } finally {
    repoDir.remove();
    fs.rmSync(plain, { recursive: true, force: true });
  }
});
