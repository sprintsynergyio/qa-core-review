// The rules on their fixtures (SPEC.md Sections 10.0 to 10.5): every marker in a bad file is
// matched exactly, and no rule fires on a good file.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { FIX_TEXT, builtinRules, createRegistry, examplesFor, fixFor, jsAdapter, resolveConfig, runReview } from '../dist/index.js';
import { fixtureRoot } from './helpers/adapter-suite.mjs';
import { expectedIn, ruleFixtureFolders, runRuleFixtures } from './helpers/fixtures.mjs';
import { repoRoot } from './helpers/schema.mjs';

const folders = ruleFixtureFolders();
const folder = (ruleId, name) => folders.find((entry) => entry.ruleId === ruleId && entry.name === name).dir;
// QCR-N001 reports any small group of happy-path tests. It has its own tests, so it is switched off here.
const review = (root, { config = {}, ...options } = {}) => runReview({ root, config: resolveConfig({ ...config, rules: { 'QCR-N001': 'off', ...config.rules } }).config, git: false, ...options });

for (const { ruleId, name, dir } of folders) {
  test(`${ruleId} ${name}: every marker is matched and the good files are clean`, async () => {
    const { bad, good } = await runRuleFixtures(dir);
    assert.ok(bad.length >= 3 && good.length >= 3, `needs 3 bad and 3 good files, has ${bad.length} and ${good.length}`);
    for (const entry of bad) {
      assert.ok(entry.expected.some((marker) => marker.startsWith(`${ruleId}@`)), `${entry.file} has no marker for ${ruleId}`);
      assert.deepEqual(entry.actual, entry.expected, entry.file);
    }
    for (const entry of good) assert.deepEqual([entry.expected, entry.actual], [[], []], entry.file);
  });
}

test('every rule with fixtures has them for JS/TS, every folder is named for a language and a framework, and the registry lists the rules in id order', () => {
  assert.deepEqual([...new Set(folders.map((entry) => entry.ruleId))], ['QCR-A001', 'QCR-A002', 'QCR-A003', 'QCR-A004', 'QCR-C001', 'QCR-D001', 'QCR-E001', 'QCR-F001', 'QCR-F002', 'QCR-M001', 'QCR-N001', 'QCR-P001', 'QCR-S001', 'QCR-W001', 'QCR-X002']);
  assert.ok(folders.every((entry) => /^(typescript|javascript|python|java)-[a-z]+\d?$/.test(entry.name)));
  assert.deepEqual([...new Set(folders.filter((entry) => /^(typescript|javascript)-/.test(entry.name)).map((entry) => entry.ruleId))].length, 15);
  assert.deepEqual(builtinRules.map((rule) => [rule.id, rule.name, rule.defaultSeverity, rule.scope, rule.requires.join(' ')]), [
    ['QCR-A001', 'no-assertion', 'error', 'universal', 'tests assertions'],
    ['QCR-A002', 'trivial-assertion', 'error', 'universal', 'assertions assertion-operands'],
    ['QCR-A003', 'cannot-fail-assertion', 'error', 'universal', 'assertions assertion-operands reachability'],
    ['QCR-A004', 'conditional-assertion', 'warn', 'universal', 'assertions'],
    ['QCR-W001', 'hard-wait', 'warn', 'universal', 'waits'],
    ['QCR-S001', 'brittle-selector', 'warn', 'framework', 'selectors'],
    ['QCR-E001', 'swallowed-error', 'error', 'universal', 'try-blocks'],
    ['QCR-F001', 'focused-test', 'error', 'framework', 'modifiers'],
    ['QCR-F002', 'skipped-test', 'warn', 'universal', 'modifiers'],
    ['QCR-D001', 'duplicate-test', 'warn', 'universal', 'body-hash'],
    ['QCR-N001', 'missing-negative-case', 'info', 'universal', 'tests assertions'],
    ['QCR-M001', 'over-mocking', 'error', 'universal', 'mocks assertions assertion-operands'],
    ['QCR-P001', 'snapshot-only', 'warn', 'universal', 'assertions'],
    ['QCR-C001', 'missing-cleanup', 'warn', 'universal', 'resources hooks'],
    ['QCR-X001', 'parse-error', 'info', 'universal', ''],
    ['QCR-X002', 'suppression-without-reason', 'info', 'universal', ''],
  ]);
});

test('fixture markers: comment styles, several ids on a line, and sidecar files', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcr-markers-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'a.ts'), "x(); // expect: QCR-A001\ny();\nz(); // expect: QCR-A002, QCR-W001\nconst s = '// expect: QCR-A003 is not at the end';\n// a comment about expect: nothing\n");
  fs.writeFileSync(path.join(dir, 'b.py'), 'x()  # expect: QCR-A001,QCR-A001\r\n');
  fs.writeFileSync(path.join(dir, 'c.json'), '{}');
  fs.writeFileSync(path.join(dir, 'c.json.expect.json'), '[{ "ruleId": "QCR-A001", "line": 12 }, { "ruleId": "QCR-A001", "line": 3 }]');
  assert.deepEqual([expectedIn(path.join(dir, 'a.ts')), expectedIn(path.join(dir, 'b.py')), expectedIn(path.join(dir, 'c.json'))], [
    ['QCR-A001@1', 'QCR-A002@3', 'QCR-W001@3'], ['QCR-A001@1', 'QCR-A001@1'], ['QCR-A001@12', 'QCR-A001@3'],
  ]);
});

test('findings carry a message for the sub-case, a fix and a good example in the language of the file', async () => {
  const { report } = await review(folder('QCR-A003', 'typescript-playwright'));
  const byLine = (file, line) => report.findings.find((finding) => finding.location.file === file && finding.location.startLine === line);
  const cases = {
    'bad/not-awaited.spec.ts:9': ['This assertion is not awaited, so the test can end before it fails.', 'QCR-A003/unawaited'],
    'bad/always-true.spec.ts:5': ['This checks only that a locator or element object exists, and it always does. It says nothing about the page.', 'QCR-A003/locator'],
    'bad/always-true.spec.ts:13': ['A count is never below zero, so this check always passes.', 'QCR-A003/count'],
    'bad/never-runs.spec.ts:4': ['This assertion is never finished: no matcher is called, so nothing is checked.', 'QCR-A003/incomplete'],
    'bad/never-runs.spec.ts:14': ['This assertion is never reached: the code before it always returns or throws.', 'QCR-A003/unreachable'],
  };
  for (const [place, [message, key]] of Object.entries(cases)) {
    const [file, line] = place.split(':');
    const finding = byLine(file, Number(line));
    assert.deepEqual([finding.message, finding.fix, finding.goodExample, finding.severity, finding.confidence], [message, FIX_TEXT[key].fix, FIX_TEXT[key].examples.js.good, 'error', 'high'], place);
  }
  // An assertion in a hook belongs to no test. It is still found, and shown with the file.
  const hook = byLine('bad/not-awaited.spec.ts', 5);
  assert.deepEqual([hook.testId, hook.evidence, hook.location.startColumn], [null, "expect(page.getByText('Your Cart')).toBeVisible()", 3]);
  const collection = (await review(folder('QCR-A003', 'typescript-jest'))).report.findings.find((finding) => finding.evidence.startsWith('expect([cart.total()'));
  assert.equal(collection.message, 'A list or an object that is written out with items is always truthy, so this check always passes.');

  const a004 = (await review(folder('QCR-A004', 'typescript-jest'))).report.findings.filter((finding) => finding.location.file === 'bad/branches.test.ts');
  assert.deepEqual(a004.map((finding) => [finding.severity, finding.message.split(' of this test')[0], finding.location.startLine]), [['warn', 'All 2 assertions', 7], ['warn', 'All 2 assertions', 16]]);
  const a001 = (await review(folder('QCR-A001', 'typescript-jest'))).report.findings[0];
  assert.deepEqual([a001.ruleId, a001.evidence, a001.location.startLine, a001.location.startColumn, a001.fix], ['QCR-A001', 'adds an item', 4, 3, FIX_TEXT['QCR-A001'].fix]);
  const a002 = (await review(folder('QCR-A002', 'typescript-jest'))).report.findings.filter((finding) => finding.location.file === 'bad/same-value.test.ts');
  assert.ok(a002.length === 4 && a002.every((finding) => finding.message === 'This assertion compares a value with itself, so it always passes.'));

  // Texts exist per language. Until a language has its own, its files get the general fix and no example.
  assert.deepEqual(fixFor('QCR-A002', 'csharp'), { fix: FIX_TEXT['QCR-A002'].fix });
  assert.deepEqual(fixFor('QCR-A002', 'javascript'), fixFor('QCR-A002', 'typescript'));
  assert.deepEqual(examplesFor('QCR-A003', 'typescript').map((entry) => entry.title).length, 9);
  assert.deepEqual([examplesFor('QCR-A001', 'csharp')[0].example, examplesFor('QCR-X001', 'typescript')], [null, []]);
});

test('helpers: the config, the same file, a page object the spec imports, and Cypress support files', async (t) => {
  const lines = (report, file) => report.findings.filter((finding) => finding.location.file === file).map((finding) => finding.location.startLine);
  // A name in assertionHelpers counts as an assertion.
  const jest = folder('QCR-A001', 'typescript-jest');
  assert.deepEqual(lines((await review(jest)).report, 'bad/helper.test.ts'), [4, 13]);
  assert.deepEqual(lines((await review(jest, { config: { assertionHelpers: ['verifyCart'] } })).report, 'bad/helper.test.ts'), [13]);

  // The page object is outside the test folders. The review reads it because the spec imports it.
  const playwright = folder('QCR-A001', 'typescript-playwright');
  const withImports = await review(playwright);
  assert.deepEqual([lines(withImports.report, 'good/helpers.spec.ts'), withImports.report.files.map((file) => file.file).filter((file) => file.includes('pages'))], [[], []]);
  const blind = createRegistry([{ ...jsAdapter, supportFiles: undefined }]);
  assert.deepEqual(lines((await review(playwright, { registry: blind })).report, 'good/helpers.spec.ts'), [14]);
  // Custom Cypress commands live in cypress/support, which no spec imports.
  const cypress = folder('QCR-A001', 'javascript-cypress');
  assert.deepEqual([lines((await review(cypress)).report, 'good/commands.cy.js'), lines((await review(cypress, { registry: blind })).report, 'good/commands.cy.js')], [[], [3]]);

  // Imports are followed two steps: the spec, its fixtures file, the page object. Not further, and not into excluded folders.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcr-support-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const files = {
    'e2e/cart.spec.ts': "import { test } from './fixtures.js';\nimport { far } from '../lib/one';\nimport { hidden } from '../dist/hidden';\ntest('near', async ({ cart }) => { await cart.expectEmpty(); });\ntest('far', async () => { far(); });\ntest('hidden', async () => { hidden(); });\n",
    'e2e/fixtures.ts': "import { test as base } from '@playwright/test';\nimport { CartPage } from '../src/pages';\nexport const test = base.extend({ cart: async ({ page }, use) => use(new CartPage(page)) });\n",
    'src/pages/index.ts': "import { expect } from '@playwright/test';\nexport class CartPage { async expectEmpty() { await expect(this.items).toHaveCount(0); } }\n",
    'lib/one.ts': "export { far } from './two';\n", 'lib/two.ts': "export { far } from './three';\n", 'lib/three.ts': "import { expect } from '@playwright/test';\nexport function far() { expect(1 + 1).toBe(2); }\n",
    'dist/hidden.ts': "import { expect } from '@playwright/test';\nexport function hidden() { expect(1 + 1).toBe(2); }\n",
  };
  for (const [name, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), text);
  }
  const { report } = await review(dir);
  assert.deepEqual(report.files.map((file) => file.file), ['e2e/cart.spec.ts', 'e2e/fixtures.ts']);
  assert.deepEqual(report.findings.map((finding) => [finding.ruleId, finding.evidence]), [['QCR-A001', 'far'], ['QCR-A001', 'hidden']]);
});

test('a file read by the lexical scanner gets the rules it supports, with low confidence', async () => {
  const { report } = await review(fixtureRoot('adapters', 'js', 'jest'));
  const broken = report.files.find((file) => file.file === 'src/broken.test.ts');
  assert.deepEqual(report.findings.filter((finding) => finding.location.file === broken.file).map((finding) => [finding.ruleId, finding.location.startLine, finding.confidence]), [
    ['QCR-F001', 10, 'low'], ['QCR-W001', 11, 'low'], ['QCR-W001', 12, 'low'], ['QCR-A001', 16, 'low'], ['QCR-F002', 18, 'low'], ['QCR-W001', 20, 'low'], ['QCR-F002', 21, 'low'],
  ]);
  assert.deepEqual(broken.rulesSkipped.map((rule) => rule.ruleId), ['QCR-A002', 'QCR-A003', 'QCR-S001', 'QCR-E001', 'QCR-D001', 'QCR-M001', 'QCR-C001']);
  assert.match(broken.rulesSkipped[0].reason, /^needs a capability this file does not have: assertion-operands/);
});

test('docs/rules.md has a section for every rule, with the examples that explain prints', () => {
  const docs = fs.readFileSync(path.join(repoRoot, 'docs', 'rules.md'), 'utf8');
  for (const rule of builtinRules) {
    assert.ok(docs.includes(`<a id="${rule.id.toLowerCase()}"></a>\n## ${rule.id} \`${rule.name}\` (${rule.defaultSeverity})\n`), `no section for ${rule.id}`);
    assert.ok(docs.includes(`"${rule.id}": "off"`), `${rule.id}: how to turn it off`);
  }
  for (const [key, entry] of Object.entries(FIX_TEXT)) {
    for (const [language, example] of Object.entries(entry.examples)) assert.ok(docs.includes(example.bad) && docs.includes(example.good), `${key}: the bad and the good example for ${language}`);
    assert.ok(Object.keys(entry.examples).length > 0, `${key}: an example in at least one language`);
    for (const fix of [entry.fix, ...Object.values(entry.fixes ?? {})]) assert.ok(docs.includes(fix), `${key}: the fix "${fix}"`);
  }
});
