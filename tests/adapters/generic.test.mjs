// The generic adapter (SPEC.md Sections 9.5 and 17): files in a language with no static adapter.
// Golden models for listed files and for files read with line patterns, the language table,
// capabilities, QCR-X003, the three acceptance criteria of Milestone 15, and robustness.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  GENERIC_LANGUAGES, GENERIC_RULES, GENERIC_SYNTAX, MAX_SOURCE_BYTES, builtinAdapters, builtinProfiles, builtinRules, createRegistry, formatPretty, genericAdapter,
  languageHintFor, languageName, parseYaml, resolveConfig, runReview,
} from '../../dist/index.js';
import { capabilityFilled, fixtureRoot, frameworkFolders, normalizeProject, normalizeText } from '../helpers/adapter-suite.mjs';
import { ruleFixtureFolders, runRuleFixtures } from '../helpers/fixtures.mjs';
import { expectGolden } from '../helpers/golden.mjs';
import { repoRoot, schemaErrors } from '../helpers/schema.mjs';
import { reviewFiles } from '../helpers/temp-project.mjs';

const LISTED = fixtureRoot('adapters', 'generic', 'listed');
const PATTERNS = fixtureRoot('adapters', 'generic', 'patterns');
const patternsConfig = JSON.parse(fs.readFileSync(path.join(PATTERNS, 'qa-core-review.config.json'), 'utf8'));
const entryFor = (language, framework) => patternsConfig.generic.find((entry) => entry.language === language && (framework === undefined || entry.framework === framework));
const SCALA = entryFor('scala');
const RUST = entryFor('rust');
const models = new Map();
async function modelsOf(root, config = {}) {
  if (!models.has(root)) models.set(root, await normalizeProject(genericAdapter, root, config));
  return models.get(root);
}
/** One line per test: 'first-last title [modifiers] asserts:lines waits:lines'. */
const summary = (model) => model.tests.map((t) => `${t.span.startLine}-${t.span.endLine} ${t.title} [${t.modifiers.join(' ')}] asserts:${t.assertions.map((a) => a.span.startLine).join(',')} waits:${t.waits.map((w) => w.span.startLine).join(',')}`);
const withPatterns = (relPath, text, entry) => normalizeText(genericAdapter, relPath, text, { config: { generic: [{ ...entry, glob: '**' }] } });
const pretty = (report) => formatPretty(report, { color: false, quiet: false, maxFindings: 50, reportPaths: ['report.json'], unicode: true });
function tempProject(t, files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcr-generic-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), content);
  }
  return dir;
}
const review = (root, config = {}) => runReview({ root, config: resolveConfig(config).config, git: false });

test('the generic adapter is registered last, for Tier 3, with what line patterns can fill in and its own list of rules', () => {
  assert.deepEqual(frameworkFolders('generic'), ['listed', 'patterns']);
  assert.equal(createRegistry().get('generic'), genericAdapter);
  assert.equal(builtinAdapters.at(-1), genericAdapter);
  assert.equal(builtinProfiles.at(-1).id, 'generic');
  assert.deepEqual(createRegistry().forPath('modules/billing/InvoiceSpec.SCALA'), [genericAdapter]);
  assert.deepEqual([genericAdapter.tier, genericAdapter.languages, genericAdapter.grammars, genericAdapter.capabilities], [3, ['generic'], [], ['tests', 'modifiers', 'assertions', 'waits']]);
  assert.deepEqual(genericAdapter.onlyRules, ['QCR-A001', 'QCR-W001', 'QCR-F001', 'QCR-F002', 'QCR-X001', 'QCR-X002', 'QCR-X003']);
  assert.equal(genericAdapter.onlyRules, GENERIC_RULES);
  assert.ok(GENERIC_RULES.every((id) => builtinRules.some((rule) => rule.id === id)));
  const file = { path: 'tests/CartSpec.scala', absPath: '/virtual/tests/CartSpec.scala', text: '', language: 'generic', project: null };
  assert.deepEqual([genericAdapter.classifyFile(file), genericAdapter.detectFrameworks(file, null)], ['test', { runner: 'unknown', libraries: [], confidence: 'low' }]);
});

test('listed: every fixture matches its golden model and the schema, and is left to the LLM review', async () => {
  const results = await modelsOf(LISTED);
  assert.equal(results.length, 28);
  for (const { file, model } of results) {
    assert.deepEqual(schemaErrors('model.schema.json', model), [], file);
    expectGolden(model, path.join(LISTED, `${file}.model.json`));
    assert.deepEqual([model.language, model.adapter, model.tier, model.role, model.parseStatus, model.runner, model.capabilities, model.tests], ['generic', 'generic', 3, 'test', 'llm-only', 'unknown', [], []], file);
    assert.equal(model.languageHint, languageHintFor(file), file);
  }
  // A suppression comment is read in a listed file too.
  assert.deepEqual(results.find((entry) => entry.file === 'tests/OrderSpec.scala').model.suppressions.map((s) => [s.scope, s.rules, s.reason]), [['file', ['QCR-X003'], 'reviewed by hand until Scala has patterns']]);
});

test('vocabulary: every extension and every language of the table has a golden fixture, and every language has its comment syntax', async () => {
  const files = (await modelsOf(LISTED)).map((entry) => entry.file.toLowerCase());
  for (const extension of Object.keys(GENERIC_LANGUAGES)) assert.ok(files.some((file) => file.endsWith(extension)), `no fixture for ${extension}`);
  const hints = new Set((await modelsOf(LISTED)).map((entry) => entry.model.languageHint));
  assert.deepEqual([...hints].sort(), [...new Set(Object.values(GENERIC_LANGUAGES))].sort());
  assert.deepEqual(Object.keys(GENERIC_SYNTAX).sort(), [...hints].sort());
  assert.deepEqual(genericAdapter.extensions, Object.keys(GENERIC_LANGUAGES));
  // The longer extension wins, and an unknown one has no hint.
  assert.deepEqual(['a/shop.postman_collection.json', 'a/CartSpec.SCALA', 'a/cart.json', 'a/cart.zig'].map(languageHintFor), ['postman', 'scala', null, null]);
  assert.deepEqual(['cpp', 'objective-c', 'powershell', 'csharp', 'scala'].map(languageName), ['C++', 'Objective-C', 'PowerShell', 'C#', 'Scala']);
});

test('patterns: every fixture matches its golden model and the schema, and every declared capability is filled in a golden', async () => {
  const results = await modelsOf(PATTERNS, patternsConfig);
  assert.equal(results.length, 10);
  for (const { file, model } of results) {
    assert.deepEqual(schemaErrors('model.schema.json', model), [], file);
    expectGolden(model, path.join(PATTERNS, `${file}.model.json`));
    assert.deepEqual([model.language, model.parseStatus, model.role, model.capabilities[0]], ['generic', 'partial', 'test', 'tests'], file);
    for (const t of model.tests) {
      assert.deepEqual([t.suitePath, t.fullTitle, t.bodyHash], [[], t.title, null], file);
      assert.ok(t.assertions.every((a) => a.kind === 'other' && a.actual === null && a.matcher === null) && t.waits.every((w) => w.kind === 'fixed-sleep' && w.ms === null), file);
    }
  }
  for (const capability of genericAdapter.capabilities) assert.ok(results.some(({ model }) => model.capabilities.includes(capability) && capabilityFilled(capability, model)), capability);
  // The capabilities of a file are those of the patterns its entry gives.
  const capabilities = Object.fromEntries(results.map(({ file, model }) => [path.basename(file), model.capabilities.join(' ')]));
  assert.deepEqual(capabilities, {
    'CartSpec.scala': 'tests modifiers assertions waits', 'HelpersSpec.scala': 'tests modifiers assertions waits', 'CartTests.cs': 'tests modifiers assertions waits',
    'CartTests.swift': 'tests assertions', 'CheckoutSpec.swift': 'tests modifiers assertions', 'cart.bats': 'tests assertions waits', 'cart_test.clj': 'tests assertions',
    'cart_test.exs': 'tests modifiers assertions waits', 'cart_test.rs': 'tests modifiers assertions waits', 'cart_test.zig': 'tests assertions',
  });
});

test('patterns: where a test starts and ends, with braces and with indents', async () => {
  const model = async (name) => (await modelsOf(PATTERNS, patternsConfig)).find((entry) => entry.file === `tests/${name}`).model;
  // Braces: the title group, a title that says "should", a sleep, a skip, two tests on one line each, braces in strings and comments.
  assert.deepEqual(summary(await model('CartSpec.scala')), [
    '5-8 should add an item [] asserts: waits:', '10-15 totals the cart [] asserts:14 waits:13', '17-20 applies a coupon [skip] asserts:19 waits:',
    '22-22 is empty at first [] asserts:22 waits:', '24-24 prints the cart [] asserts: waits:', '26-33 keeps the items in a map [] asserts: waits:',
  ]);
  // The brace is on the line of the function, under the attribute. With no title group, the title is that line. A lifetime is no string.
  assert.deepEqual(summary(await model('cart_test.rs')), [
    '11-15 fn adds_an_item() [] asserts:14 waits:', '17-22 fn clears_the_cart() [] asserts: waits:', '24-30 fn syncs_with_the_server() [skip] asserts:29 waits:28',
    '32-37 async fn pays_the_order() [skip] asserts:36 waits:', '39-40 fn rejects_a_negative_quantity() [] asserts:40 waits:',
  ]);
  // The brace is on a line of its own. A marker above the test is part of it, and two test markers above one method are one test.
  assert.deepEqual(summary(await model('CartTests.cs')), [
    '7-13 public void AddsAnItem() [] asserts:12 waits:', '15-22 public void SyncsWithTheServer() [skip] asserts:21 waits:20', '24-30 public void TotalsTheCart(int quantity) [] asserts: waits:',
  ]);
  // Indents: the test is the deeper lines and the line that closes them. A helper below the last test is not part of it.
  assert.deepEqual(summary(await model('cart_test.exs')), [
    '5-8 adds an item [] asserts:7 waits:', '10-15 merges two carts [skip] asserts:14 waits:13', '17-20 prints the cart [only] asserts: waits:',
    '22-22 is not written yet [] asserts: waits:', '25-28 keeps the totals in a map [] asserts: waits:',
  ]);
  assert.deepEqual((await model('cart_test.exs')).tests.map((t) => t.statementCount), [4, 5, 3, 0, 4]);
  // Parentheses only: a test on one line has its assertion on that line.
  assert.deepEqual(summary(await model('cart_test.clj')), ['5-5 adds-an-item [] asserts:5 waits:', '7-9 clears-the-cart [] asserts: waits:', '11-12 totals-the-cart [] asserts:12 waits:']);
  assert.deepEqual(summary(await model('cart.bats')), ['7-11 adds an item [] asserts:9,10 waits:', '13-17 waits for the sync [] asserts: waits:15']);
  assert.deepEqual(summary(await model('CheckoutSpec.swift')), ['7-9 pays the order [] asserts:8 waits:', '11-13 rejects an expired card [only] asserts:12 waits:', '15-17 sends a receipt [skip] asserts: waits:']);
  // A helper method between tests is not a test. A language with no table entry is read line by line.
  assert.deepEqual(summary(await model('CartTests.swift')), ['4-8 testAddsAnItem [] asserts:7 waits:', '10-14 testClearsTheCart [] asserts: waits:']);
  assert.deepEqual(summary(await model('cart_test.zig')), ['3-7 adds an item [] asserts:6 waits:', '9-12 clears the cart [] asserts: waits:']);
  assert.deepEqual((await model('HelpersSpec.scala')).tests, []);
});

test('patterns: a match inside a test, a body that never closes, a skip reason, and a comment that suppresses', async () => {
  // The inner match is part of the outer test. The outer one has the assertion of the inner one.
  const nested = await withPatterns('tests/NestedSpec.scala', 'test("outer") {\n  test("inner") {\n    assert(true)\n  }\n}\ntest("next") {\n  println(1)\n}\n', SCALA);
  assert.deepEqual(summary(nested), ['1-5 outer [] asserts:3 waits:', '6-8 next [] asserts: waits:']);
  // A brace that is never closed: the test ends before the next test at the same indent, or at the end of the file.
  const open = await withPatterns('tests/OpenSpec.scala', 'test("one") {\n  if (ready) {\n  assert(ready)\n\ntest("two") {\n  println(2)\n', SCALA);
  assert.deepEqual(summary(open), ['1-3 one [] asserts:3 waits:', '5-6 two [] asserts: waits:']);
  // Two tests with one title get different ids.
  const twice = await withPatterns('tests/TwiceSpec.scala', 'test("same") { assert(a) }\ntest("same") { assert(b) }\n', SCALA);
  assert.equal(new Set(twice.tests.map((t) => t.id)).size, 2);
  // The reason of a skip comes from the `reason` group of the skip pattern.
  const reasons = await withPatterns('tests/skip_test.rs', '#[test]\n#[ignore = "needs the sandbox"]\nfn pays() {\n    assert!(true);\n}\n\n#[test]\n#[ignore]\nfn ships() {\n    assert!(true);\n}\n', RUST);
  assert.deepEqual(reasons.tests.map((t) => t.skip), [{ unconditional: true, conditional: false, reason: 'needs the sandbox' }, { unconditional: true, conditional: false, reason: null }]);
  // Suppression comments work as in any language, and one with no reason is QCR-X002.
  const { lines, report } = await reviewFiles({
    'tests/WaitSpec.scala': 'test("waits") {\n  // qa-core-review-disable-next-line QCR-W001 -- the queue has no event\n  Thread.sleep(100)\n  // qa-core-review-disable-next-line QCR-W001\n  Thread.sleep(200)\n  assert(done)\n}\n',
  }, { config: { generic: [SCALA] } });
  assert.deepEqual(lines, ['tests/WaitSpec.scala:3 W001 warn: Hard wait: the test sleeps for a fixed time.', 'tests/WaitSpec.scala:4 X002 info: This suppression has no reason, so it is ignored. Write the reason after " -- ".', 'tests/WaitSpec.scala:5 W001 warn: Hard wait: the test sleeps for a fixed time.']);
  assert.deepEqual(report.findings.map((finding) => finding.suppressed), [true, false, false]);
});

test('acceptance: Scala, Rust and Swift files are listed as llm-only with one QCR-X003 each, printed once per language', async (t) => {
  const dir = tempProject(t, {
    'src/test/scala/CartSpec.scala': 'class CartSpec extends AnyFunSuite {\n  test("adds") { cart.add("backpack") }\n}\n',
    'src/test/scala/OrderSpec.scala': 'class OrderSpec extends AnyFunSuite {\n  ignore("ships") { Thread.sleep(500) }\n}\n',
    'src/test/scala/PriceSpec.scala': 'class PriceSpec\n',
    'tests/cart_test.rs': '#[test]\n#[ignore]\nfn adds() {}\n',
    'ios/CartTests.swift': 'import XCTest\nfinal class CartTests: XCTestCase {\n    func testAdds() { sleep(2) }\n}\n',
  });
  const { report, notices, models: dumped } = await review(dir);
  assert.deepEqual(notices, []);
  assert.deepEqual(schemaErrors('report.schema.json', report), []);
  assert.deepEqual(report.files.map((file) => [file.file, file.languageHint, file.adapter, file.tier, file.parseStatus, file.tests.length]), [
    ['ios/CartTests.swift', 'swift', 'generic', 3, 'llm-only', 0], ['src/test/scala/CartSpec.scala', 'scala', 'generic', 3, 'llm-only', 0],
    ['src/test/scala/OrderSpec.scala', 'scala', 'generic', 3, 'llm-only', 0], ['src/test/scala/PriceSpec.scala', 'scala', 'generic', 3, 'llm-only', 0], ['tests/cart_test.rs', 'rust', 'generic', 3, 'llm-only', 0],
  ]);
  // One finding per file, and nothing else: info, at the top of the file, high confidence.
  assert.deepEqual(report.findings.map((finding) => [finding.location.file, finding.ruleId, finding.ruleName, finding.severity, finding.location.startLine, finding.confidence, finding.testId, finding.message]), [
    ['ios/CartTests.swift', 'QCR-X003', 'no-static-adapter', 'info', 1, 'high', null, 'No static rules for Swift yet. Run with --llm to review this file.'],
    ['src/test/scala/CartSpec.scala', 'QCR-X003', 'no-static-adapter', 'info', 1, 'high', null, 'No static rules for Scala yet. Run with --llm to review this file.'],
    ['src/test/scala/OrderSpec.scala', 'QCR-X003', 'no-static-adapter', 'info', 1, 'high', null, 'No static rules for Scala yet. Run with --llm to review this file.'],
    ['src/test/scala/PriceSpec.scala', 'QCR-X003', 'no-static-adapter', 'info', 1, 'high', null, 'No static rules for Scala yet. Run with --llm to review this file.'],
    ['tests/cart_test.rs', 'QCR-X003', 'no-static-adapter', 'info', 1, 'high', null, 'No static rules for Rust yet. Run with --llm to review this file.'],
  ]);
  assert.match(report.findings[0].fix, /^Run the review with --llm, or give line patterns for this language under "generic" in the config/);
  assert.match(report.findings[0].docsUrl, /docs\/rules\.md#qcr-x003$/);
  assert.deepEqual([report.summary.files, report.summary.tests, report.summary.errors, report.summary.warnings, report.summary.infos, report.summary.llmOnlyFiles], [5, 0, 0, 0, 5, 5]);
  assert.deepEqual(dumped.map((model) => model.parseStatus), ['llm-only', 'llm-only', 'llm-only', 'llm-only', 'llm-only']);
  // Every other rule is reported as skipped, with the reason.
  const skipped = Object.fromEntries(report.files[0].rulesSkipped.map((rule) => [rule.ruleId, rule.reason]));
  assert.deepEqual(Object.keys(skipped).length, builtinRules.length - 3);
  assert.equal(skipped['QCR-A002'], 'is not one of the rules that run on files of the generic adapter');
  assert.equal(skipped['QCR-A001'], 'needs capabilities this file does not have: tests, assertions');
  // The text output says it once per language, on the first file, with the number of other files.
  const text = pretty(report);
  assert.deepEqual(text.split('\n').filter((line) => line.startsWith('file  ') || line.includes('QCR-X003')), [
    'file  ios/CartTests.swift', '  QCR-X003  info   1:1  No static rules for Swift yet. Run with --llm to review this file.',
    'file  src/test/scala/CartSpec.scala (and 2 more Scala files)', '  QCR-X003  info   1:1  No static rules for Scala yet. Run with --llm to review this file.',
    'file  tests/cart_test.rs', '  QCR-X003  info   1:1  No static rules for Rust yet. Run with --llm to review this file.',
  ]);
  assert.ok(!text.includes('not shown'));
  assert.match(text, /\nSummary: 0 pass, 0 review, 0 fail\. 0 errors, 0 warnings, 5 info\. 0 suppressed\.\nBy language: Scala 3 files \(LLM only\), Rust 1 file \(LLM only\), Swift 1 file \(LLM only\)\.\n/);
  // Two files of one language: "1 more ... file". The rule can be switched off, and a file comment can suppress it.
  fs.rmSync(path.join(dir, 'src/test/scala/PriceSpec.scala'));
  assert.match(pretty((await review(dir)).report), /\nfile {2}src\/test\/scala\/CartSpec\.scala \(and 1 more Scala file\)\n/);
  assert.deepEqual((await review(dir, { rules: { 'QCR-X003': 'off' } })).report.findings, []);
  fs.writeFileSync(path.join(dir, 'tests/cart_test.rs'), '// qa-core-review-disable QCR-X003 -- reviewed by hand\n#[test]\nfn adds() {}\n');
  assert.deepEqual((await review(dir)).report.findings.filter((finding) => finding.suppressed).map((finding) => finding.location.file), ['tests/cart_test.rs']);
});

test('acceptance: with patterns, QCR-A001, QCR-W001, QCR-F001 and QCR-F002 run at low confidence and match the fixture markers', async () => {
  const folders = ruleFixtureFolders().filter((entry) => /^(scala|rust|ruby|swift)-/.test(entry.name));
  assert.deepEqual(folders.map((entry) => `${entry.ruleId}/${entry.name}`), [
    'QCR-A001/rust-cargotest', 'QCR-A001/scala-scalatest', 'QCR-F001/ruby-rspec', 'QCR-F001/swift-quick', 'QCR-F002/rust-cargotest', 'QCR-F002/scala-scalatest', 'QCR-W001/rust-cargotest', 'QCR-W001/scala-scalatest',
  ]);
  for (const { ruleId, name, dir } of folders) {
    const { report, bad, good } = await runRuleFixtures(dir);
    const own = report.findings.filter((finding) => finding.ruleId === ruleId);
    assert.ok(own.length >= 3, `${ruleId}/${name}`);
    // The markers are compared in tests/rules.test.mjs too. Here: every finding is low confidence, in a bad file, with a fix and no example of another language.
    for (const entry of [...bad, ...good]) assert.deepEqual(entry.actual, entry.expected, `${name}/${entry.file}`);
    assert.deepEqual([...new Set(report.findings.map((finding) => finding.confidence))], ['low'], `${ruleId}/${name}`);
    assert.ok(report.findings.every((finding) => finding.location.file.startsWith('bad/') && finding.fix !== '' && finding.goodExample === undefined), `${ruleId}/${name}`);
    assert.ok(report.files.every((file) => file.parseStatus === 'partial' && file.adapter === 'generic' && file.tests.length > 0), `${ruleId}/${name}`);
  }
  // The folder for QCR-X003 holds both kinds: files with no patterns (bad) and files of the same languages with patterns (good).
  const listed = await runRuleFixtures(ruleFixtureFolders().find((entry) => entry.ruleId === 'QCR-X003').dir);
  assert.deepEqual(listed.report.files.map((file) => [file.file, file.languageHint, file.parseStatus]), [
    ['bad/tests/CartSpec.scala', 'scala', 'llm-only'], ['bad/tests/CartTests.swift', 'swift', 'llm-only'], ['bad/tests/cart_test.rs', 'rust', 'llm-only'],
    ['good/tests/CartSpec.scala', 'scala', 'partial'], ['good/tests/CartTests.swift', 'swift', 'partial'], ['good/tests/cart_test.rs', 'rust', 'partial'],
  ]);
  assert.deepEqual(listed.report.findings.map((finding) => finding.ruleId), ['QCR-X003', 'QCR-X003', 'QCR-X003']);
  // The messages, on a file with one of each. The skip has a reason, because the pattern names it.
  const { lines, report } = await reviewFiles({
    'tests/cart_test.rs': '#[test]\nfn clears_the_cart() {\n    let mut cart = Cart::new();\n    cart.clear();\n}\n\n#[test]\n#[ignore = "needs the payment sandbox"]\nfn pays_the_order() {\n    sleep(Duration::from_secs(2));\n    assert!(Checkout::new().pay("4111", 29.99).is_ok());\n}\n',
    'spec/cart_spec.rb': 'RSpec.describe Cart do\n  fit "adds an item" do\n    expect(Cart.new.add("backpack").size).to eq(1)\n  end\nend\n',
  }, { config: { generic: [RUST, JSON.parse(fs.readFileSync(path.join(ruleFixtureFolders().find((entry) => entry.name === 'ruby-rspec').dir, 'qa-core-review.config.json'), 'utf8')).generic[0]] } });
  assert.deepEqual(lines, [
    'spec/cart_spec.rb:2 F001 error: This test is focused, so the runner skips every other test.',
    'tests/cart_test.rs:1 A001 error: This test has no assertion, so it passes whatever the code does.',
    'tests/cart_test.rs:7 F002 warn: This test is skipped: needs the payment sandbox.',
    'tests/cart_test.rs:10 W001 warn: Hard wait: the test sleeps for a fixed time.',
  ]);
  assert.deepEqual(report.findings.map((finding) => finding.confidence), ['low', 'low', 'low', 'low']);
  assert.deepEqual(report.files.map((file) => file.tests.map((entry) => entry.verdict)), [['fail'], ['fail', 'review']]);
  // The rules that line patterns cannot feed never run, and a rule whose pattern is missing is skipped for that reason.
  const ruby = Object.fromEntries(report.files[0].rulesSkipped.map((rule) => [rule.ruleId, rule.reason]));
  assert.deepEqual(Object.keys(ruby).sort(), builtinRules.map((rule) => rule.id).filter((id) => !GENERIC_RULES.includes(id)).sort());
  assert.equal(ruby['QCR-N001'], 'is not one of the rules that run on files of the generic adapter');
  const rust = Object.fromEntries(report.files[1].rulesSkipped.map((rule) => [rule.ruleId, rule.reason]));
  assert.equal(rust['QCR-F001'], undefined); // a skip pattern is enough for the modifiers: no test is focused, and the rule says nothing
  const noSleep = await reviewFiles({ 'tests/cart_test.rs': '#[test]\nfn waits() {\n    sleep(1);\n}\n' }, { config: { generic: [{ ...RUST, patterns: { testPattern: RUST.patterns.testPattern } }] } });
  assert.deepEqual(noSleep.lines, []);
  assert.deepEqual(noSleep.report.files[0].rulesSkipped.filter((rule) => GENERIC_RULES.includes(rule.ruleId)).map((rule) => [rule.ruleId, rule.reason]), [
    ['QCR-A001', 'needs a capability this file does not have: assertions (the file was only partly parsed)'],
    ['QCR-W001', 'needs a capability this file does not have: waits (the file was only partly parsed)'],
    ['QCR-F001', 'needs a capability this file does not have: modifiers (the file was only partly parsed)'],
    ['QCR-F002', 'needs a capability this file does not have: modifiers (the file was only partly parsed)'],
  ]);
});

test('acceptance: binary files and files over 1 MB are skipped with a notice', async (t) => {
  const big = `// ${'x'.repeat(98)}\n`.repeat(Math.ceil((MAX_SOURCE_BYTES + 1) / 101));
  const dir = tempProject(t, {
    'tests/CartSpec.scala': 'class CartSpec\n',
    'tests/BigSpec.scala': big,
    'tests/blob_test.rs': Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00, 0x00, 0x00, 0x10, 0x20]),
    'tests/snapshots/cart.png': Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]),
    'tests/snapshots/cart.txt': 'a text file that the glob also takes\n',
  });
  assert.ok(fs.statSync(path.join(dir, 'tests/BigSpec.scala')).size > MAX_SOURCE_BYTES);
  // The config entry takes every file of a folder, whatever its extension.
  const { report, notices } = await review(dir, { generic: [{ glob: 'tests/snapshots/**', language: 'text' }] });
  assert.deepEqual(notices, [
    'tests/BigSpec.scala: skipped, because it is larger than 1 MB or cannot be read.',
    'tests/blob_test.rs: skipped, because it looks like a binary file.',
    'tests/snapshots/cart.png: skipped, because it looks like a binary file.',
  ]);
  assert.deepEqual(report.files.map((file) => [file.file, file.languageHint, file.parseStatus]), [['tests/CartSpec.scala', 'scala', 'llm-only'], ['tests/snapshots/cart.txt', 'text', 'llm-only']]);
  assert.deepEqual(report.findings.map((finding) => finding.message), ['No static rules for Scala yet. Run with --llm to review this file.', 'No static rules for Text yet. Run with --llm to review this file.']);
  assert.equal(report.summary.files, 2);
});

test('robustness: an empty file, CRLF, a byte order mark, titles that are not ASCII, and a 1,000-line file in time', async (t) => {
  const source = 'class CartSpec extends AnyFunSuite {\n  test("fügt einen Artikel hinzu 🛒") {\n    assert(cart.size == 1)\n  }\n\n  test("カートを空にする") {\n    cart.clear()\n  }\n}\n';
  const lf = await withPatterns('tests/CartSpec.scala', source, SCALA);
  assert.deepEqual(summary(lf), ['2-4 fügt einen Artikel hinzu 🛒 [] asserts:3 waits:', '6-8 カートを空にする [] asserts: waits:']);
  // An empty file and a file of blank lines: no test, no crash. Without patterns the file is listed as it is.
  for (const text of ['', '\n\n   \n']) {
    assert.deepEqual([(await withPatterns('tests/EmptySpec.scala', text, SCALA)).tests, (await normalizeText(genericAdapter, 'tests/EmptySpec.scala', text)).parseStatus], [[], 'llm-only']);
  }
  const big = `class BigSpec extends AnyFunSuite {\n${Array.from({ length: 200 }, (_, n) => `  test("adds item ${n + 1}") {\n    val cart = new Cart()\n    cart.add("backpack", ${n + 1})\n    assert(cart.size == ${n + 1})\n  }\n`).join('')}}\n`;
  assert.ok(big.split('\n').length > 1000);
  const dir = tempProject(t, {
    'tests/CrlfSpec.scala': source.replace(/\n/g, '\r\n'),
    'tests/BomSpec.scala': `${String.fromCharCode(0xfeff)}${source}`,
    'tests/LfSpec.scala': source,
    'tests/BrokenSpec.scala': 'test("one") {{{\n  assert(x\n))) }\n"unclosed string\n/* unclosed comment\ntest("two") {\n',
    'tests/BigSpec.scala': big,
  });
  const started = performance.now();
  const { report, models: dumped, notices } = await review(dir, { generic: [SCALA] });
  const elapsed = performance.now() - started;
  assert.deepEqual(notices, []);
  assert.ok(elapsed < 2000, `took ${Math.round(elapsed)} ms`);
  const byFile = Object.fromEntries(dumped.map((model) => [path.basename(model.path), model]));
  // CRLF and a byte order mark give the same tests, on the same lines, as the plain file.
  for (const name of ['CrlfSpec.scala', 'BomSpec.scala']) assert.deepEqual(byFile[name].tests.map((entry) => [entry.title, entry.span, entry.assertions.length]), byFile['LfSpec.scala'].tests.map((entry) => [entry.title, entry.span, entry.assertions.length]), name);
  assert.equal(byFile['BigSpec.scala'].tests.length, 200);
  assert.deepEqual(summary(byFile['BrokenSpec.scala']), ['1-4 one [] asserts:2 waits:']);
  assert.deepEqual(report.findings.map((finding) => `${finding.location.file}:${finding.location.startLine} ${finding.ruleId}`), ['tests/BomSpec.scala:6 QCR-A001', 'tests/CrlfSpec.scala:6 QCR-A001', 'tests/LfSpec.scala:6 QCR-A001']);
  for (const model of dumped) assert.deepEqual(schemaErrors('model.schema.json', model), [], model.path);
});

test('config: patterns need a testPattern, and a file that the patterns find no test in gets QCR-X001', async () => {
  assert.throws(() => resolveConfig({ generic: [{ glob: '**/*.rs', language: 'rust', patterns: { sleepPattern: 'sleep' } }] }), (error) => {
    assert.deepEqual(error.problems.map((problem) => [problem.pointer, problem.message]), [['/generic/0/patterns', 'is missing the required key "testPattern"']]);
    return true;
  });
  const { lines } = await reviewFiles({ 'tests/HelpersSpec.scala': 'object Helpers {\n  def cart = new Cart()\n}\n' }, { config: { generic: [SCALA] } });
  assert.deepEqual(lines, ['tests/HelpersSpec.scala:1 X001 info: No test was found in this file, although its name says it is a test file.']);
  // An entry with no patterns only names the language of its files.
  const named = await reviewFiles({ 'checks/cart.zig': 'test "adds" {}\n' }, { config: { generic: [{ glob: 'checks/**', language: 'zig' }] } });
  assert.deepEqual(named.lines, ['checks/cart.zig:1 X003 info: No static rules for Zig yet. Run with --llm to review this file.']);
  // A file whose language nothing names. Discovery never picks one, so this is the adapter used on its own.
  const unknown = await normalizeText(genericAdapter, 'checks/cart.xyz', 'check cart\n');
  const [finding] = builtinRules.find((rule) => rule.id === 'QCR-X003').check({ file: unknown, all: [unknown], config: resolveConfig({}).config, options: {} });
  assert.deepEqual([unknown.languageHint, finding.message], [null, 'No static rules for this language yet. Run with --llm to review this file.']);
});

test('docs/languages.md shows the tier table and the Scala and Rust patterns that the fixtures use', () => {
  const docs = fs.readFileSync(path.join(repoRoot, 'docs', 'languages.md'), 'utf8');
  for (const tier of [1, 2, 3]) assert.match(docs, new RegExp(`\\n\\| ${tier} \\| v0\\.[12]\\.0 \\| `));
  const yaml = [...docs.matchAll(/```yaml\n([\s\S]*?)```/g)].map((match) => parseYaml(match[1]).generic[0]);
  assert.deepEqual(yaml.map((entry) => [entry.language, entry.patterns]), [['scala', SCALA.patterns], ['rust', RUST.patterns]]);
  const json = JSON.parse(/```json\n([\s\S]*?)```/.exec(docs)[1]).generic[0];
  assert.deepEqual(json.patterns, RUST.patterns);
  for (const extension of Object.keys(GENERIC_LANGUAGES)) assert.ok(docs.includes(` ${extension}`) || docs.includes(`\`${extension}`), extension);
  assert.ok(docs.includes('QCR-X003  info   1:1  No static rules for Scala yet. Run with --llm to review this file.'));
});

test('docs/languages.md: the two example files get the findings the page says they get', async () => {
  const docs = fs.readFileSync(path.join(repoRoot, 'docs', 'languages.md'), 'utf8');
  const scala = /```scala\n([\s\S]*?)```/.exec(docs)[1];
  const rust = /```rust\n([\s\S]*?)```/.exec(docs)[1];
  const { lines } = await reviewFiles({ 'src/test/scala/CartSpec.scala': scala, 'tests/cart_test.rs': rust }, { config: { generic: [{ ...SCALA, glob: '**/src/test/scala/**/*Spec.scala' }, RUST] } });
  assert.deepEqual(lines.map((line) => line.split(':').slice(0, 2).join(':').replace(/ (warn|error)$/, '')), [
    'src/test/scala/CartSpec.scala:2 A001', 'src/test/scala/CartSpec.scala:7 F002', 'src/test/scala/CartSpec.scala:9 W001',
    'tests/cart_test.rs:1 A001', 'tests/cart_test.rs:7 F002', 'tests/cart_test.rs:10 W001',
  ]);
  assert.ok(lines.includes('tests/cart_test.rs:7 F002 warn: This test is skipped: needs the payment sandbox.'));
});
