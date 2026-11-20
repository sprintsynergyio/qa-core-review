// End to end proof of the adapter interface and capability gating, without tree-sitter:
// toy file -> adapter.parse -> adapter.normalize -> NFile -> schema -> rule selection -> findings.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { createRegistry, selectRules } from '../dist/index.js';
import { expectGolden } from './helpers/golden.mjs';
import { repoRoot, schemaErrors } from './helpers/schema.mjs';
import { toyAdapter, toyContext, toySourceFile } from './helpers/toy-adapter.mjs';

const fixtureDir = path.join(repoRoot, 'tests', 'fixtures', 'toy');
const relPath = 'tests/fixtures/toy/cart.toy';

async function normalizeFixture() {
  const registry = createRegistry([toyAdapter]);
  const [adapter] = registry.forPath(relPath);
  const source = toySourceFile(relPath, fs.readFileSync(path.join(fixtureDir, 'cart.toy'), 'utf8'));
  assert.equal(adapter.classifyFile(source), 'test');
  const parsed = await adapter.parse(source, toyContext);
  return adapter.normalize(parsed, toyContext);
}

/** Rules written only against the normalized model, as real rules will be. */
function makeRules() {
  const calls = [];
  const base = { defaultSeverity: 'error', scope: 'universal', description: 'A toy rule.' };
  const perTest = (id, requires, extra, find) => ({
    ...base,
    ...extra,
    id,
    name: id.toLowerCase(),
    requires,
    check({ file }) {
      calls.push(id);
      return file.tests.flatMap((t) => find(t).map((draft) => ({ testId: t.id, span: t.span, ...draft })));
    },
  });
  const rules = [
    perTest('TOY-A001', ['tests', 'assertions'], {}, (t) =>
      t.assertions.length === 0 && t.skip === null ? [{ message: 'This test has no assertion.', evidence: t.title }] : []),
    perTest('TOY-W001', ['waits'], { defaultSeverity: 'warn' }, (t) =>
      t.waits.filter((w) => w.kind === 'fixed-sleep').map((w) => ({ message: `Hard wait of ${w.ms} ms.`, evidence: w.text, span: w.span }))),
    // If this rule ran on a file with no selector facts, every test would look like it has no selectors.
    perTest('TOY-S001', ['selectors'], {}, (t) => (t.selectors.length === 0 ? [{ message: 'No selectors.', evidence: t.title }] : [])),
    perTest('TOY-M001', ['mocks', 'subject'], {}, () => [{ message: 'Should never run.', evidence: '' }]),
    perTest('TOY-P001', ['tests'], { appliesTo: { languages: ['python'] } }, () => [{ message: 'Should never run.', evidence: '' }]),
    perTest('TOY-U001', ['tests'], { scope: 'framework', appliesTo: { frameworks: ['playwright'] } }, () => [{ message: 'Should never run.', evidence: '' }]),
  ];
  return { rules, calls };
}

test('the toy adapter produces an NFile that validates against model.schema.json', async () => {
  const file = await normalizeFixture();
  assert.deepEqual(schemaErrors('model.schema.json', file), []);
  assert.equal(file.adapter, 'toy');
  assert.equal(file.tier, 3);
  assert.deepEqual(file.capabilities, toyAdapter.capabilities);
});

test('the toy model matches its golden file', async () => {
  expectGolden(await normalizeFixture(), path.join(fixtureDir, 'cart.model.json'));
});

test('the toy model has the tests, suites, modifiers, assertions and waits of the source file', async () => {
  const file = await normalizeFixture();
  assert.deepEqual(file.tests.map((t) => t.fullTitle), [
    'Cart > adds an item',
    'Cart > removes an item',
    'Cart > is empty',
    'Checkout > pays with a saved card',
    'Checkout > pays with a saved card',
  ]);
  assert.deepEqual(file.tests.map((t) => t.modifiers), [[], ['skip'], ['only'], [], []]);
  assert.deepEqual(file.tests.map((t) => t.assertions.length), [1, 0, 0, 1, 0]);
  assert.deepEqual(file.suites.map((s) => [s.title, s.testIds.length]), [['Cart', 3], ['Checkout', 2]]);

  const [first] = file.tests;
  assert.deepEqual(first.span, { startLine: 3, startColumn: 1, endLine: 6, endColumn: 13 });
  assert.deepEqual(first.bodySpan, { startLine: 4, startColumn: 3, endLine: 6, endColumn: 13 });
  assert.equal(first.assertions[0].kind, 'equality');
  assert.equal(first.assertions[0].actual.text, 'total');
  assert.deepEqual(first.assertions[0].expected.literal, { type: 'number', value: '42' });
  assert.deepEqual(first.waits.map((w) => [w.kind, w.ms]), [['fixed-sleep', 3000]]);

  // Two tests with the same full title get different ids from the occurrence index.
  const ids = file.tests.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(file.tests[3].fullTitle, file.tests[4].fullTitle);
});

test('rules whose capabilities the adapter does not declare are skipped and listed with a reason', async () => {
  const file = await normalizeFixture();
  const { rules } = makeRules();
  const selection = selectRules(rules, file);
  assert.deepEqual(selection.run.map((r) => r.id), ['TOY-A001', 'TOY-W001']);
  assert.deepEqual(selection.skipped, [
    { ruleId: 'TOY-S001', reason: 'needs a capability this file does not have: selectors' },
    { ruleId: 'TOY-M001', reason: 'needs capabilities this file does not have: mocks, subject' },
    { ruleId: 'TOY-P001', reason: 'does not apply to language "generic"' },
    { ruleId: 'TOY-U001', reason: 'does not apply to framework "unknown"' },
  ]);
});

test('only the selected rules run, so a missing capability never becomes a false finding', async () => {
  const file = await normalizeFixture();
  const { rules, calls } = makeRules();
  const selection = selectRules(rules, file);
  const ctx = { file, all: [file], config: toyContext.config, options: {} };
  const findings = selection.run.flatMap((r) => r.check(ctx).map((draft) => ({ ruleId: r.id, ...draft })));

  assert.deepEqual(calls, ['TOY-A001', 'TOY-W001']);
  const titleOf = (id) => file.tests.find((t) => t.id === id).title;
  assert.deepEqual(findings.map((f) => [f.ruleId, titleOf(f.testId), f.span.startLine, f.message]), [
    ['TOY-A001', 'is empty', 9, 'This test has no assertion.'],
    ['TOY-A001', 'pays with a saved card', 15, 'This test has no assertion.'],
    ['TOY-W001', 'adds an item', 6, 'Hard wait of 3000 ms.'],
  ]);
  assert.ok(!findings.some((f) => f.ruleId === 'TOY-S001'));
});

test('project detection reads files through the probe and runs nothing', () => {
  const probe = (files) => ({ dir: 'apps/shop', hasFile: (name) => files.includes(name), readText: () => null, list: () => [] });
  assert.deepEqual(toyAdapter.detectProject(probe(['toy.manifest'])), {
    dir: 'apps/shop',
    adapterId: 'toy',
    languages: ['generic'],
    frameworks: [],
    evidence: ['toy.manifest'],
  });
  assert.equal(toyAdapter.detectProject(probe(['package.json'])), null);
});

test('CRLF input gives the same model as LF input', async () => {
  const text = fs.readFileSync(path.join(fixtureDir, 'cart.toy'), 'utf8');
  const lf = toyAdapter.normalize(await toyAdapter.parse(toySourceFile(relPath, text), toyContext), toyContext);
  const crlf = toyAdapter.normalize(await toyAdapter.parse(toySourceFile(relPath, text.replace(/\n/g, '\r\n')), toyContext), toyContext);
  assert.deepEqual(crlf, lf);
});
