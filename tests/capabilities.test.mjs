// Capability gating (src/engine/capabilities.ts).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { missingCapabilities, selectRules, skipReason } from '../dist/index.js';

const file = (changes = {}) => ({
  path: 'tests/test_cart.py',
  language: 'python',
  runner: 'pytest',
  libraries: ['selenium'],
  parseStatus: 'ok',
  capabilities: ['tests', 'assertions', 'waits'],
  ...changes,
});

const rule = (changes = {}) => ({
  id: 'QCR-T001',
  name: 'test-rule',
  defaultSeverity: 'warn',
  scope: 'universal',
  requires: [],
  description: 'A rule for tests.',
  check: () => [],
  ...changes,
});

test('a rule with no requirements runs on any file', () => {
  assert.equal(skipReason(rule(), file()), null);
});

test('a rule runs when the file has every capability it requires', () => {
  const needs = rule({ requires: ['tests', 'assertions'] });
  assert.deepEqual(missingCapabilities(needs, file()), []);
  assert.equal(skipReason(needs, file()), null);
});

test('a rule is skipped when one capability is missing, and the reason names it', () => {
  const needs = rule({ requires: ['tests', 'selectors'] });
  assert.deepEqual(missingCapabilities(needs, file()), ['selectors']);
  assert.equal(skipReason(needs, file()), 'needs a capability this file does not have: selectors');
});

test('several missing capabilities are all named, in the order the rule lists them', () => {
  const needs = rule({ requires: ['mocks', 'assertions', 'subject'] });
  assert.equal(skipReason(needs, file()), 'needs capabilities this file does not have: mocks, subject');
});

test('the reason says so when the file was only partly parsed', () => {
  const needs = rule({ requires: ['try-blocks'] });
  assert.equal(
    skipReason(needs, file({ parseStatus: 'partial' })),
    'needs a capability this file does not have: try-blocks (the file was only partly parsed)',
  );
});

test('appliesTo.languages limits a rule to those languages', () => {
  const jsOnly = rule({ appliesTo: { languages: ['javascript', 'typescript'] } });
  assert.equal(skipReason(jsOnly, file()), 'does not apply to language "python"');
  assert.equal(skipReason(jsOnly, file({ language: 'typescript' })), null);
});

test('appliesTo.frameworks matches the runner or any library', () => {
  const ui = rule({ appliesTo: { frameworks: ['playwright', 'selenium'] } });
  assert.equal(skipReason(ui, file()), null);
  assert.equal(skipReason(ui, file({ runner: 'playwright', libraries: [] })), null);
  assert.equal(skipReason(ui, file({ libraries: ['restassured'] })), 'does not apply to frameworks "pytest", "restassured"');
  assert.equal(skipReason(ui, file({ runner: 'unknown', libraries: [] })), 'does not apply to framework "unknown"');
});

test('the language check comes before the capability check', () => {
  const both = rule({ appliesTo: { languages: ['java'] }, requires: ['selectors'] });
  assert.equal(skipReason(both, file()), 'does not apply to language "python"');
});

test('selectRules keeps the given order and lists every skipped rule with its reason', () => {
  const rules = [
    rule({ id: 'QCR-T003', requires: ['waits'] }),
    rule({ id: 'QCR-T001', requires: ['selectors'] }),
    rule({ id: 'QCR-T002' }),
    rule({ id: 'QCR-T004', appliesTo: { languages: ['java'] } }),
  ];
  const selection = selectRules(rules, file());
  assert.deepEqual(selection.run.map((r) => r.id), ['QCR-T003', 'QCR-T002']);
  assert.deepEqual(selection.skipped, [
    { ruleId: 'QCR-T001', reason: 'needs a capability this file does not have: selectors' },
    { ruleId: 'QCR-T004', reason: 'does not apply to language "python"' },
  ]);
});

test('selectRules with no rules gives two empty lists', () => {
  assert.deepEqual(selectRules([], file()), { run: [], skipped: [] });
});
