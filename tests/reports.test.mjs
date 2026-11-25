// The report files (SPEC.md Sections 11.5 to 11.7): SARIF, Markdown and JUnit XML, and the
// --format and --stdout flags that choose them.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  MARKDOWN_LIMIT, MARKDOWN_MARKER, SARIF_SCHEMA_URL, VERSION, builtinRules, formatJunit, formatMarkdown, formatSarif, markdownCode, markdownText,
  resolveConfig, runReview, xmlAttribute, xmlText,
} from '../dist/index.js';
import { expectGoldenText } from './helpers/golden.mjs';
import { readJson, repoRoot, sarifErrors, schemaErrors } from './helpers/schema.mjs';
import { hookSleep, toyRules } from './helpers/toy-rules.mjs';
import { parseXml, readXsd, xsdProblems } from './helpers/xml.mjs';

const cli = path.join(repoRoot, 'dist', 'cli.js');
const fixtures = path.join(repoRoot, 'fixtures', 'reports');
const rules = [...toyRules, hookSleep];
const FOOTER = 'Reviewed by [qa-core-review](https://github.com/sprintsynergyio/qa-core-review), an open-source tool by SprintSynergy.';
const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b);
const xsd = readXsd(fs.readFileSync(path.join(repoRoot, 'tests', 'schemas', 'junit.xsd'), 'utf8'));
// The XSD has no `file` and `line` on a test case. SPEC.md Section 11.7 asks for both, and CI systems read them.
const junitProblems = (xml) => xsdProblems(xsd, parseXml(xml), { rootName: 'testsuites', extra: { testcase: ['file', 'line'] } });
const all = (node, name) => node.children.flatMap((child) => [...(child.name === name ? [child] : []), ...all(child, name)]);

/** The shop fixture reviewed with the toy rules: one fail, one review, three pass, file findings, one suppressed finding, one Scala file. */
const shop = async (config = {}) => (await runReview({ root: path.join(fixtures, 'shop'), config: resolveConfig(config).config, git: false, rules })).report;

/** A report made by hand: `count` failing tests in one file, each with one finding. */
function fakeReport(count, { title = (index) => `test number ${index}`, evidence = 'page.waitForTimeout(500)', llm = 'off', files = [] } = {}) {
  const location = (line) => ({ file: 'tests/big.spec.ts', startLine: line, startColumn: 3, endLine: line, endColumn: 9 });
  const findings = Array.from({ length: count }, (_, index) => ({
    id: `f${index}`, ruleId: 'QCR-T001', ruleName: 'toy-no-check', severity: 'error', source: 'static', message: 'This test checks nothing.', evidence, fix: 'Add an assertion.',
    location: location(index + 1), testId: `t${index}`, confidence: 'high', suppressed: false, docsUrl: 'https://github.com/sprintsynergyio/qa-core-review/blob/main/docs/rules.md#qcr-t001',
  }));
  const tests = findings.map((finding, index) => ({
    id: `t${index}`, title: title(index), fullTitle: title(index), location: location(index + 1), bodyLocation: location(index + 1), modifiers: [], assertionCount: 0, verdict: 'fail', findingIds: [finding.id],
  }));
  const file = (name, extra = {}) => ({ file: name, language: 'typescript', languageHint: null, adapter: 'js', tier: 1, runner: 'playwright', libraries: [], parseStatus: 'ok', rulesSkipped: [], tests: [], ...extra });
  return {
    schemaVersion: 2, tool: { name: 'qa-core-review', version: VERSION }, createdAt: '2026-01-01T00:00:00.000Z', root: '/work', mode: { diffBase: null, llm }, projects: [], rulesRun: ['QCR-T001'],
    files: [...(count > 0 ? [file('tests/big.spec.ts', { tests })] : []), ...files.map(([name, extra]) => file(name, extra))], findings,
    summary: { files: 1 + files.length, tests: count, pass: 0, review: 0, fail: count, errors: count, warnings: 0, infos: 0, suppressed: 0, byLanguage: {}, llmOnlyFiles: 0 },
  };
}

test('SARIF: valid against the official 2.1.0 schema, with the levels, fingerprints and properties of Section 11.5', async () => {
  const report = await shop();
  const sarif = formatSarif(report, rules);
  assert.deepEqual(sarifErrors(sarif), []);
  assert.deepEqual([sarif.$schema, sarif.version, sarif.runs.length], [SARIF_SCHEMA_URL, '2.1.0', 1]);
  const [{ tool: { driver }, results }] = sarif.runs;
  assert.deepEqual([driver.name, driver.version, driver.informationUri], ['qa-core-review', VERSION, 'https://github.com/sprintsynergyio/qa-core-review']);

  // One entry per rule that ran, with the level of its default severity.
  assert.deepEqual(driver.rules.map((rule) => rule.id), report.rulesRun);
  assert.deepEqual(driver.rules.map((rule) => [rule.id, rule.name, rule.defaultConfiguration.level]), [
    ['QCR-T001', 'toy-no-check', 'error'], ['QCR-T002', 'toy-sleep', 'warning'], ['QCR-T003', 'toy-file-note', 'note'], ['QCR-T004', 'toy-hook-sleep', 'warning'],
  ]);
  assert.deepEqual(driver.rules[3], {
    id: 'QCR-T004', name: 'toy-hook-sleep', shortDescription: { text: 'A fixed sleep in a hook' }, fullDescription: { text: 'A fixed sleep in a hook. It slows every test of the file.' },
    helpUri: 'https://github.com/sprintsynergyio/qa-core-review/blob/main/docs/rules.md#qcr-t004', defaultConfiguration: { level: 'warning' },
  });

  // One result per finding that is not suppressed, in the order of the report.
  const open = report.findings.filter((finding) => !finding.suppressed);
  assert.deepEqual([report.findings.length, open.length, results.length], [7, 6, 6]);
  assert.deepEqual(results.map((result) => [result.ruleId, result.level, result.locations[0].physicalLocation.region.startLine]), [
    ['QCR-T003', 'note', 1], ['QCR-T004', 'warning', 6], ['QCR-T002', 'warning', 11], ['QCR-T001', 'error', 15], ['QCR-T002', 'warning', 17], ['QCR-T003', 'note', 1],
  ]);
  results.forEach((result, index) => {
    assert.equal(driver.rules[result.ruleIndex].id, result.ruleId);
    assert.deepEqual(result.partialFingerprints, { 'qaCoreReview/v1': open[index].id });
    assert.equal(result.locations.length, 1);
  });
  const noCheck = results[3];
  assert.deepEqual(noCheck, {
    ruleId: 'QCR-T001', ruleIndex: 0, level: 'error',
    // The message, then the fix.
    message: { text: 'This test checks nothing. Add an assertion.' },
    locations: [{ physicalLocation: { artifactLocation: { uri: 'tests/cart.spec.ts', uriBaseId: '%SRCROOT%' }, region: { startLine: 15, startColumn: 3, endLine: 15, endColumn: 4 } } }],
    partialFingerprints: { 'qaCoreReview/v1': open[3].id },
    properties: { language: 'typescript', framework: 'playwright', testTitle: 'Cart > opens', source: 'static' },
  });
  // A finding with no fix: the message alone. A file finding: no test title.
  assert.deepEqual([results[2].message.text, results[1].properties.testTitle, results[2].properties.testTitle], ['Hard wait of 3000 ms.', null, 'Cart > adds an item @smoke | <b>bold</b> & `code` "quoted"']);
});

test('SARIF: odd paths, a rule that is not in the list, an empty range and an empty report stay valid', async () => {
  const report = fakeReport(2);
  report.findings[0].location = { file: 'tests/my tests/a#b?c%.spec.ts', startLine: 4, startColumn: 7, endLine: 4, endColumn: 7 };
  report.files[0].file = 'tests/my tests/a#b?c%.spec.ts';
  // A finding of a rule that did not run as a static rule, as the LLM review will give.
  Object.assign(report.findings[1], { ruleId: 'QCR-L001', ruleName: 'llm-note', severity: 'info', source: 'llm', fix: '', location: { file: 'not/in/the/report.ts', startLine: 9, startColumn: 1, endLine: 12, endColumn: 2 } });
  const sarif = formatSarif(report, rules);
  assert.deepEqual(sarifErrors(sarif), []);
  const [{ tool: { driver }, results }] = sarif.runs;
  assert.deepEqual(results[0].locations[0].physicalLocation, {
    artifactLocation: { uri: 'tests/my%20tests/a%23b%3Fc%25.spec.ts', uriBaseId: '%SRCROOT%' }, region: { startLine: 4, startColumn: 7, endLine: 4, endColumn: 7 },
  });
  assert.deepEqual(driver.rules.map((rule) => [rule.id, rule.name, rule.shortDescription.text, rule.defaultConfiguration.level]), [['QCR-T001', 'toy-no-check', 'A test with no assertion', 'error'], ['QCR-L001', 'llm-note', 'llm-note', 'note']]);
  assert.deepEqual([results[1].ruleIndex, results[1].level, results[1].message.text, results[1].locations[0].physicalLocation.region, results[1].properties], [
    1, 'note', 'This test checks nothing.', { startLine: 9, startColumn: 1, endLine: 12, endColumn: 2 }, { language: null, framework: null, testTitle: null, source: 'llm' },
  ]);
  // A rule id that nothing describes still gets an entry.
  const unknown = formatSarif({ ...report, rulesRun: ['QCR-Z999'], findings: [] }, []);
  assert.deepEqual([sarifErrors(unknown), unknown.runs[0].tool.driver.rules[0].name, unknown.runs[0].tool.driver.rules[0].defaultConfiguration.level], [[], 'QCR-Z999', 'warning']);
  const empty = formatSarif(fakeReport(0), rules);
  assert.deepEqual([sarifErrors(empty), empty.runs[0].results], [[], []]);

  // The check itself is not empty: a wrong level, a path with a space and a line 0 are all caught.
  const broken = structuredClone(sarif);
  broken.runs[0].results[0].level = 'warn';
  broken.runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri = 'my tests/a.ts';
  broken.runs[0].results[1].locations[0].physicalLocation.region.startLine = 0;
  delete broken.runs[0].tool.driver.name;
  assert.deepEqual(sarifErrors(broken), [
    "/runs/0/tool/driver must have required property 'name'", '/runs/0/results/0/level must be equal to one of the allowed values',
    '/runs/0/results/0/locations/0/physicalLocation/artifactLocation/uri must match format "uri-reference"', '/runs/0/results/1/locations/0/physicalLocation/region/startLine must be >= 1',
  ]);
});

test('Markdown: the golden file, the marker, the verdict line, the table, the details and the closing line', async () => {
  const report = await shop();
  const markdown = formatMarkdown(report);
  expectGoldenText(markdown, path.join(fixtures, 'shop.report.md'));
  const lines = markdown.split('\n');
  assert.deepEqual(lines.slice(0, 4), [MARKDOWN_MARKER, '## Test review', '', '1 test needs changes, 1 needs review, 3 pass. 1 file has findings outside its tests.']);
  assert.deepEqual(lines.slice(-3), ['', FOOTER, '']);
  // Fail first, then review. File findings that are not only info are a row too.
  assert.deepEqual(lines.filter((line) => /^\| (fail|review) /.test(line)).map((line) => line.split(' | ').map((cell) => cell.replace(/^\| | \|$/g, ''))), [
    ['fail', '`tests/cart.spec.ts:15`', 'TS', 'Cart > opens', 'QCR-T001, QCR-T002'],
    // The title is escaped: "|", "<", "&" and backticks cannot break the table, and "@smoke" mentions nobody.
    ['review', '`tests/cart.spec.ts:9`', 'TS', `Cart > adds an item @${ZERO_WIDTH_SPACE}smoke \\| &lt;b>bold&lt;/b> &amp; \\\`code\\\` "quoted"`, 'QCR-T002'],
    // The row of the file findings points at the hook sleep on line 6, not at the note on line 1.
    ['review', '`tests/cart.spec.ts:6`', 'TS', '(file)', 'QCR-T003, QCR-T004'],
  ]);
  assert.ok(lines.includes('Not reviewed (no static adapter, and LLM mode is off): `specs/CartSpec.scala`.'));
  // One collapsed block per row. A passing test, a suppressed finding and a file with only info have none.
  assert.deepEqual(lines.filter((line) => line.startsWith('<summary>')), [
    '<summary>fail: tests/cart.spec.ts:15 Cart &gt; opens</summary>',
    `<summary>review: tests/cart.spec.ts:9 Cart &gt; adds an item @${ZERO_WIDTH_SPACE}smoke | &lt;b&gt;bold&lt;/b&gt; &amp; \`code\` "quoted"</summary>`,
    '<summary>review: tests/cart.spec.ts:6 (file)</summary>',
  ]);
  assert.deepEqual([lines.filter((line) => line === '<details>').length, lines.filter((line) => line === '</details>').length], [3, 3]);
  assert.ok(lines.includes('- **QCR-T001** (error), line 15: This test checks nothing. Evidence: `opens`. Fix: Add an assertion.'));
  assert.ok(lines.includes('- **QCR-T002** (warn), line 17: Hard wait of 500 ms. Evidence: `page.waitForTimeout(500)`.'));
  assert.ok(!markdown.includes('waitForTimeout(100)') && !markdown.includes('checkout.spec.ts'));
});

test('Markdown: the verdict line in each case, the language names, and the line about files with no static adapter', () => {
  const firstLine = (report) => formatMarkdown(report).split('\n')[3];
  const withSummary = (summary) => ({ ...fakeReport(0), summary: { ...fakeReport(0).summary, ...summary } });
  assert.deepEqual([
    firstLine(withSummary({ tests: 0 })), firstLine(withSummary({ tests: 9, pass: 9 })), firstLine(withSummary({ tests: 1, pass: 1 })),
    firstLine(withSummary({ tests: 9, fail: 2, review: 2, pass: 5 })), firstLine(withSummary({ tests: 3, fail: 1, review: 1, pass: 1 })), firstLine(withSummary({ tests: 2, fail: 0, review: 2, pass: 0 })),
  ], [
    'No tests were reviewed.', 'All 9 tests pass review.', 'The 1 test passes review.',
    '2 tests need changes, 2 need review, 5 pass.', '1 test needs changes, 1 needs review, 1 passes.', '0 tests need changes, 2 need review, 0 pass.',
  ]);
  // With nothing to list there is no table and no details.
  assert.deepEqual(formatMarkdown(withSummary({ tests: 9, pass: 9 })).split('\n'), [MARKDOWN_MARKER, '## Test review', '', 'All 9 tests pass review.', '', FOOTER, '']);

  // Two files with findings outside their tests.
  const two = fakeReport(1);
  two.findings.push({ ...two.findings[0], id: 'x1', testId: null }, { ...two.findings[0], id: 'x2', testId: null, severity: 'warn', location: { ...two.findings[0].location, file: 'tests/other.spec.ts' } });
  two.files.push({ ...two.files[0], file: 'tests/other.spec.ts', tests: [] });
  assert.equal(firstLine(two), '1 test needs changes, 0 need review, 0 pass. 2 files have findings outside their tests.');
  assert.deepEqual(formatMarkdown(two).split('\n').filter((line) => line.startsWith('| ')).slice(2).map((line) => line.split(' | ')[0]), ['| fail', '| fail', '| review']);

  // Short language names. A k6 script is k6, a Tier 3 file shows its hint.
  const languages = [['typescript', {}], ['javascript', {}], ['python', {}], ['java', {}], ['csharp', {}], ['go', {}], ['ruby', {}], ['kotlin', {}], ['php', {}], ['robot', {}], ['gherkin', {}], ['jmeter', {}], ['postman', {}],
    ['javascript', { runner: 'k6' }], ['generic', { languageHint: 'scala' }]];
  const mixed = fakeReport(languages.length);
  mixed.files = languages.map(([language, extra], index) => ({ ...mixed.files[0], file: `f${index}`, language, ...extra, tests: [mixed.files[0].tests[index]] }));
  mixed.findings.forEach((finding, index) => { finding.location.file = `f${index}`; });
  assert.deepEqual(formatMarkdown(mixed).split('\n').filter((line) => line.startsWith('| fail')).map((line) => line.split(' | ')[2]),
    ['TS', 'JS', 'Py', 'Java', 'C#', 'Go', 'Rb', 'Kt', 'PHP', 'Robot', 'Gherkin', 'JMeter', 'Postman', 'k6', 'Scala']);

  // Files that no static adapter reads: one line, cut after 20 names.
  const unread = (count, llm) => formatMarkdown(fakeReport(0, { llm, files: Array.from({ length: count }, (_, index) => [`specs/S${index}.scala`, { parseStatus: 'llm-only', adapter: 'generic', language: 'generic', languageHint: 'scala', tier: 3 }]) })).split('\n')[5];
  assert.equal(unread(2, 'off'), 'Not reviewed (no static adapter, and LLM mode is off): `specs/S0.scala`, `specs/S1.scala`.');
  assert.equal(unread(1, 'anthropic'), 'Reviewed by the LLM only (no static adapter): `specs/S0.scala`.');
  assert.match(unread(23, 'off'), /`specs\/S19\.scala` and 3 more\.$/);
});

test('Markdown: text from the code cannot break the table or the page', () => {
  assert.deepEqual([markdownText('a | b'), markdownText('<script>'), markdownText('`x`'), markdownText('a\n  b\tc'), markdownText('__init__ *bold* [link](x) \\ & @team'), markdownText('plain "text" > here')],
    ['a \\| b', '&lt;script>', '\\`x\\`', 'a b c', `\\_\\_init\\_\\_ \\*bold\\* \\[link\\](x) \\\\ &amp; @${ZERO_WIDTH_SPACE}team`, 'plain "text" > here']);
  // Inline code: a fence longer than any run of backticks inside, and no "|" that could end a cell.
  assert.deepEqual([markdownCode('page.click()'), markdownCode('a `b` c'), markdownCode('``'), markdownCode('a || b'), markdownCode('line one\nline two')],
    ['`page.click()`', '`` a `b` c ``', '``` `` ```', '`a \\|\\| b`', '`line one line two`']);
  const nasty = fakeReport(1, { title: () => 'a | b </details> <img src=x> `tick` @octocat\nsecond line', evidence: 'expect(`a|b`).toBe("</summary>")' });
  const lines = formatMarkdown(nasty).split('\n');
  const row = lines.find((line) => line.startsWith('| fail'));
  // Five cells: no "|" of the title or the evidence is read as a cell border.
  assert.equal(row.replace(/\\\|/g, '').split('|').length - 2, 5);
  assert.ok(!formatMarkdown(nasty).includes('@octocat') && !formatMarkdown(nasty).includes('<img'));
  assert.deepEqual([lines.filter((line) => line.includes('</details>')).length, lines.filter((line) => line.includes('</summary>') && !line.includes('`` ')).length], [1, 1]);
  assert.ok(lines.some((line) => line.includes('Evidence: `` expect(`a\\|b`).toBe("</summary>") ``.')));
});

test('Markdown: over 60,000 characters the details are dropped and the table stays', () => {
  // 400 failing tests: the table fits, the details do not.
  const report = fakeReport(400);
  const long = formatMarkdown(report);
  assert.ok(long.length <= MARKDOWN_LIMIT, String(long.length));
  const lines = long.split('\n');
  assert.deepEqual([lines[0], lines.filter((line) => line.startsWith('| fail')).length, long.includes('<details>'), lines.slice(-5)], [
    MARKDOWN_MARKER, 400, false, ['', 'Full report in the job artifact `.qa-core/review/report.json`.', '', FOOTER, ''],
  ]);
  assert.ok(formatMarkdown(report, { reportPath: 'out/report.json' }).includes('Full report in the job artifact `out/report.json`.'));
  // The limit is exact: the last report that fits keeps its details, and one more test drops them.
  const sized = (count) => formatMarkdown(fakeReport(count, { title: (index) => `test number ${index} ${'x'.repeat(100)}` }));
  let fits = 1;
  while (sized(fits + 1).includes('<details>')) fits += 1;
  const [under, over] = [sized(fits), sized(fits + 1)];
  assert.ok(under.length > MARKDOWN_LIMIT - 1000 && under.length <= MARKDOWN_LIMIT, `${fits} tests: ${under.length}`);
  assert.ok(over.length < under.length && over.includes('Full report in the job artifact') && over.split('\n').filter((line) => line.startsWith('| fail')).length === fits + 1, String(over.length));

  // 2,000 failing tests with long titles: the table alone is too long, so its last rows go too.
  const huge = formatMarkdown(fakeReport(2000, { title: (index) => `test number ${index} ${'x'.repeat(150)}` }));
  assert.ok(huge.length <= MARKDOWN_LIMIT && huge.length > MARKDOWN_LIMIT - 400, String(huge.length));
  const kept = huge.split('\n').filter((line) => line.startsWith('| fail')).length;
  assert.ok(kept > 200 && kept < 2000, String(kept));
  assert.deepEqual(huge.split('\n').slice(-7), ['', `${2000 - kept} more tests are not shown here.`, '', 'Full report in the job artifact `.qa-core/review/report.json`.', '', FOOTER, '']);
  assert.ok(huge.includes(`| test number ${kept - 1} `) && !huge.includes(`| test number ${kept} `));
  // One row that is longer than the limit by itself: no row is kept, and the report is still short.
  const oneRow = formatMarkdown(fakeReport(1, { title: () => 'y'.repeat(70_000) }));
  assert.ok(oneRow.length < 500 && oneRow.includes('1 more test is not shown here.'), String(oneRow.length));
});

test('JUnit XML: the golden file, the structure of Section 11.7 and the XSD', async () => {
  const report = await shop();
  const xml = formatJunit(report, 'error');
  expectGoldenText(xml, path.join(fixtures, 'shop.report.junit.xml'));
  assert.deepEqual(junitProblems(xml), []);
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<testsuites name="qa-core-review" tests="8" failures="1" time="0">\n') && xml.endsWith('</testsuites>\n'));

  const root = parseXml(xml);
  // One suite per reviewed file, named by its path.
  assert.deepEqual(root.children.map((suite) => [suite.name, suite.attributes.name, suite.attributes.tests, suite.attributes.failures, suite.attributes.errors, suite.attributes.skipped, suite.attributes.time]), [
    ['testsuite', 'specs/CartSpec.scala', '1', '0', '0', '1', '0'], ['testsuite', 'tests/cart.spec.ts', '4', '1', '0', '0', '0'], ['testsuite', 'tests/checkout.spec.ts', '3', '0', '0', '0', '0'],
  ]);
  // The counts are true: every suite counts its own cases, and the root counts them all.
  for (const suite of root.children) {
    assert.equal(Number(suite.attributes.tests), suite.children.length);
    assert.equal(Number(suite.attributes.failures), suite.children.filter((testcase) => testcase.children.some((child) => child.name === 'failure')).length);
  }
  assert.deepEqual([Number(root.attributes.tests), Number(root.attributes.failures)], [all(root, 'testcase').length, 1]);
  // One case per test, then one for the findings of the file. The class name is the path with dots and no extension.
  assert.deepEqual(root.children[1].children.map((testcase) => testcase.attributes), [
    { name: 'Cart > adds an item @smoke | <b>bold</b> & `code` "quoted"', classname: 'tests.cart.spec', file: 'tests/cart.spec.ts', line: '9', time: '0' },
    { name: 'Cart > opens', classname: 'tests.cart.spec', file: 'tests/cart.spec.ts', line: '15', time: '0' },
    { name: 'Cart > is empty at first', classname: 'tests.cart.spec', file: 'tests/cart.spec.ts', line: '20', time: '0' },
    { name: '(file)', classname: 'tests.cart.spec', file: 'tests/cart.spec.ts', line: '1', time: '0' },
  ]);
  assert.equal(root.children[2].children[0].attributes.name, 'zeigt den Preis in € an');
  // The error is a failure with the evidence and the fix. The warning of the same test is below --fail-on error, so it is in system-out.
  const opens = root.children[1].children[1];
  assert.deepEqual(opens.children.map((child) => [child.name, child.attributes, child.text]), [
    ['failure', { type: 'QCR-T001', message: 'This test checks nothing.' }, 'tests/cart.spec.ts:15:3\nEvidence: opens\nFix: Add an assertion.\nDocs: https://github.com/sprintsynergyio/qa-core-review/blob/main/docs/rules.md#qcr-t001'],
    ['system-out', {}, 'QCR-T002 warn: Hard wait of 500 ms.\ntests/cart.spec.ts:17:11\nEvidence: page.waitForTimeout(500)\nDocs: https://github.com/sprintsynergyio/qa-core-review/blob/main/docs/rules.md#qcr-t002'],
  ]);
  // A passing test is an empty case. The suppressed sleep of "is empty at first" is nowhere.
  assert.deepEqual([root.children[1].children[2].children, xml.includes('waitForTimeout(100)')], [[], false]);
  // A file with no static adapter: one skipped case.
  assert.deepEqual(root.children[0].children.map((testcase) => [testcase.attributes.name, testcase.attributes.classname, testcase.children.map((child) => [child.name, child.attributes])]),
    [['(file)', 'specs.CartSpec', [['skipped', { message: 'No static adapter' }]]]]);
});

test('JUnit XML: --fail-on decides what is a failure', async () => {
  const report = await shop();
  const counts = (failOn) => {
    const xml = formatJunit(report, failOn);
    assert.deepEqual(junitProblems(xml), [], failOn);
    const root = parseXml(xml);
    return [Number(root.attributes.failures), all(root, 'failure').length, all(root, 'system-out').length];
  };
  // [cases with a failure, failures, system-out blocks]
  assert.deepEqual({ error: counts('error'), warn: counts('warn'), info: counts('info'), never: counts('never') }, { error: [1, 1, 4], warn: [3, 4, 2], info: [4, 6, 0], never: [0, 0, 4] });
  // With --fail-on warn the test "opens" has two failures and no system-out.
  const opens = parseXml(formatJunit(report, 'warn')).children[1].children[1];
  assert.deepEqual(opens.children.map((child) => [child.name, child.attributes.type]), [['failure', 'QCR-T001'], ['failure', 'QCR-T002']]);

  // A file with no tests and no findings is an empty suite. A report with no files is an empty root.
  const bare = fakeReport(0, { files: [['tests/helpers/login.ts', {}]] });
  assert.deepEqual([formatJunit(bare, 'error').split('\n').slice(1), junitProblems(formatJunit(bare, 'error'))], [
    ['<testsuites name="qa-core-review" tests="0" failures="0" time="0">', '  <testsuite name="tests/helpers/login.ts" tests="0" failures="0" errors="0" skipped="0" time="0"/>', '</testsuites>', ''], [],
  ]);
  const none = formatJunit({ ...fakeReport(0), files: [] }, 'error');
  assert.deepEqual([none, junitProblems(none)], ['<?xml version="1.0" encoding="UTF-8"?>\n<testsuites name="qa-core-review" tests="0" failures="0" time="0"/>\n', []]);
  // A file with no static adapter that does have a finding of another rule is not skipped.
  const noted = fakeReport(1);
  Object.assign(noted.files[0], { parseStatus: 'llm-only', tests: [] });
  noted.findings[0].testId = null;
  assert.deepEqual(all(parseXml(formatJunit(noted, 'error')), 'testcase').map((testcase) => testcase.children.map((child) => child.name)), [['failure']]);
  noted.findings[0].ruleId = 'QCR-X003';
  assert.deepEqual(all(parseXml(formatJunit(noted, 'error')), 'testcase').map((testcase) => testcase.children.map((child) => child.name)), [['skipped']]);
});

test('JUnit XML: text is escaped, and characters that XML 1.0 does not allow are removed', () => {
  const lone = String.fromCharCode(0xd83d);
  const odd = `a <b> & "c" 'd' ]]> tab\there\r\nline${String.fromCharCode(0)}${String.fromCharCode(1)}${String.fromCharCode(0x1b)}[31m${String.fromCharCode(0xfffe)}${lone} \u{1f600} €`;
  assert.equal(xmlText(odd), 'a &lt;b&gt; &amp; "c" \'d\' ]]&gt; tab\there&#13;\nline[31m \u{1f600} €');
  assert.equal(xmlAttribute(odd), 'a &lt;b&gt; &amp; &quot;c&quot; \'d\' ]]&gt; tab&#9;here&#13;&#10;line[31m \u{1f600} €');
  const report = fakeReport(1, { title: () => odd, evidence: odd });
  report.findings[0].message = odd;
  const xml = formatJunit(report, 'error');
  assert.deepEqual(junitProblems(xml), []);
  const [testcase] = all(parseXml(xml), 'testcase');
  // What a reader gets back is the text without the characters that were removed.
  const clean = `a <b> & "c" 'd' ]]> tab\there\r\nline[31m \u{1f600} €`;
  assert.deepEqual([testcase.attributes.name, testcase.children[0].attributes.message, testcase.children[0].text.includes(`Evidence: ${clean}\nFix: `)], [clean, clean, true]);
});

test('the XML reader and the XSD check used above catch what they should', () => {
  const ok = '<?xml version="1.0"?>\n<!-- a comment -->\n<testsuites name="x"><testsuite name="s" tests="1" failures="0" errors="0" time="1,234.5"><testcase name="t"><system-out><![CDATA[a < b]]> &amp; &#65;&#x42;</system-out></testcase></testsuite></testsuites>\n';
  const root = parseXml(ok);
  assert.deepEqual([root.name, root.attributes, all(root, 'system-out')[0].text, xsdProblems(xsd, root, { rootName: 'testsuites' })], ['testsuites', { name: 'x' }, 'a < b & AB', []]);
  // Text that is not well formed is refused.
  const malformed = [
    '<a><b></a></b>', '<a>', '<a x=1/>', '<a x="1" x="2"/>', '<a x="<"/>', '<a>&nope;</a>', '<a>fish & chips</a>', '<a>&#0;</a>', '<a/><b/>', '<a x="1"y="2"/>', 'text', `<a>${String.fromCharCode(1)}</a>`,
    '<a><!-- open</a>', '<a><![CDATA[open</a>', '<?xml version="1.0"<a/>', '<a x="1/>', '<a x/>', '<a></a', '< a/>',
  ];
  for (const text of malformed) assert.throws(() => parseXml(text), Error, text);

  // The XSD check: unknown elements and attributes, a missing required attribute, text and elements in the wrong place, a bad time.
  const problems = (xml, options) => xsdProblems(xsd, parseXml(xml), { rootName: 'testsuites', ...options });
  assert.deepEqual(problems('<testsuite name="s" tests="1" failures="0" errors="0"/>'), ['the root is <testsuite>, not <testsuites>']);
  assert.deepEqual(problems('<testsuites time="soon" color="red">text<testcase name="t"/><testsuite name="s" tests="1"><testcase classname="c" file="f"><failure><b/></failure><banana/></testcase></testsuite></testsuites>'), [
    '/testsuites: attribute time="soon" does not match its type', '/testsuites: unknown attribute color', '/testsuites: text is not allowed here', '/testsuites: <testcase> is not allowed here',
    '/testsuites/testsuite[1]: attribute failures is required', '/testsuites/testsuite[1]: attribute errors is required',
    '/testsuites/testsuite[1]/testcase[0]: unknown attribute file', '/testsuites/testsuite[1]/testcase[0]: attribute name is required',
    '/testsuites/testsuite[1]/testcase[0]/failure[0]: <b> is not allowed here', '/testsuites/testsuite[1]/testcase[0]: <banana> is not allowed here',
  ]);
  // `file` and `line` on a test case are the only additions to the XSD that the report uses.
  assert.deepEqual(problems('<testsuites><testsuite name="s" tests="1" failures="0" errors="0"><testcase name="t" file="f" line="3" owner="me"/></testsuite></testsuites>', { extra: { testcase: ['file', 'line'] } }),
    ['/testsuites/testsuite[0]/testcase[0]: unknown attribute owner']);
  // Elements of a named type of the XSD are read too.
  assert.deepEqual(problems('<testsuites><testsuite name="s" tests="1" failures="0" errors="0"><testcase name="t"><rerunFailure type="x">text<stackTrace>at a.b</stackTrace></rerunFailure><flakyError/></testcase></testsuite></testsuites>'),
    ['/testsuites/testsuite[0]/testcase[0]/flakyError[1]: attribute type is required']);
});

const CART = `import { expect, test } from '@playwright/test';

test('adds an item', async ({ page }) => {
  await page.getByTestId('add').click();
  // qa-core-review-disable-next-line QCR-W001
  await page.waitForTimeout(3000);
  await expect(page.getByTestId('badge')).toHaveText('1');
});

test('opens the cart', async ({ page }) => {
  await page.getByTestId('cart').click();
});

test('rejects an empty cart', async ({ page }) => {
  await expect(page.getByTestId('error')).toHaveText('Your cart is empty');
});
`;

test('--format and --stdout: which files are written and what is printed, in every combination', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcr-formats-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'tests'));
  fs.writeFileSync(path.join(dir, 'package.json'), '{ "devDependencies": { "@playwright/test": "^1.49.0" } }\n');
  fs.writeFileSync(path.join(dir, 'tests', 'cart.spec.ts'), CART);
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => name !== 'NO_COLOR' && name !== 'FORCE_COLOR'));
  let runs = 0;
  /** Runs the review with its own output folder. Returns the exit code, stdout and the names of the files written. */
  const run = (...args) => {
    runs += 1;
    const out = `out${runs}`;
    const ran = spawnSync(process.execPath, [cli, '--output', out, ...args], { cwd: dir, encoding: 'utf8', windowsHide: true, shell: false, env });
    assert.equal(ran.stderr, '', args.join(' '));
    const folder = path.join(dir, out);
    return { status: ran.status, stdout: ran.stdout, out, files: fs.existsSync(folder) ? fs.readdirSync(folder).sort() : [], read: (name) => fs.readFileSync(path.join(folder, name), 'utf8') };
  };
  const SUMMARY = 'Summary: 1 pass, 1 review, 1 fail. 1 error, 1 warning, 1 info. 0 suppressed.';
  const isPretty = (stdout) => stdout.startsWith(`qa-core-review ${VERSION} `) && stdout.includes('\nfail  tests/cart.spec.ts:10  opens the cart\n');

  // No flag: the text view, and report.json only.
  const plain = run();
  assert.deepEqual([plain.status, plain.files, isPretty(plain.stdout), plain.stdout.endsWith(`${SUMMARY}\nBy language: TypeScript 3 tests.\nReports: ${plain.out}/report.json\n`)], [1, ['report.json'], true, true]);

  // Every file format, and no text view: two lines say what happened and where the files are.
  const every = run('--format', 'json,sarif,markdown,junit');
  assert.deepEqual([every.status, every.files, every.stdout], [
    1, ['report.json', 'report.junit.xml', 'report.md', 'report.sarif'],
    `${SUMMARY}\nReports: ${every.out}/report.json, ${every.out}/report.sarif, ${every.out}/report.md, ${every.out}/report.junit.xml\n`,
  ]);
  const report = JSON.parse(every.read('report.json'));
  const sarif = JSON.parse(every.read('report.sarif'));
  assert.deepEqual([schemaErrors('report.schema.json', report), sarifErrors(sarif), junitProblems(every.read('report.junit.xml'))], [[], [], []]);
  assert.ok(every.read('report.md').startsWith(`${MARKDOWN_MARKER}\n## Test review\n\n1 test needs changes, 1 needs review, 1 passes.\n`) && every.read('report.md').endsWith(`\n${FOOTER}\n`));
  // The project has an error, a warning and a note (a suppression comment with no reason).
  // The real rules in SARIF: every rule that ran is described, with a link to its section of docs/rules.md.
  const { rules: described } = sarif.runs[0].tool.driver;
  assert.deepEqual(described.map((rule) => [rule.id, rule.name, rule.helpUri]), builtinRules.map((rule) => [rule.id, rule.name, `https://github.com/sprintsynergyio/qa-core-review/blob/main/docs/rules.md#${rule.id.toLowerCase()}`]));
  const anchors = fs.readFileSync(path.join(repoRoot, 'docs', 'rules.md'), 'utf8');
  for (const rule of described) assert.ok(anchors.includes(`<a id="${rule.id.toLowerCase()}"></a>`) && rule.shortDescription.text !== '' && rule.fullDescription.text.endsWith('.'), rule.id);
  assert.deepEqual(sarif.runs[0].results.map((result) => [result.ruleId, result.level, result.locations[0].physicalLocation.artifactLocation.uri, result.properties.testTitle]), [
    ['QCR-X002', 'note', 'tests/cart.spec.ts', null], ['QCR-W001', 'warning', 'tests/cart.spec.ts', 'adds an item'], ['QCR-A001', 'error', 'tests/cart.spec.ts', 'opens the cart'],
  ]);
  assert.deepEqual(sarif.runs[0].results.map((result) => result.partialFingerprints['qaCoreReview/v1']), report.findings.map((finding) => finding.id));

  // The text view together with files.
  const both = run('--format', 'pretty,sarif');
  assert.deepEqual([both.status, both.files, isPretty(both.stdout), both.stdout.endsWith(`Reports: ${both.out}/report.json, ${both.out}/report.sarif\n`)], [1, ['report.json', 'report.sarif'], true, true]);
  const jsonOnly = run('--format', 'json');
  assert.deepEqual([jsonOnly.files, jsonOnly.stdout], [['report.json'], `${SUMMARY}\nReports: ${jsonOnly.out}/report.json\n`]);
  const quiet = run('--format', 'pretty,markdown,junit', '--quiet');
  assert.deepEqual([quiet.files, quiet.stdout], [['report.json', 'report.junit.xml', 'report.md'], `${SUMMARY}\n`]);

  // --stdout prints one format and nothing else. It writes no file of its own: report.json is always there.
  const out = Object.fromEntries(['json', 'sarif', 'markdown', 'junit'].map((format) => [format, run('--stdout', format)]));
  for (const ran of Object.values(out)) assert.deepEqual([ran.status, ran.files], [1, ['report.json']]);
  assert.deepEqual([schemaErrors('report.schema.json', JSON.parse(out.json.stdout)), sarifErrors(JSON.parse(out.sarif.stdout)), junitProblems(out.junit.stdout)], [[], [], []]);
  assert.deepEqual(JSON.parse(out.sarif.stdout), sarif);
  assert.deepEqual([out.markdown.stdout, out.junit.stdout, out.json.stdout === out.json.read('report.json')], [every.read('report.md'), every.read('report.junit.xml'), true]);
  // --stdout with --format: the files of --format are written, and stdout is what --stdout says.
  const mixed = run('--format', 'pretty,junit', '--stdout', 'markdown');
  assert.deepEqual([mixed.files, mixed.stdout], [['report.json', 'report.junit.xml'], every.read('report.md')]);

  // --fail-on moves the line between a failure and a note in the JUnit file, as it does for the exit code.
  const failures = (...args) => {
    const ran = run('--stdout', 'junit', ...args);
    return [ran.status, Number(parseXml(ran.stdout).attributes.failures)];
  };
  assert.deepEqual([failures(), failures('--fail-on', 'warn'), failures('--fail-on', 'info'), failures('--fail-on', 'never')], [[1, 1], [1, 2], [1, 3], [0, 0]]);

  // The config can name the formats. The flag wins over it.
  fs.writeFileSync(path.join(dir, 'qa-core-review.config.json'), '{ "output": { "formats": ["markdown", "sarif"] } }\n');
  const fromConfig = run();
  assert.deepEqual([fromConfig.files, fromConfig.stdout], [['report.json', 'report.md', 'report.sarif'], `${SUMMARY}\nReports: ${fromConfig.out}/report.json, ${fromConfig.out}/report.sarif, ${fromConfig.out}/report.md\n`]);
  const flagWins = run('--format', 'pretty');
  assert.deepEqual([flagWins.files, isPretty(flagWins.stdout)], [['report.json'], true]);
});
