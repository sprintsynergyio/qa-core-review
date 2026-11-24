// The shared selector classifier (SPEC.md Section 10.7) and the options of QCR-W001 and
// QCR-S001: `maxMs`, `allowPatterns` and `testIdAttribute`.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { ConfigError, FIX_TEXT, classifySelector, examplesFor, isGeneratedName, resolveConfig, runReview, selectorStrategy } from '../dist/index.js';
import { ruleFixtureFolders } from './helpers/fixtures.mjs';

const TEST_IDS = ['data-testid', 'data-test', 'data-qa', 'data-cy'];
const classify = (value, strategy = selectorStrategy(value, TEST_IDS), positional) => classifySelector({ value, strategy, ...(positional ? { positional } : {}) })?.reason ?? null;
const folder = (ruleId, name) => ruleFixtureFolders().find((entry) => entry.ruleId === ruleId && entry.name === name).dir;
const review = (root, config = {}) => runReview({ root, config: resolveConfig(config).config, git: false });
const found = (report, file) => report.findings.filter((finding) => finding.location.file === file).map((finding) => `${finding.location.startLine} ${finding.severity}`);

// Selector as it is written in a test, and why it is brittle (null: it is fine).
const TABLE = [
  // XPath: starts at the page root, has a positional index, or has 4 or more steps.
  ['/html/body/div[1]/div/div[2]/button[3]', 'xpath'],
  ['/html/body/main', 'xpath'],
  ['(/html/body//button)', 'xpath'],
  ['//div[3]/div[2]/button[2]', 'xpath'],
  ['(//button)[1]', 'xpath'],
  ['//li[last()]', 'xpath'],
  ['//li[last() - 1]', 'xpath'],
  ['//li[position()=2]', 'xpath'],
  ['xpath=//div[@id="root"]//ul/li/a', 'xpath'],
  ['//section/div/ul/li', 'xpath'],
  ['//a | //section/div/ul/li', 'xpath'],
  ['//button[@data-test="add-to-cart"]', null],
  ['//label[text()="First Name"]/following-sibling::input', null],
  ['//ul/li/a', null],
  ['//button[text()="Step 1/2/3/4 [2]"]', null],
  ['./div/../span', null],
  ['//div[./span[@class="price"]]/button', null],
  // Position in the page.
  ['#root > div > div:nth-child(2) > div.css-1q2w3e4 > button', 'position'],
  ['li:nth-of-type(3) a', 'position'],
  ['tr:nth-last-child(1) td', 'position'],
  ['p:nth-last-of-type(2)', 'position'],
  ['.inventory_item >> nth=2', 'position'],
  ['text=Add to cart >> nth=1', 'position'],
  ['[data-test="note"][title=":nth-child(2)"]', null],
  // Generated class and id names.
  ['.css-1q2w3e4', 'generated'],
  ['button.sc-bdnylx', 'generated'],
  ['.jss42', 'generated'],
  ['.makeStyles-root-12', 'generated'],
  ['._button_1x2y3_12', 'generated'],
  ['.Button_primary__3xK2a', 'generated'],
  ['.ng-tns-c123-4', 'generated'],
  ['#ember123', 'generated'],
  ['#item-4f3a2b1c', 'generated'],
  ['[class*="css-1q2w3e4"]', 'generated'],
  ['[id="ember77"] > span', 'generated'],
  ['css=div.css-1q2w3e4', 'generated'],
  ['.card__title', null],
  ['.nav_items_list', null],
  ['.product-2024', null],
  ['.col-md-12', null],
  ['.step1000', null],
  ['#user-name', null],
  ['.inventory_item_name', null],
  ['[data-testid="item-4f3a2b1c"]', null],
  ['[href="/items/4f3a2b1c"]', null],
  ['a:has-text("code .css-1q2w3e4")', null],
  // Four or more combinators.
  ['#root > div > main > section > button', 'deep'],
  ['.page .list .item .price .amount', 'deep'],
  ['ul > li + li ~ li a', 'deep'],
  ['#app >> .list >> .item >> .price >> .amount', 'deep'],
  ['.title, #root > div > main > section > button', 'deep'],
  ['.cart_list .cart_item .inventory_item_name', null],
  ['ul > li > a > span', null],
  ['li:not(.a > .b > .c > .d > .e)', null],
  ['button:has-text("a > b > c > d > e")', null],
  // Test ids and plain selectors are never reported.
  ['[data-testid="checkout"]', null],
  ['[data-test="add-to-cart-sauce-labs-backpack"]', null],
  ['[data-qa=submit]', null],
  ['#login-button', null],
  ['[name="user-name"]', null],
];

test('the selector classifier: a table of selectors with the reason each one is brittle', () => {
  assert.ok(TABLE.length >= 40, `the table has ${TABLE.length} selectors`);
  assert.deepEqual(Object.fromEntries(TABLE.map(([selector]) => [selector, classify(selector)])), Object.fromEntries(TABLE));
  // Every reason is in the table.
  assert.deepEqual([...new Set(TABLE.map(([, reason]) => reason))].sort(), ['deep', 'generated', 'position', 'xpath', null].sort());
});

test('the classifier reads the strategy an adapter gives: bare names, texts, and picks by position', () => {
  // `By.id("ember123")` and `By.className("css-1q2w3e4")` give the name with no `#` or `.`.
  assert.deepEqual([classify('ember123', 'id'), classify('css-1q2w3e4', 'class'), classify('user-name', 'id'), classify('btn_primary', 'class')], ['generated', 'generated', null, null]);
  // `By.xpath(...)` is XPath whatever it starts with. A CSS strategy with an XPath string is read as XPath too.
  assert.deepEqual([classify('id("root")/div[2]', 'xpath'), classify('//div[2]', 'css'), classify('(//ul/li/a/span)', 'css')], ['xpath', 'xpath', 'xpath']);
  // A role, a label, a text or a test id is not a selector string.
  for (const strategy of ['role', 'label', 'text', 'test-id', 'link-text', 'other']) assert.equal(classify('a.css-1q2w3e4 > b > c > d > e:nth-child(2)', strategy), null, strategy);
  assert.equal(classify(null, 'other'), null);

  const pick = (kind, index, baseStrategy) => classifySelector({ value: '.item', strategy: baseStrategy, positional: { kind, index, baseStrategy } });
  assert.deepEqual([pick('nth', 2, 'css'), pick('nth', 3, 'role'), pick('first', null, 'css'), pick('last', null, 'text')], [
    { reason: 'pick', detail: 'index 2' }, { reason: 'pick', detail: 'index 3' }, { reason: 'pick', detail: 'first' }, { reason: 'pick', detail: 'last' },
  ]);
  // Index 0, an index that is not a literal, and the first or last of a role, a label or a test id are fine.
  assert.deepEqual([pick('nth', 0, 'css'), pick('nth', null, 'css'), pick('first', null, 'role'), pick('last', null, 'test-id'), pick('first', null, 'label')], [null, null, null, null, null]);
  // A brittle selector with a pick is reported once, for the selector.
  assert.equal(classify('.css-1q2w3e4', 'class', { kind: 'nth', index: 2, baseStrategy: 'class' }), 'generated');
  // allowPatterns: a selector that matches is never reported, pick included.
  assert.equal(classifySelector({ value: '#app-root > div > div > div > a', strategy: 'css', positional: { kind: 'nth', index: 2, baseStrategy: 'css' } }, [/^#app-root/]), null);

  assert.deepEqual(['css-0abc', 'css-grid9', 'sc-AxjAm', 'jss1', 'e3f1a2', 'md5-9e107d9d372bb682', 'Card_root__aB3dE'].map(isGeneratedName), Array(7).fill(true));
  assert.deepEqual(['css', 'sc-btn', 'jssx', 'card__title', 'item12345', '1000px', 'a1b2', 'user_email_field', 'h1'].map(isGeneratedName), Array(9).fill(false));
});

test('QCR-W001: maxMs, sleeps with no literal amount, hooks, and the implicit wait as info', async () => {
  const playwright = folder('QCR-W001', 'typescript-playwright');
  const all = (report) => report.findings.filter((finding) => finding.ruleId === 'QCR-W001').map((finding) => `${finding.location.file.slice(4)}:${finding.location.startLine} ${finding.message}`);
  assert.deepEqual(all((await review(playwright)).report), [
    'promise-sleep.spec.ts:8 Hard wait of 1000 ms.', 'promise-sleep.spec.ts:9 Hard wait of 500 ms.', 'sleep-after-click.spec.ts:8 Hard wait of 3000 ms.',
    'sleep-after-click.spec.ts:15 Hard wait: the test sleeps for a fixed time.', 'sleep-in-hook.spec.ts:5 Hard wait of 2000 ms.',
  ]);
  // A sleep at or below maxMs is not reported. One with no literal amount still is.
  assert.deepEqual(all((await review(playwright, { rules: { 'QCR-W001': { maxMs: 2000 } } })).report), [
    'sleep-after-click.spec.ts:8 Hard wait of 3000 ms.', 'sleep-after-click.spec.ts:15 Hard wait: the test sleeps for a fixed time.',
  ]);
  // A sleep in a hook belongs to no test. It has the fix and the example of the rule.
  const { report } = await review(playwright);
  const hook = report.findings.find((finding) => finding.location.file === 'bad/sleep-in-hook.spec.ts');
  assert.deepEqual([hook.testId, hook.severity, hook.evidence, hook.location.startColumn], [null, 'warn', 'page.waitForTimeout(2000)', 9]);
  assert.match(hook.fix, /^Wait for a condition instead: /);
  assert.match(hook.goodExample, /toHaveText\('1'\);$/);

  // WebdriverIO: an implicit wait above 5000 ms is info, also when the rule is set to error.
  const wdio = folder('QCR-W001', 'typescript-webdriverio');
  assert.deepEqual(found((await review(wdio)).report, 'bad/implicit-wait.spec.ts'), ['6 info']);
  const strict = (await review(wdio, { rules: { 'QCR-W001': 'error' } })).report;
  assert.deepEqual([found(strict, 'bad/implicit-wait.spec.ts'), found(strict, 'bad/pause.spec.ts')], [['6 info'], ['7 error']]);
  assert.match(strict.findings.find((finding) => finding.severity === 'info').message, /^Implicit wait of 10000 ms\. /);
});

test('QCR-S001: allowPatterns, testIdAttribute, and info for picks by position', async () => {
  const playwright = folder('QCR-S001', 'typescript-playwright');
  const base = (await review(playwright)).report;
  assert.deepEqual(found(base, 'bad/xpath.spec.ts'), ['6 warn', '8 warn', '9 warn', '11 warn']);
  assert.deepEqual(found(base, 'bad/picks.spec.ts'), ['6 info', '7 info', '8 info', '9 info', '10 info']);
  assert.deepEqual(base.findings.find((finding) => finding.location.file === 'bad/xpath.spec.ts' && finding.location.startLine === 8).message, 'XPath depends on layout: //div[3]/div[2]/button[2].');
  // A test with only info findings still passes. One with a warn finding needs a review.
  const verdicts = Object.fromEntries(base.files.flatMap((file) => file.tests.map((entry) => [file.file, entry.verdict])));
  assert.deepEqual([verdicts['bad/picks.spec.ts'], verdicts['bad/xpath.spec.ts']], ['pass', 'review']);

  // allowPatterns: regular expressions on the selector text.
  const allowed = (await review(playwright, { rules: { 'QCR-S001': { allowPatterns: ['^#root', '^\\(//button\\)', '^\\.inventory_item$'] } } })).report;
  assert.deepEqual([found(allowed, 'bad/xpath.spec.ts'), found(allowed, 'bad/layout.spec.ts'), found(allowed, 'bad/picks.spec.ts')], [
    ['6 warn', '8 warn', '11 warn'], ['7 warn', '8 warn', '9 warn', '10 warn', '13 warn'], ['7 info', '8 info', '9 info', '10 info'],
  ]);
  // The severity in the config is the level of the rule. Picks keep their own level, unless the rule is set to info.
  const strict = (await review(playwright, { rules: { 'QCR-S001': 'error' } })).report;
  assert.deepEqual([found(strict, 'bad/xpath.spec.ts')[0], found(strict, 'bad/picks.spec.ts')[0]], ['6 error', '6 info']);
  const quiet = (await review(playwright, { rules: { 'QCR-S001': 'info' } })).report;
  assert.ok(quiet.findings.every((finding) => finding.severity === 'info'));
  // Each case has its own title and example for `explain` and the docs.
  assert.deepEqual([examplesFor('QCR-S001', 'typescript').length, examplesFor('QCR-W001', 'javascript').map((entry) => entry.title)], [5, ['A fixed sleep', 'A long implicit wait (info)']]);

  // testIdAttribute: the first match of your own test id attribute is a stable pick.
  const cypress = folder('QCR-S001', 'javascript-cypress');
  assert.deepEqual(found((await review(cypress)).report, 'bad/picks.cy.js'), ['5 info', '6 info', '7 info']);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcr-testid-'));
  fs.writeFileSync(path.join(dir, 'package.json'), '{ "devDependencies": { "cypress": "^13.15.0" } }');
  fs.writeFileSync(path.join(dir, 'cart.cy.js'), "it('opens a row', () => {\n  cy.get('[data-automation=\"row\"]').first().click();\n  cy.get('[data-automation=\"total\"]').should('be.visible');\n});\n");
  try {
    assert.deepEqual(found((await review(dir)).report, 'cart.cy.js'), ['2 info']);
    assert.deepEqual(found((await review(dir, { testIdAttribute: 'data-automation' })).report, 'cart.cy.js'), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('every case of QCR-W001 and QCR-S001 has a bad fixture, across Playwright, Cypress and WebdriverIO', async () => {
  // The good example of a finding tells which case of the fix text table it is.
  const keyOf = (finding) => Object.keys(FIX_TEXT).find((key) => key.startsWith(finding.ruleId) && FIX_TEXT[key].examples.js.good === finding.goodExample && FIX_TEXT[key].fix === finding.fix);
  const seen = {};
  for (const { ruleId, name, dir } of ruleFixtureFolders().filter((entry) => ['QCR-W001', 'QCR-S001'].includes(entry.ruleId) && !entry.name.endsWith('jest'))) {
    const { report } = await review(dir);
    seen[`${ruleId} ${name.split('-')[1]}`] = [...new Set(report.findings.filter((finding) => finding.location.file.startsWith('bad/')).map(keyOf))].map((key) => key.split('/')[1] ?? 'sleep').sort();
  }
  assert.deepEqual(seen, {
    'QCR-S001 cypress': ['deep', 'generated', 'pick', 'position'], 'QCR-S001 playwright': ['deep', 'generated', 'pick', 'position', 'xpath'], 'QCR-S001 webdriverio': ['deep', 'generated', 'position', 'xpath'],
    'QCR-W001 cypress': ['sleep'], 'QCR-W001 playwright': ['sleep'], 'QCR-W001 webdriverio': ['implicit', 'sleep'],
  });
  assert.deepEqual([...new Set(Object.values(seen).flat())].sort(), Object.keys(FIX_TEXT).filter((key) => /W001|S001/.test(key)).map((key) => key.split('/')[1] ?? 'sleep').sort());
});

test('the config checks maxMs and allowPatterns', () => {
  const problems = (config) => {
    try {
      resolveConfig(config);
      return [];
    } catch (error) {
      assert.ok(error instanceof ConfigError);
      return error.problems.map((problem) => `${problem.pointer}: ${problem.message}`);
    }
  };
  assert.deepEqual(problems({ rules: { 'QCR-W001': { maxMs: 250 }, 'QCR-S001': { severity: 'error', allowPatterns: ['^#app-root', '\\.legacy-'] } } }), []);
  assert.deepEqual(problems({ rules: { 'QCR-W001': { maxMs: -1 } } }).length, 1);
  assert.match(problems({ rules: { 'QCR-W001': { maxMs: '2s' } } })[0], /^\/rules\/QCR-W001\/maxMs: /);
  assert.match(problems({ rules: { 'QCR-S001': { allowPatterns: '^#root' } } })[0], /^\/rules\/QCR-S001\/allowPatterns: /);
  assert.match(problems({ rules: { 'QCR-S001': { allowPatterns: ['^#root', '(open'] } } })[0], /^\/rules\/QCR-S001\/allowPatterns\/1: not a valid regular expression: /);
  const { config } = resolveConfig({ rules: { 'QCR-W001': { maxMs: 250 } } });
  assert.deepEqual([config.rules['QCR-W001'].options, config.rules['QCR-S001'].options], [{ maxMs: 250 }, { allowPatterns: [] }]);
});
