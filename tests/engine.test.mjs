// The review engine (SPEC.md Sections 7.1, 8.2, 8.3 and 11.3): from a folder to a report.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { builtinRules, createRegistry, docsUrlFor, failsAt, fingerprint, formatSummary, jsAdapter, resolveConfig, runReview, verdictOf } from '../dist/index.js';
import { fixtureRoot } from './helpers/adapter-suite.mjs';
import { schemaErrors } from './helpers/schema.mjs';
import { sleep, toyRules } from './helpers/toy-rules.mjs';

const NOW = () => new Date('2026-01-02T03:04:05.000Z');
const review = (root, { config = {}, ...options } = {}) => runReview({ root, config: resolveConfig(config).config, git: false, now: NOW, rules: toyRules, ...options });
const playwright = fixtureRoot('adapters', 'js', 'playwright');
const shortly = (finding) => `${finding.location.file}:${finding.location.startLine} ${finding.ruleId} ${finding.severity}`;

/** A temp project. `files` maps a path to its text. */
function project(t, files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcr-engine-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const [name, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), text);
  }
  return dir;
}

test('a review gives a report that matches the schema, with sorted findings and a summary that adds up', async () => {
  const { report, models, notices } = await review(playwright);
  assert.deepEqual(schemaErrors('report.schema.json', report), []);
  assert.deepEqual([report.schemaVersion, report.tool.name, report.createdAt, report.mode, report.rulesRun, notices], [2, 'qa-core-review', '2026-01-02T03:04:05.000Z', { diffBase: null, llm: 'off' }, ['QCR-T001', 'QCR-T002', 'QCR-T003'], []]);
  assert.deepEqual(report.projects, [{ dir: '.', adapter: 'js', frameworks: ['playwright'] }]);
  assert.equal(report.root, playwright.split(path.sep).join('/'));
  assert.deepEqual(report.files.map((file) => [file.file, file.runner, file.parseStatus, file.tests.length]), [
    ['tests/api.spec.ts', 'playwright', 'ok', 3], ['tests/assertions.spec.ts', 'playwright', 'ok', 20], ['tests/checkout.spec.ts', 'playwright', 'ok', 11],
    ['tests/flow.spec.ts', 'playwright', 'ok', 12], ['tests/pages/cart-page.ts', 'playwright', 'ok', 0],
  ]);
  assert.deepEqual(models.map((model) => model.path), report.files.map((file) => file.file));

  const sorted = [...report.findings].sort((a, b) => a.location.file.localeCompare(b.location.file) || a.location.startLine - b.location.startLine || a.ruleId.localeCompare(b.ruleId));
  assert.deepEqual(report.findings.map(shortly), sorted.map(shortly));
  assert.deepEqual(report.findings.filter((finding) => finding.location.file === 'tests/checkout.spec.ts').map(shortly), [
    'tests/checkout.spec.ts:1 QCR-T003 info', 'tests/checkout.spec.ts:31 QCR-T002 warn', 'tests/checkout.spec.ts:69 QCR-T001 error',
  ]);
  const tests = report.files.flatMap((file) => file.tests);
  const count = (severity) => report.findings.filter((finding) => finding.severity === severity).length;
  const { summary } = report;
  assert.deepEqual([summary.files, summary.tests, summary.pass + summary.review + summary.fail, summary.errors, summary.warnings, summary.infos, summary.suppressed, summary.llmOnlyFiles],
    [5, tests.length, tests.length, count('error'), count('warn'), count('info'), 0, 0]);
  assert.deepEqual([summary.fail, summary.review], [tests.filter((item) => item.verdict === 'fail').length, tests.filter((item) => item.verdict === 'review').length]);
  assert.deepEqual(summary.byLanguage, { typescript: { files: 5, tests: tests.length, errors: summary.errors, warnings: summary.warnings } });
  assert.ok(summary.fail > 0 && summary.review > 0 && summary.pass > 0);
  assert.equal(formatSummary(report), `Summary: ${summary.pass} pass, ${summary.review} review, ${summary.fail} fail. ${summary.errors} errors, ${summary.warnings} warnings, ${summary.infos} info. 0 suppressed.`);
  // The same input gives the same report.
  assert.deepEqual((await review(playwright)).report, report);
});

test('a finding carries the rule, the test, the evidence and the defaults the rule left out', async () => {
  const { report } = await review(playwright);
  const file = report.files.find((item) => item.file === 'tests/checkout.spec.ts');
  const [note, wait, empty] = report.findings.filter((finding) => finding.location.file === file.file);
  const fills = file.tests.find((item) => item.title === 'fills the address');
  assert.deepEqual(empty, {
    id: fingerprint('QCR-T001', file.file, fills.fullTitle, 'fills the address'), ruleId: 'QCR-T001', ruleName: 'toy-no-check', severity: 'error', source: 'static',
    message: 'This test checks nothing.', evidence: 'fills the address', fix: 'Add an assertion.', goodExample: 'expect(total).toBe(1);',
    location: { file: file.file, startLine: 69, startColumn: 5, endLine: 69, endColumn: 6 }, testId: fills.id, confidence: 'high', suppressed: false,
    docsUrl: 'https://github.com/sprintsynergyio/qa-core-review/blob/main/docs/rules.md#qcr-t001',
  });
  assert.deepEqual([fills.verdict, fills.findingIds, fills.assertionCount, fills.location.startLine, fills.bodyLocation.file], ['fail', [empty.id], 0, 69, file.file]);
  assert.deepEqual([wait.fix, wait.goodExample, wait.confidence, wait.evidence], ['', undefined, 'high', 'page.waitForTimeout(2000)']);
  assert.equal(file.tests.find((item) => item.id === wait.testId).verdict, 'review');
  // A file-level finding has no test. Its evidence is put on one line, and info does not lower a verdict.
  assert.deepEqual([note.testId, note.evidence, note.confidence, note.message], [null, 'tests/checkout.spec.ts with spaces', 'medium', 'One of 5 files.']);
  assert.equal(file.tests.find((item) => item.title === 'adds a backpack to the cart').verdict, 'pass');
  assert.equal(docsUrlFor('QCR-A001'), 'https://github.com/sprintsynergyio/qa-core-review/blob/main/docs/rules.md#qcr-a001');
});

test('rules are chosen by the config and the options, and a rule that cannot run is listed with the reason', async () => {
  const ids = (result) => [...new Set(result.report.findings.map((finding) => finding.ruleId))].sort();
  const jest = fixtureRoot('adapters', 'js', 'jest');
  const all = await review(jest);
  assert.deepEqual(ids(all), ['QCR-T001', 'QCR-T002']);
  const skipped = Object.fromEntries(all.report.files.map((file) => [file.file, file.rulesSkipped]));
  assert.deepEqual(skipped['src/cart.test.ts'], [{ ruleId: 'QCR-T003', reason: 'does not apply to framework "jest"' }]);
  // The half-merged file also calls `cy.wait`, so the rule applies to it, but the lexical scanner gives no selectors.
  assert.deepEqual(skipped['src/broken.test.ts'], [{ ruleId: 'QCR-T003', reason: 'needs a capability this file does not have: selectors (the file was only partly parsed)' }]);
  // Its findings are less sure than those from a syntax tree.
  const broken = all.report.findings.filter((finding) => finding.location.file === 'src/broken.test.ts');
  assert.deepEqual(broken.map((finding) => [finding.ruleId, finding.location.startLine, finding.confidence]), [['QCR-T002', 11, 'low'], ['QCR-T002', 12, 'low'], ['QCR-T001', 16, 'low'], ['QCR-T002', 20, 'low']]);
  assert.ok(all.report.findings.filter((finding) => finding.location.file !== 'src/broken.test.ts').every((finding) => finding.confidence === 'high'));

  assert.deepEqual(ids(await review(jest, { onlyRules: ['QCR-T002'] })), ['QCR-T002']);
  assert.deepEqual(ids(await review(jest, { disabledRules: ['QCR-T002'] })), ['QCR-T001']);
  const off = await review(jest, { config: { rules: { 'QCR-T001': 'off' } } });
  assert.deepEqual([ids(off), off.report.rulesRun], [['QCR-T002'], ['QCR-T002', 'QCR-T003']]);
  const raised = await review(jest, { config: { rules: { 'QCR-T002': { severity: 'error', maxMs: 400 } } } });
  assert.deepEqual(raised.report.findings.filter((finding) => finding.ruleId === 'QCR-T002').map((finding) => [finding.severity, finding.message]), [['error', 'Hard wait of 500 ms.'], ['error', 'Hard wait of null ms.']]);
  const limited = await review(jest, { config: { rules: { 'QCR-T001': { languages: ['python'] } } } });
  assert.deepEqual(ids(limited), ['QCR-T002']);
  assert.deepEqual(limited.report.files[0].rulesSkipped.find((rule) => rule.ruleId === 'QCR-T001'), { ruleId: 'QCR-T001', reason: 'limited to other languages by the config: python' });
});

test('the fingerprint stays the same when lines are added above a test, and twins get their own ids', async (t) => {
  const body = "test('sleeps', async ({ page }) => {\n  await page.waitForTimeout(100);\n  await page.waitForTimeout(100);\n  await   page.waitForTimeout( 100 );\n});\n";
  const before = await review(project(t, { 'a.spec.ts': body }), { rules: [sleep] });
  const after = await review(project(t, { 'a.spec.ts': `// a new comment\nconst added = 1;\n\n${body}` }), { rules: [sleep] });
  assert.deepEqual(before.report.findings.map((finding) => finding.location.startLine), [2, 3, 4]);
  assert.deepEqual(after.report.findings.map((finding) => finding.location.startLine), [5, 6, 7]);
  assert.deepEqual(after.report.findings.map((finding) => finding.id), before.report.findings.map((finding) => finding.id));
  const ids = before.report.findings.map((finding) => finding.id);
  assert.equal(new Set(ids).size, 3);
  assert.deepEqual(ids.slice(0, 2), [fingerprint('QCR-T002', 'a.spec.ts', 'sleeps', 'page.waitForTimeout(100)'), fingerprint('QCR-T002', 'a.spec.ts', 'sleeps', 'page.waitForTimeout(100)', 1)]);
  assert.match(ids[0], /^[0-9a-f]{16}$/);
  // Whitespace in the evidence does not matter. The rule, the file and the test do.
  assert.equal(fingerprint('R', 'f', 't', 'a   b\n c '), fingerprint('R', 'f', 't', 'a b c'));
  assert.equal(new Set([fingerprint('R', 'f', 't', 'e'), fingerprint('S', 'f', 't', 'e'), fingerprint('R', 'g', 't', 'e'), fingerprint('R', 'f', 'u', 'e'), fingerprint('R', 'f', null, 'e'), fingerprint('R', 'f', 't', 'x')]).size, 6);
});

test('paths limit a review to files, folders and globs', async (t) => {
  const root = project(t, {
    'package.json': '{ "devDependencies": { "vitest": "^2.0.0" } }',
    'src/cart.test.ts': "test('a', () => { run(); });", 'src/price.test.ts': "test('b', () => { run(); });",
    'tests/e2e/login.spec.ts': "test('c', () => { run(); });", 'scripts/check.ts': "test('d', () => { run(); });", 'notes.txt': 'not code', 'src/types.d.ts': 'declare const x: number;',
  });
  const files = async (paths) => (await review(root, paths ? { paths: { files: [], folders: [], globs: [], ...paths } } : {})).report.files.map((file) => file.file);
  assert.deepEqual(await files(), ['src/cart.test.ts', 'src/price.test.ts', 'tests/e2e/login.spec.ts']);
  assert.deepEqual(await files({ folders: ['src'] }), ['src/cart.test.ts', 'src/price.test.ts']);
  assert.deepEqual(await files({ folders: ['.'] }), ['src/cart.test.ts', 'src/price.test.ts', 'tests/e2e/login.spec.ts']);
  assert.deepEqual(await files({ globs: ['**/*.spec.ts', 'src/c*'] }), ['src/cart.test.ts', 'tests/e2e/login.spec.ts']);
  // A named file is reviewed even when its name matches no include glob. A file no adapter knows is left out without a word.
  assert.deepEqual(await files({ files: ['scripts/check.ts', 'notes.txt', 'src/types.d.ts', 'src/price.test.ts'] }), ['scripts/check.ts', 'src/price.test.ts']);
  assert.deepEqual(await files({ files: ['scripts/check.ts'], folders: ['tests'] }), ['scripts/check.ts', 'tests/e2e/login.spec.ts']);
  assert.deepEqual((await review(root, { paths: { files: ['scripts/check.ts'], folders: [], globs: [] } })).report.projects, [{ dir: '.', adapter: 'js', frameworks: ['vitest'] }]);
});

test('files that cannot be reviewed are listed or noticed, and never stop the run', async (t) => {
  const mixed = await review(fixtureRoot('projects', 'monorepo-mixed'));
  assert.deepEqual(mixed.report.files.filter((file) => file.parseStatus === 'llm-only').map((file) => [file.language, file.languageHint, file.adapter, file.tier, file.tests.length]), [
    ['generic', 'scala', 'generic', 3, 0], ['java', null, 'java', 1, 0], ['python', null, 'python', 1, 0], ['python', null, 'python', 1, 0],
  ]);
  assert.deepEqual([mixed.report.summary.llmOnlyFiles, Object.keys(mixed.report.summary.byLanguage).sort()], [4, ['java', 'python', 'scala', 'typescript']]);
  assert.deepEqual(mixed.notices.sort(), [
    '1 java file is listed but not reviewed: this build has no static adapter for java.', '1 scala file is listed but not reviewed: this build has no static adapter for scala.',
    '2 python files are listed but not reviewed: this build has no static adapter for python.',
  ]);
  assert.deepEqual(mixed.models.map((model) => model.adapter), ['js', 'js']);
  assert.deepEqual(schemaErrors('report.schema.json', mixed.report), []);

  const root = project(t, { 'big.test.ts': `test('a', () => {});\n${'// filler\n'.repeat(120_000)}`, 'ok.test.ts': "test('a', () => { expect(1).toBe(1); });", 'bad.test.ts': "test('a', () => {});" });
  const fussy = (stage) => ({ ...jsAdapter, [stage]: (first, ...rest) => (first.path === 'bad.test.ts' || first.file?.path === 'bad.test.ts' ? (() => { throw new Error(`${stage} broke`); })() : jsAdapter[stage](first, ...rest)) });
  for (const stage of ['parse', 'normalize', 'collectHelpers']) {
    const result = await review(root, { registry: createRegistry([fussy(stage)]), rules: builtinRules });
    assert.deepEqual(result.report.files.map((file) => [file.file, file.parseStatus]), [['bad.test.ts', stage === 'collectHelpers' ? 'ok' : 'failed'], ['ok.test.ts', 'ok']], stage);
    assert.deepEqual(result.notices.map((notice) => notice.replace(/\(.*\)/, '()')), [
      'big.test.ts: skipped, because it is larger than 1 MB or cannot be read.',
      stage === 'collectHelpers' ? 'bad.test.ts: its assertion helpers could not be read ().' : 'bad.test.ts: the js adapter stopped with an error (). The file is reported as not parsed.',
    ].sort(stage === 'parse' ? undefined : () => 0), stage);
    assert.ok(result.notices.some((notice) => notice.includes(`${stage} broke`)), stage);
    assert.deepEqual(result.report.findings.map(shortly), stage === 'collectHelpers' ? [] : ['bad.test.ts:1 QCR-X001 info'], stage);
  }
});

test('QCR-X001: a file that cannot be parsed, or a test file with no test in it', async (t) => {
  assert.deepEqual(builtinRules.map((rule) => [rule.id, rule.name, rule.defaultSeverity, rule.scope, rule.requires]), [['QCR-X001', 'parse-error', 'info', 'universal', []]]);
  const root = project(t, {
    'empty.test.ts': '// nothing here yet\n', 'only-suite.spec.js': "describe('a', () => {});", 'garbage.test.ts': '<<<<<<< HEAD\n}}}} ))) ((( === @@@\n>>>>>>> b\n ]]] {{{ ;;;\n',
    'tests/helpers/util.ts': 'export const x = 1;', 'fine.test.ts': "test('a', () => {});",
  });
  const { report } = await review(root, { rules: builtinRules });
  assert.deepEqual(report.findings.map((finding) => [finding.location.file, finding.message, finding.testId, finding.evidence, finding.location.startLine, finding.severity]), [
    ['empty.test.ts', 'No test was found in this file, although its name says it is a test file.', null, 'empty.test.ts', 1, 'info'],
    ['garbage.test.ts', 'This file could not be parsed, so it was not reviewed.', null, 'garbage.test.ts', 1, 'info'],
    ['only-suite.spec.js', 'No test was found in this file, although its name says it is a test file.', null, 'only-suite.spec.js', 1, 'info'],
  ]);
  assert.ok(report.findings.every((finding) => finding.fix !== ''));
  assert.deepEqual(report.rulesRun, ['QCR-X001']);
  assert.deepEqual([report.summary.infos, report.summary.errors, report.summary.pass], [3, 0, 1]);
});

test('verdicts and the fail-on level ignore suppressed findings', () => {
  const finding = (severity, suppressed = false) => ({ severity, suppressed });
  assert.equal(verdictOf([]), 'pass');
  assert.equal(verdictOf([finding('info')]), 'pass');
  assert.equal(verdictOf([finding('info'), finding('warn')]), 'review');
  assert.equal(verdictOf([finding('warn'), finding('error')]), 'fail');
  assert.equal(verdictOf([finding('error', true), finding('warn', true)]), 'pass');
  assert.equal(verdictOf([finding('error', true), finding('warn')]), 'review');
  const table = { error: [false, false, true], warn: [false, true, true], info: [true, true, true], never: [false, false, false] };
  for (const [level, expected] of Object.entries(table)) assert.deepEqual(['info', 'warn', 'error'].map((severity) => failsAt([finding(severity)], level)), expected, level);
  assert.equal(failsAt([finding('error', true)], 'info'), false);
  assert.equal(failsAt([], 'info'), false);
});
