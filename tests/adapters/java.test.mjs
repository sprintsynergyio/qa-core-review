// The Java adapter (SPEC.md Sections 9.3 and 17): golden models, framework detection,
// vocabulary coverage, capabilities and robustness. This part covers the structure of a test
// file: suites, nested suites, tests, hooks, skips, parameterized tests, imports and
// suppressions.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { JAVA_VOCAB_SURFACE, builtinRules, createRegistry, createTreeSitterService, javaAdapter, readAsset, resolveConfig, runReview, toLf } from '../../dist/index.js';
import { capabilityFilled, fixtureRoot, frameworkFolders, normalizeProject, normalizeText } from '../helpers/adapter-suite.mjs';
import { BIG_FILES } from '../helpers/big-files.mjs';
import { expectGolden } from '../helpers/golden.mjs';
import { repoRoot, schemaErrors } from '../helpers/schema.mjs';

const FRAMEWORKS = ['junit4', 'junit5', 'playwright-java', 'restassured', 'selenium', 'testng'];
const TESTS = 'src/test/java/shop';
const models = new Map();
/** Every fixture file of one framework folder, normalized once and kept for the other tests. */
async function modelsOf(framework) {
  if (!models.has(framework)) models.set(framework, await normalizeProject(javaAdapter, fixtureRoot('adapters', 'java', framework)));
  return models.get(framework);
}
const modelOf = async (framework, file) => (await modelsOf(framework)).find((entry) => entry.file === `${TESTS}/${file}`).model;
const jv = (text, relPath = `${TESTS}/ATest.java`, options) => normalizeText(javaAdapter, relPath, text, options);
const JUNIT5 = 'import org.junit.jupiter.api.*;\nimport org.junit.jupiter.params.*;\nimport org.junit.jupiter.params.provider.*;\n';
/** The model of one class with these members, in a file with these imports. */
const classWith = (members, { header = JUNIT5, name = 'ATest', ...options } = {}) => jv(`${header}\nclass ${name} {\n${members.map((line) => `    ${line}`).join('\n')}\n}\n`, undefined, options);
const skipOf = (t) => (t.skip ? `${t.skip.unconditional ? 'always' : 'sometimes'}: ${t.skip.reason}` : null);
const casesOf = (t) => t.parameterized && `${t.parameterized.source}:${t.parameterized.cases}`;
const summary = (model) => model.tests.map((t) => [t.fullTitle, t.modifiers.join(' '), skipOf(t), casesOf(t)]);
const hooksOf = (hooks) => hooks.map((hook) => [hook.kind, hook.scope, hook.span.startLine, hook.span.endLine]);
const tree = (suites) => suites.map((suite) => [suite.title, suite.modifiers.join(' '), suite.hooks.length, suite.testIds.length, tree(suite.suites)]);

test('there is a fixture folder for each framework, and the adapter is registered', () => {
  assert.deepEqual(frameworkFolders('java'), FRAMEWORKS);
  assert.equal(createRegistry().get('java'), javaAdapter);
  assert.deepEqual(createRegistry().forPath('src/test/java/shop/CartTest.JAVA'), [javaAdapter]);
  assert.deepEqual([javaAdapter.grammars, javaAdapter.commentSyntax, javaAdapter.tier], [['java'], { line: ['//'], block: [['/*', '*/']] }, 1]);
});

for (const framework of FRAMEWORKS) {
  test(`${framework}: every fixture matches its golden model and the model schema`, async () => {
    const results = await modelsOf(framework);
    assert.ok(results.length > 0);
    for (const { file, model } of results) {
      assert.deepEqual(schemaErrors('model.schema.json', model), [], file);
      expectGolden(model, path.join(fixtureRoot('adapters', 'java', framework), `${file}.model.json`));
      assert.equal(model.role, model.tests.length > 0 || file.includes('Forgotten') ? 'test' : 'support', file);
      assert.equal(model.parseStatus, file.includes('Broken') ? 'partial' : 'ok', file);
      assert.deepEqual([model.language, model.adapter, model.tier, model.languageHint, model.fileHooks], ['java', 'java', 1, null, []], file);
    }
  });
}

test('framework detection is right for every fixture file', async () => {
  const detected = {};
  for (const framework of FRAMEWORKS) {
    for (const { file, source, model } of await modelsOf(framework)) {
      detected[`${framework}/${file.replace(`${TESTS}/`, '')}`] = [model.runner, model.libraries, javaAdapter.detectFrameworks(source, null).confidence];
    }
  }
  assert.deepEqual(detected, {
    'junit4/BaseShopTest.java': ['junit4', [], 'high'], // no test annotation: the hooks name JUnit 4
    'junit4/CartTest.java': ['junit4', [], 'high'],
    'junit4/DiscountTableTest.java': ['junit4', [], 'high'],
    'junit4/PriceTableTest.java': ['junit4', [], 'high'],
    'junit5/AllTests.java': ['junit5', [], 'medium'], // only `org.junit.platform`, which every JUnit has: the runner of the project
    'junit5/BaseTest.java': ['junit5', [], 'high'],
    'junit5/BrokenTest.java': ['junit5', [], 'high'],
    'junit5/CartTest.java': ['junit5', [], 'high'],
    'junit5/ConditionsTest.java': ['junit5', [], 'high'], // `import org.junit.jupiter.api.*;` and `@Test`
    'junit5/ForgottenAnnotationTest.java': ['junit5', [], 'high'],
    'junit5/OrderServiceTest.java': ['junit5', [], 'high'],
    'junit5/ParameterizedCartTest.java': ['junit5', [], 'high'],
    'junit5/QualifiedTest.java': ['junit5', [], 'high'], // `@org.junit.jupiter.api.Test`, with no import
    'junit5/ShapeContract.java': ['junit5', [], 'high'],
    'junit5/support/Money.java': ['junit5', [], 'medium'], // a support file that names no framework
    'playwright-java/SearchTest.java': ['junit5', ['playwright-java'], 'high'],
    'restassured/OrdersApiTest.java': ['testng', ['restassured'], 'high'],
    'selenium/BaseUiTest.java': ['junit5', ['selenium'], 'high'],
    'selenium/LoginIT.java': ['junit5', ['selenium'], 'high'],
    'selenium/pages/LoginPage.java': ['junit5', ['selenium'], 'medium'],
    'selenium/steps/CheckoutSteps.java': ['junit5', ['cucumber', 'selenium'], 'medium'],
    'testng/BaseTest.java': ['testng', [], 'high'],
    'testng/CartTest.java': ['testng', ['junit4'], 'high'], // the assertions of JUnit are a library here
    'testng/CheckoutTest.java': ['testng', [], 'high'],
    'testng/LegacyCheckoutTest.java': ['testng', [], 'high'],
  });
});

test('the detection fixture project: each file gets its runner, its role and its tests', async () => {
  const results = await normalizeProject(javaAdapter, fixtureRoot('projects', 'java-basic'));
  assert.deepEqual(results.map(({ file, model }) => [file, model.runner, model.libraries, model.role, model.tests.length]), [
    ['src/test/java/shop/CartTest.java', 'junit5', [], 'test', 2],
    ['src/test/java/shop/OrdersApiIT.java', 'junit5', ['restassured'], 'test', 1],
    ['src/test/java/shop/pages/LoginPage.java', 'junit5', ['selenium'], 'support', 0],
  ]);
});

test('detection: the test annotation decides, then what else the file names, then the project', async () => {
  const project = (frameworks, evidence = ['pom.xml']) => ({ dir: '.', adapterId: 'java', languages: ['java'], frameworks, evidence });
  const guess = async (text, options) => {
    const source = { path: `${TESTS}/ATest.java`, absPath: '/virtual/ATest.java', text, language: 'java', project: options?.project ?? null };
    const model = await jv(text, undefined, options);
    return [model.runner, model.libraries, javaAdapter.detectFrameworks(source, null).confidence];
  };
  const five = 'import org.junit.jupiter.api.Test;\nclass ATest { @Test void a() {} }\n';
  const four = 'import org.junit.Test;\npublic class ATest { @Test public void a() {} }\n';
  const ng = 'import org.testng.annotations.Test;\npublic class ATest { @Test public void a() {} }\n';
  assert.deepEqual(await guess(five), ['junit5', [], 'high']);
  assert.deepEqual(await guess(four), ['junit4', [], 'high']);
  assert.deepEqual(await guess(ng), ['testng', [], 'high']);
  // The file wins over the project: a JUnit 4 test in a project that also has JUnit 5.
  assert.deepEqual(await guess(four, { project: project(['junit5', 'junit4']) }), ['junit4', [], 'high']);
  // The assertions of another framework make it a library of the file, not its runner.
  assert.deepEqual(await guess(`import static org.junit.Assert.assertEquals;\n${ng}`), ['testng', ['junit4'], 'high']);
  assert.deepEqual(await guess(`import org.junit.Rule;\n${five}`), ['junit5', ['junit4'], 'high']);
  // Test annotations of two runners in one file: the one the project has, else the newer one.
  const both = 'import org.junit.jupiter.api.Test;\nclass ATest { @Test void a() {} @org.junit.Test public void b() {} }\n';
  assert.deepEqual(await guess(both), ['junit5', ['junit4'], 'medium']);
  assert.deepEqual(await guess(both, { project: project(['junit4']) }), ['junit4', ['junit5'], 'medium']);
  // A wildcard import counts only with the annotation in the code.
  assert.deepEqual(await guess('import org.testng.annotations.*;\npublic class ATest { @Test public void a() {} }\n'), ['testng', [], 'high']);
  assert.deepEqual(await guess('import org.testng.annotations.*;\nimport org.junit.jupiter.api.BeforeEach;\nclass Base { @BeforeEach void a() {} }\n'), ['junit5', ['testng'], 'medium']);
  // No test annotation: a hook or an assertion names the runner. With none of those, the project does.
  assert.deepEqual(await guess('import org.junit.Before;\nclass Base { @Before public void a() {} }\n'), ['junit4', [], 'high']);
  assert.deepEqual(await guess('class Page {}\n', { project: project(['testng', 'selenium']) }), ['testng', [], 'medium']);
  assert.deepEqual(await guess('class Page {}\n', { project: project(['testng', 'junit5']) }), ['junit5', [], 'low']);
  assert.deepEqual(await guess('class Page {}\n'), ['unknown', [], 'low']);
  // Libraries, in the order the file names them. The platform packages of JUnit prove no runner.
  assert.deepEqual(await guess(`import io.restassured.RestAssured;\nimport org.openqa.selenium.By;\nimport com.microsoft.playwright.Page;\nimport io.cucumber.java.en.Given;\n${five}`), ['junit5', ['restassured', 'selenium', 'playwright-java', 'cucumber'], 'high']);
  assert.deepEqual(await guess('import org.junit.platform.suite.api.Suite;\n@Suite class All {}\n'), ['unknown', [], 'low']);
  // A name inside a string or a comment is not a use of the framework.
  assert.deepEqual(await guess('// import org.testng.annotations.Test;\nclass A { String s = "org.junit.jupiter.api.Test"; /* org.junit.Test */ }\n'), ['unknown', [], 'low']);
  // A `projects` entry of the config names the runner, and `framework` in the config beats everything.
  assert.deepEqual(await guess(five, { project: project(['testng', 'selenium'], ['config: projects[0]', 'pom.xml']) }), ['testng', ['junit5'], 'high']);
  assert.equal((await jv(five, undefined, { config: { framework: 'testng' } })).runner, 'testng');
});

test('JUnit 5: display names, nested classes, hooks, disabled tests and repeated tests', async () => {
  const model = await modelOf('junit5', 'CartTest.java');
  assert.deepEqual(summary(model), [
    ['Cart > adds an item', '', null, null],
    // Two test methods with the same name: the second is told apart by its parameters.
    ['Cart > startsEmpty', '', null, null],
    ['Cart > startsEmpty(TestInfo)', '', null, null],
    ['Cart > appliesACoupon', 'skip', 'always: the coupon service is not ready', null],
    ['Cart > removesAnItem', 'skip', 'always: null', null],
    // A repeated test runs the same case again: it is one test, not a parameterized one.
    ['Cart > totalIsStable', '', null, null],
    // `@DisplayName("has the sum as " + "total")`: the parts are joined.
    ['Cart > with two items > has the sum as total', '', null, null],
    ['Cart > with two items > AfterRemovingOne > hasOneItemLeft', '', null, null],
    // `@Disabled` on the class is kept on the suite. The test itself has no skip of its own.
    ['Cart > Checkout > placesTheOrder', '', null, null],
  ]);
  assert.equal(new Set(model.tests.map((t) => t.id)).size, 9);
  // The very same title twice still gives two ids.
  const twice = await classWith(['@Test void a() {}', '@Test void a() {}', '@Test void b(int n, List<String> names) {}', '@Test void b(String s) {}', '@Test @DisplayName("named") void c() {}', '@Test @DisplayName("named too") void c(int n) {}']);
  assert.deepEqual(twice.tests.map((t) => t.title), ['a', 'a', 'b(int, List<String>)', 'b(String)', 'named', 'named too']);
  assert.equal(new Set(twice.tests.map((t) => t.id)).size, 6);
  // A class with `@Nested` is a suite even with nothing in it yet.
  assert.deepEqual(tree(model.suites), [['Cart', '', 4, 6, [['with two items', '', 1, 1, [['AfterRemovingOne', '', 0, 1, []]]], ['Checkout', 'skip', 0, 1, []], ['NotWrittenYet', '', 0, 0, []]]]]);
  assert.deepEqual(hooksOf(model.suites[0].hooks), [['beforeAll', 'suite', 22, 25], ['afterAll', 'suite', 27, 30], ['beforeEach', 'suite', 32, 35], ['afterEach', 'suite', 37, 40]]);
  assert.deepEqual(model.tests[7].suitePath, ['Cart', 'with two items', 'AfterRemovingOne']);

  // A static class inside a test class, and a test interface with default methods.
  const service = await modelOf('junit5', 'OrderServiceTest.java');
  assert.deepEqual([summary(service).map((row) => row[0]), tree(service.suites)], [
    ['OrderServiceTest > placesAnOrder', 'OrderServiceTest > findsAnOrder', 'OrderServiceTest > shipsInTheBackground', 'OrderServiceTest > Totals > addsTheTax'],
    [['OrderServiceTest', '', 1, 3, [['Totals', '', 0, 1, []]]]],
  ]);
  assert.deepEqual(summary(await modelOf('junit5', 'ShapeContract.java')).map((row) => row[0]), ['ShapeContract > hasAName', 'ShapeContract > hasAPrice']);
  const shapes = await jv('import org.junit.jupiter.api.Test;\ninterface Contract { @Test void declaredOnly(); @Test default void runs() {} }\nenum Mode { ON; @Test void inAnEnum() {} }\nrecord Pair(int a) { @Test void inARecord() {} }\n');
  assert.deepEqual(shapes.tests.map((t) => t.fullTitle), ['Contract > runs', 'Mode > inAnEnum', 'Pair > inARecord']);
});

test('JUnit 5: parameterized tests count the cases that are written in the annotations', async () => {
  const model = await modelOf('junit5', 'ParameterizedCartTest.java');
  assert.deepEqual(model.tests.map((t) => [t.title, casesOf(t)]), [
    ['addsThatManyItems', 'ParameterizedTest:3'], ['knowsTheItem', 'ParameterizedTest:1'], ['hasThePrice', 'ParameterizedTest:2'],
    // The settings of a source (delimiter, nullValues and the like) are not cases.
    ['hasThePriceOrNone', 'ParameterizedTest:3'],
    // The rows of a text block are not counted.
    ['hasThePriceFromATextBlock', 'ParameterizedTest:null'],
    // Sources add up: null, empty and two values.
    ['refusesAnUnknownItem', 'ParameterizedTest:4'], ['refusesNoCoupon', 'ParameterizedTest:2'],
    // Cases that live in a method, an enum, a file, a class or a field are not known here.
    ['hasThePriceFromAMethod', 'ParameterizedTest:null'], ['formatsEveryCurrency', 'ParameterizedTest:null'], ['hasThePriceFromAFile', 'ParameterizedTest:null'],
    ['totalIsNeverNegative', 'ParameterizedTest:null'], ['knowsEveryListedItem', 'ParameterizedTest:null'], ['hasNoSource', 'ParameterizedTest:null'],
    // A factory and a template make their tests when they run.
    ['everyItemHasAPrice', 'loop:null'], ['worksInEveryLocale', 'loop:null'],
  ]);
  // The method that gives the arguments is not a test.
  assert.ok(!model.tests.some((t) => t.title === 'itemsAndPrices'));
  const more = await classWith([
    '@ParameterizedTest @ValueSource(strings = {}) void none(String s) {}', '@ParameterizedTest @CsvSource(value = "a,1") void one(String s, int n) {}',
    '@ParameterizedTest @ValueSource(ints = {1, /* two */ 2}) @MethodSource("more") void mixed(int n) {}', '@ParameterizedTest @NullSource @EmptySource void two(String s) {}',
  ]);
  assert.deepEqual(more.tests.map(casesOf), ['ParameterizedTest:0', 'ParameterizedTest:1', 'ParameterizedTest:null', 'ParameterizedTest:2']);
});

test('JUnit 5: conditions on a test, assumptions in its body and thrown aborts', async () => {
  const model = await modelOf('junit5', 'ConditionsTest.java');
  const rows = summary(model);
  // Each of the fourteen condition annotations is a skip on a condition. `disabledReason` is the reason.
  assert.deepEqual(rows.slice(0, 14).map((row) => [row[1], row[2]]), [
    ['', 'sometimes: the file picker is not supported on Windows'], ['', 'sometimes: null'], ['', 'sometimes: null'], ['', 'sometimes: null'], ['', 'sometimes: null'], ['', 'sometimes: null'], ['', 'sometimes: null'],
    ['', 'sometimes: Docker is needed for the database'], ['', 'sometimes: null'], ['', 'sometimes: null'], ['', 'sometimes: null'], ['', 'sometimes: null'], ['', 'sometimes: null'], ['', 'sometimes: null'],
  ]);
  assert.deepEqual(rows.slice(14), [
    ['ConditionsTest > refundsOnLinuxOnly', '', 'sometimes: refunds are tested on Linux only', null],
    ['ConditionsTest > skipsWhenTheFlagIsOff', '', 'sometimes: null', null],
    // `abort(...)` always ends the test. It is found in the body, so the test has no skip modifier.
    ['ConditionsTest > isNotWrittenYet', '', 'always: the export is not ready', null],
    ['ConditionsTest > abortsOnOldData', '', 'sometimes: old data', null],
    ['ConditionsTest > alwaysAborts', '', 'always: the importer is switched off', null],
  ]);
  // The two methods that the conditions name are not tests.
  assert.equal(model.tests.length, 19);
  const inBody = await classWith([
    '@Test void a() { Runnable later = () -> Assumptions.abort("in a lambda"); }', '@Test void b() { for (String s : list) { Assumptions.abort("in a loop"); } }',
    '@Test void c() { String s = ok ? "a" : Assumptions.abort("in a ternary"); }', '@Test void d() { try { go(); } catch (Exception e) { throw new org.opentest4j.TestAbortedException("in a catch"); } }',
    '@Test void e() { Assumptions.assumingThat(ok, () -> go()); }', '@Test void f() { new Object() { void run() { Assumptions.abort("in a class"); } }; }', '@Test void g() { throw new IllegalStateException("not a skip"); }',
    '@Test @Disabled("on the method") void h() { Assumptions.abort("and in the body"); }', '@Test void i() { switch (mode) { case 1: Assumptions.abort("in a switch"); break; default: } }',
  ]);
  assert.deepEqual(inBody.tests.map((t) => [t.title, t.modifiers.join(' '), skipOf(t)]), [
    // Code in a lambda or in a class declared in the body is not the flow of the test.
    ['a', '', null], ['b', '', 'sometimes: in a loop'], ['c', '', 'sometimes: in a ternary'], ['d', '', 'sometimes: in a catch'],
    // `assumingThat` runs a block on a condition and never skips the test.
    ['e', '', null], ['f', '', null], ['g', '', null],
    // The annotation comes first.
    ['h', 'skip', 'always: on the method'], ['i', '', 'sometimes: in a switch'],
  ]);
});

test('JUnit 4: hooks, ignored tests, assumptions and the Parameterized runner', async () => {
  const model = await modelOf('junit4', 'CartTest.java');
  assert.deepEqual(summary(model), [
    ['CartTest > addsAnItem', '', null, null], ['CartTest > refusesAnUnknownItem', '', null, null], ['CartTest > totalIsFast', '', null, null],
    ['CartTest > appliesACoupon', 'skip', 'always: the coupon service is not ready', null], ['CartTest > removesAnItem', 'skip', 'always: null', null],
    // In JUnit 4 the message of an assumption comes first.
    ['CartTest > refundsOnLinuxOnly', '', 'sometimes: refunds are tested on Linux only', null], ['CartTest > skipsWithoutADatabase', '', 'sometimes: null', null],
    ['CartTest > skipsWhenTheSetupFails', '', 'sometimes: null', null], ['CartTest > alwaysSkips', '', 'always: the importer is switched off', null],
  ]);
  assert.deepEqual(hooksOf(model.suites[0].hooks), [['beforeAll', 'suite', 25, 28], ['afterAll', 'suite', 30, 33], ['beforeEach', 'suite', 35, 38], ['afterEach', 'suite', 40, 43]]);
  // `@RunWith(Parameterized.class)`: every test of the class runs once for each row of the `@Parameters` method.
  assert.deepEqual(summary(await modelOf('junit4', 'PriceTableTest.java')), [['PriceTableTest > hasThePrice', '', null, 'ParameterizedTest:3'], ['PriceTableTest > hasAName', '', null, 'ParameterizedTest:3']]);
  assert.deepEqual(summary(await modelOf('junit4', 'DiscountTableTest.java')), [
    ['DiscountTableTest > appliesTheCode', '', null, 'ParameterizedTest:2'], // `List.of(row, row)`
    ['LoadedDiscountTableTest > appliesTheCode', '', null, 'ParameterizedTest:null'], // the rows come from a call
  ]);
  const header = 'import org.junit.*;\nimport org.junit.runner.RunWith;\nimport org.junit.runners.Parameterized;\nimport org.junit.runners.Parameterized.Parameters;\nimport java.util.*;\n';
  const rowsOf = async (returns, runner = 'Parameterized.class') => casesOf((await jv(`${header}@RunWith(${runner})\npublic class ATest {\n  @Parameters public static Object data() { ${returns} }\n  @Test public void a() {}\n}\n`)).tests[0]);
  assert.equal(await rowsOf('return new Object[] { 1, 2, 3, 4 };'), 'ParameterizedTest:4');
  assert.equal(await rowsOf('return Arrays.asList(1, 2);'), 'ParameterizedTest:2');
  assert.equal(await rowsOf('return java.util.stream.Stream.of(1).toList();'), 'ParameterizedTest:null');
  assert.equal(await rowsOf('return Arrays.asList();'), 'ParameterizedTest:null');
  assert.equal(await rowsOf('if (fast) { return new Object[] { 1 }; } return new Object[] { 1, 2 };'), 'ParameterizedTest:null');
  // Another runner does not make the tests many.
  assert.equal(await rowsOf('return new Object[] { 1 };', 'MockitoJUnitRunner.class'), null);
});

test('TestNG: hooks of every scope, switched-off tests, data providers and @Test on the class', async () => {
  const model = await modelOf('testng', 'CartTest.java');
  assert.deepEqual(summary(model), [
    // `description` is the reason of a test that is switched off. It is not a title.
    ['CartTest > addsAnItem', '', null, null], ['CartTest > appliesACoupon', 'skip', 'always: the coupon service is not ready', null], ['CartTest > removesAnItem', 'skip', 'always: null', null],
    ['CartTest > exportsTheCart', 'skip', 'always: the export is rebuilt', null],
    // The provider is found by its `name`, or by the name of its method. In another class its rows are not known.
    ['CartTest > hasThePrice', '', null, 'DataProvider:2'], ['CartTest > appliesTheCode', '', null, 'DataProvider:3'], ['CartTest > totalsTheOrder', '', null, 'DataProvider:null'],
    ['CartTest > alwaysSkips', '', 'always: the importer is switched off', null], ['CartTest > skipsOnOldData', '', 'sometimes: old data', null],
  ]);
  assert.deepEqual(hooksOf(model.suites[0].hooks).map((hook) => hook.slice(0, 2)), [['beforeAll', 'suite'], ['afterAll', 'suite'], ['beforeEach', 'suite'], ['afterEach', 'suite']]);
  // `@Test` on the class: its public methods are tests. A hook, a provider, a static method and a method that is not public are not.
  const checkout = await modelOf('testng', 'CheckoutTest.java');
  assert.deepEqual([summary(checkout), tree(checkout.suites)], [
    [['CheckoutTest > addsTheTax', '', null, null], ['CheckoutTest > givesAnOrderNumber', '', null, null], ['CheckoutTest > printsAnInvoice', 'skip', 'always: the invoice is rebuilt', null]],
    [['CheckoutTest', '', 1, 3, []]],
  ]);
  // `@Test(enabled = false)` on the class switches the suite off.
  const legacy = await modelOf('testng', 'LegacyCheckoutTest.java');
  assert.deepEqual([summary(legacy), tree(legacy.suites)], [[['LegacyCheckoutTest > paysWithACheque', '', null, null]], [['LegacyCheckoutTest', 'skip', 0, 1, []]]]);
  // `enabled = true`, and a class `@Test` of JUnit, change nothing.
  const other = await jv('import org.junit.jupiter.api.Test;\n@Test\npublic class ATest {\n  public void notATest() {}\n  @Test(enabled = true) void a() {}\n}\n');
  assert.deepEqual(summary(other), [['ATest > a', '', null, null]]);
});

test('base classes in support files: their hooks are in the model of the support file', async () => {
  const cases = [
    ['junit5', 'BaseTest.java', [['beforeEach', 'suite', 10, 14], ['afterEach', 'suite', 16, 19]]],
    ['junit4', 'BaseShopTest.java', [['beforeAll', 'suite', 10, 13], ['afterAll', 'suite', 15, 18]]],
    // TestNG: hooks for a whole suite or a whole `<test>` run once for many classes.
    ['testng', 'BaseTest.java', [['beforeAll', 'global', 12, 15], ['afterAll', 'global', 17, 20], ['beforeAll', 'global', 22, 25], ['afterAll', 'global', 27, 30]]],
    ['selenium', 'BaseUiTest.java', [['beforeEach', 'suite', 12, 16], ['afterEach', 'suite', 18, 21]]],
  ];
  for (const [framework, file, hooks] of cases) {
    const model = await modelOf(framework, file);
    assert.deepEqual([model.role, model.tests.length, model.suites.length, hooksOf(model.suites[0].hooks)], ['support', 0, 1, hooks], `${framework}/${file}`);
  }
  // A support file with no hook and no test has no suite: a page object, a utility, step definitions, a suite class.
  for (const [framework, file] of [['selenium', 'pages/LoginPage.java'], ['selenium', 'steps/CheckoutSteps.java'], ['junit5', 'support/Money.java'], ['junit5', 'AllTests.java']]) {
    const model = await modelOf(framework, file);
    assert.deepEqual([model.role, model.tests, model.suites], ['support', [], []], file);
  }
});

test('a class that is named like a test class and has unannotated test methods is a test file with no test', async () => {
  const model = await modelOf('junit5', 'ForgottenAnnotationTest.java');
  assert.deepEqual([model.role, model.tests, model.suites], ['test', [], []]);
  const role = async (text, name = 'CartTest') => (await jv(text.replaceAll('NAME', name), `${TESTS}/${name}.java`)).role;
  const forgotten = 'class NAME { void addsAnItem() { check(); } }\n';
  assert.equal(await role(forgotten), 'test');
  assert.equal(await role(forgotten, 'CartTests'), 'test');
  assert.equal(await role(forgotten, 'CartIT'), 'test');
  // Not named like a test class, abstract, with a hook, or a JUnit 3 class: left alone.
  assert.equal(await role(forgotten, 'TestData'), 'support');
  assert.equal(await role(`abstract ${forgotten}`), 'support');
  assert.equal(await role('import org.junit.jupiter.api.BeforeEach;\nclass NAME { @BeforeEach void setUp() {} void helper() {} }\n'), 'support');
  assert.equal(await role('class NAME extends TestCase { public void testAdds() { check(); } }\n'), 'support');
  // Methods that do not look like tests: with a parameter, a result, an annotation, static or private. An empty class.
  for (const member of ['void add(String item) {}', 'int size() { return 0; }', '@Override void run() {}', 'static void main() {}', 'private void fill() {}', '']) {
    assert.equal(await role(`class NAME { ${member} }\n`), 'support', member);
  }
});

test('spans are 1-based and hold the annotations, the body span is the block, and the hash ignores comments', async () => {
  const model = await modelOf('junit5', 'CartTest.java');
  const byTitle = (title) => model.tests.find((t) => t.title === title);
  // The span starts at the first annotation, also when `@Disabled` is written before `@Test`.
  assert.deepEqual([byTitle('adds an item').span, byTitle('adds an item').bodySpan], [
    { startLine: 42, startColumn: 5, endLine: 48, endColumn: 6 }, { startLine: 44, startColumn: 23, endLine: 48, endColumn: 6 },
  ]);
  assert.deepEqual(byTitle('appliesACoupon').span, { startLine: 61, startColumn: 5, endLine: 67, endColumn: 6 });
  assert.deepEqual([model.suites[0].span.startLine, model.suites[0].suites[0].span.startLine], [17, 85]);
  assert.deepEqual(model.tests.map((t) => t.statementCount), [3, 1, 1, 3, 0, 2, 1, 2, 1]);

  const hash = async (body) => (await classWith([`@Test void a() {${body}}`])).tests[0].bodyHash;
  const base = await hash(' Cart cart = new Cart(); assertEquals(0, cart.total()); ');
  assert.match(base, /^[0-9a-f]{40}$/);
  assert.equal(await hash('\n  Cart cart = new Cart(); // a comment\n\n  /* another */ assertEquals( 0,   cart.total() );\n'), base);
  assert.notEqual(await hash(' Cart cart = new Cart(); assertEquals(1, cart.total()); '), base);
  // Braces are tokens, so what is inside a branch is not the same as what follows it.
  assert.notEqual(await hash(' if (a) { b(); } c(); '), await hash(' if (a) { b(); c(); } '));
  // A string is one token: spaces inside it count.
  assert.notEqual(await hash(' assertEquals("a b", s); '), await hash(' assertEquals("a  b", s); '));
});

test('imports and suppressions are read', async () => {
  const model = await modelOf('testng', 'CartTest.java');
  assert.deepEqual(model.imports.map((entry) => [entry.source, entry.names, entry.framework, entry.span.startLine]), [
    // A static import takes one member from a class.
    ['org.testng.Assert', ['assertEquals'], true, 3], ['org.testng.Assert', ['assertTrue'], true, 4],
    ['org.junit.Assert', ['Assert'], true, 6], ['org.testng.SkipException', ['SkipException'], true, 7], ['org.testng.annotations.AfterClass', ['AfterClass'], true, 8],
    ['org.testng.annotations.AfterMethod', ['AfterMethod'], true, 9], ['org.testng.annotations.BeforeClass', ['BeforeClass'], true, 10], ['org.testng.annotations.BeforeMethod', ['BeforeMethod'], true, 11],
    ['org.testng.annotations.DataProvider', ['DataProvider'], true, 12], ['org.testng.annotations.Ignore', ['Ignore'], true, 13], ['org.testng.annotations.Test', ['Test'], true, 14],
  ]);
  const forms = await jv([
    '/* qa-core-review-disable QCR-D001 -- generated tests repeat on purpose */', '// qa-core-review-disable QCR-X002', 'package shop;', '', 'import static org.assertj.core.api.Assertions.*;', 'import org.junit.jupiter.api.*;',
    'import java.util.List;', 'import shop.pages.LoginPage;', 'import org.mockito.Mock;', '// qa-core-review-disable QCR-W001 -- too late: this is after the first line of code', '',
    'class ATest {', '    // qa-core-review-disable-next-line QCR-F002 -- waits for SHOP-142', '    @Test @Disabled void a() {}', '    /* qa-core-review-disable-next-line QCR-A001, QCR-A002 */', '    @Test void b() {}', '}', '',
  ].join('\n'));
  assert.deepEqual(forms.imports.map((entry) => [entry.source, entry.names, entry.typeOnly, entry.framework]), [
    ['org.assertj.core.api.Assertions', ['*'], false, true], ['org.junit.jupiter.api', ['*'], false, true], ['java.util.List', ['List'], false, false],
    ['shop.pages.LoginPage', ['LoginPage'], false, false], ['org.mockito.Mock', ['Mock'], false, true],
  ]);
  assert.deepEqual(forms.suppressions.map((s) => [s.scope, s.rules, s.reason, s.span.startLine]), [
    ['file', ['QCR-D001'], 'generated tests repeat on purpose', 1], ['file', ['QCR-X002'], null, 2],
    ['next-line', ['QCR-F002'], 'waits for SHOP-142', 13], ['next-line', ['QCR-A001', 'QCR-A002'], null, 15],
  ]);
});

test('names are found through imports: one class, a whole package, a static member, a full name, or none at all', async () => {
  const run = async (header, members = ['@Test void a() {}', '@BeforeEach void b() {}', '@Before public void c() {}', '@BeforeMethod public void d() {}']) => {
    const model = await classWith(members, { header });
    return [model.tests.map((t) => t.title), (model.suites[0]?.hooks ?? []).map((hook) => hook.kind)];
  };
  assert.deepEqual(await run('import org.junit.jupiter.api.Test;\nimport org.junit.jupiter.api.BeforeEach;\n'), [['a'], ['beforeEach']]);
  assert.deepEqual(await run('import org.junit.jupiter.api.*;\n'), [['a'], ['beforeEach']]);
  assert.deepEqual(await run('import org.junit.*;\n'), [['a'], ['beforeEach']]); // `@Before` of JUnit 4
  assert.deepEqual(await run('import org.testng.annotations.*;\n'), [['a'], ['beforeEach']]); // `@BeforeMethod`
  // An annotation of the same name from somewhere else is not the one of the framework.
  assert.deepEqual(await run('import com.example.tools.Test;\nimport org.junit.jupiter.api.BeforeEach;\n'), [[], ['beforeEach']]);
  // With no import at all (a piece of a file), a name of the vocabulary is taken as that.
  assert.deepEqual(await run(''), [['a'], ['beforeEach', 'beforeEach', 'beforeEach']]);
  // With a runner known from the rest of the file, only the names of that runner are taken.
  assert.deepEqual(await run('import org.testng.Assert;\n'), [['a'], ['beforeEach']]);
  // Full names in the code.
  assert.deepEqual(await run('', ['@org.junit.Test public void a() {}', '@org.junit.jupiter.api.AfterAll static void b() {}', '@org.testng.annotations.AfterSuite public void c() {}']), [['a'], ['afterAll', 'afterAll']]);
  // Static members: by name, through `Class.*`, and through the class.
  const skips = async (header, call) => skipOf((await classWith([`@Test void a() { ${call}; }`], { header: `import org.junit.jupiter.api.Test;\n${header}` })).tests[0]);
  assert.equal(await skips('import static org.junit.jupiter.api.Assumptions.assumeTrue;\n', 'assumeTrue(ok)'), 'sometimes: null');
  assert.equal(await skips('import static org.junit.jupiter.api.Assumptions.*;\n', 'abort()'), 'always: null');
  assert.equal(await skips('import org.junit.jupiter.api.Assumptions;\n', 'Assumptions.abort("x")'), 'always: x');
  assert.equal(await skips('import org.junit.Assume;\n', 'Assume.assumeTrue("why", ok)'), 'sometimes: why');
  assert.equal(await skips('import org.testng.SkipException;\n', 'throw new SkipException("x")'), 'always: x');
  assert.equal(await skips('', 'throw new org.testng.SkipException("x")'), 'always: x');
  // A method of the same name that is not imported from a framework is not a skip.
  assert.equal(await skips('', 'assumeTrue(ok)'), null);
  assert.equal(await skips('import static shop.Checks.abort;\n', 'abort()'), null);
  assert.equal(await skips('import shop.SkipException;\n', 'throw new SkipException("x")'), null);
});

test('reasons and titles: joined strings, escapes and text blocks are read, a constant is not', async () => {
  const model = await classWith([
    '@Test @Disabled("plain") void a() {}', '@Test @Disabled(value = "named") void b() {}', '@Test @Disabled("two " + "parts") void c() {}', '@Test @Disabled("tab\\there \\"quoted\\" \\u0041") void d() {}',
    '@Test @Disabled(WHY) void e() {}', '@Test @Disabled("part " + WHY) void f() {}', '@Test @Disabled("""\n        a block\n        """) void g() {}', '@Test @Disabled(("in brackets")) void h() {}',
    '@Test @DisplayName("café ☕ opens") void i() {}', '@Test @DisplayName(TITLE) void j() {}',
  ]);
  assert.deepEqual(model.tests.map((t) => [t.title, t.skip?.reason ?? null]), [
    ['a', 'plain'], ['b', 'named'], ['c', 'two parts'], ['d', 'tab\there "quoted" A'], ['e', null], ['f', null], ['g', '\n        a block\n        '], ['h', 'in brackets'],
    ['café ☕ opens', null],
    // A title that is not written out: the name of the method is used.
    ['j', null],
  ]);
});

test('only real declarations are tests: no false positives from look-alike code', async () => {
  const model = await jv([
    'package shop;', 'import org.junit.jupiter.api.Test;', '', 'class ATest {', '    String text = "@Test void inAString() {}";', '    // @Test void inAComment() {}', '    /* @Test void inABlockComment() {} */',
    '    @Test', '    void real() {', '        Runnable r = new Runnable() {', '            @Override public void run() {}', '        };', '        class Local { @Test void inALocalClass() {} }', '    }', '    @Tested void almost() {}',
    '    @Test int field;', '    @Test ATest() {}', '    void plain() {}', '    @FunctionalInterface interface Shape { void draw(); }', '}', '',
  ].join('\n'));
  // A class declared inside a method is not found by a test runner.
  assert.deepEqual(model.tests.map((t) => t.title), ['real']);
  assert.deepEqual(tree(model.suites), [['ATest', '', 0, 1, []]]);
});

test('every vocabulary entry appears in at least one fixture', () => {
  const sources = [];
  for (const framework of FRAMEWORKS) {
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
      if (entry.isDirectory()) walk(path.join(dir, entry.name));
      else if (entry.name.endsWith('.java')) sources.push(fs.readFileSync(path.join(dir, entry.name), 'utf8'));
    });
    walk(fixtureRoot('adapters', 'java', framework));
  }
  const all = sources.join('\n');
  // An entry that starts or ends with a letter must not be part of a longer word: `@Test` is not found in `@TestFactory`.
  const missing = JAVA_VOCAB_SURFACE.filter((entry) => !new RegExp(`${/^\w/.test(entry) ? '(?<![\\w.])' : ''}${entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${/\w$/.test(entry) ? '(?![\\w])' : ''}`).test(all));
  assert.deepEqual(missing, []);
  assert.equal(new Set(JAVA_VOCAB_SURFACE).size, JAVA_VOCAB_SURFACE.length);
  assert.ok(JAVA_VOCAB_SURFACE.length >= 115, String(JAVA_VOCAB_SURFACE.length));
});

test('every capability the adapter declares is filled in at least one golden', async () => {
  const all = [];
  for (const framework of FRAMEWORKS) all.push(...(await modelsOf(framework)).map((entry) => entry.model));
  // The structure of a file. What a body checks and does is not declared yet, so no rule that needs it runs.
  assert.deepEqual(javaAdapter.capabilities, ['tests', 'suites', 'hooks', 'modifiers', 'parameterized', 'body-hash']);
  for (const capability of javaAdapter.capabilities) {
    assert.ok(all.some((model) => capabilityFilled(capability, model)), `no golden fills "${capability}"`);
    assert.ok(all.every((model) => model.capabilities.includes(capability)));
  }
  // Nothing is filled in that the adapter does not declare.
  for (const model of all) {
    assert.deepEqual([model.subject, model.fileMocks, model.fileResources], [null, [], []], model.path);
    for (const t of model.tests) assert.deepEqual([t.assertions, t.waits, t.selectors, t.mocks, t.resources, t.data, t.steps, t.tryBlocks, t.expectsException], [[], [], [], [], [], [], [], [], false], t.fullTitle);
  }
});

test('robustness: a syntax error keeps the tests around it, and the file is marked partial', async () => {
  const model = await modelOf('junit5', 'BrokenTest.java');
  assert.equal(model.parseStatus, 'partial');
  assert.deepEqual(model.tests.map((t) => t.title), ['beforeTheError', 'withTheError', 'afterTheError']);
  const mixed = await jv('import org.junit.jupiter.api.Test;\nclass ATest {\n  @Test void a() { }\n  @Test void b() { int x = (; }\n  @Test void c( { }\n  @Test void d() { }\n');
  assert.deepEqual(schemaErrors('model.schema.json', mixed), []);
  assert.ok(mixed.tests.some((t) => t.title === 'a'));
});

test('robustness: an empty file, a file with no tests, and a file that is not code', async () => {
  const empty = await jv('');
  assert.deepEqual([empty.role, empty.parseStatus, empty.tests.length, empty.runner], ['support', 'ok', 0, 'unknown']);
  assert.equal((await jv('package shop;\n\nclass CartTest {\n}\n', `${TESTS}/CartTest.java`)).role, 'support');
  assert.equal((await jv('import org.junit.jupiter.api.Test;\nclass Smoke { @Test void a() {} }\n', 'checks/Smoke.java')).role, 'test');
  const garbage = await jv('<<<<<<< HEAD\n}}}} ))) ((( === @@@ ### \n>>>>>>> branch\n ]]] {{{ ;;; ??? \n');
  assert.deepEqual(schemaErrors('model.schema.json', garbage), []);
  assert.deepEqual(garbage.tests, []);
  for (const text of ['class', '@', '@Test', '@Test void a(', 'class A {', 'import', 'import static', 'package', '@Disabled(', '@Test(enabled =', 'class A { @Test void a() { throw new } }', '@ParameterizedTest @ValueSource(ints = {1,']) {
    assert.deepEqual(schemaErrors('model.schema.json', await jv(text)), [], text);
  }
});

test('robustness: with a missing grammar the file is listed as failed, with nothing claimed about it', async () => {
  const parser = createTreeSitterService({ readAsset: (name) => (name.endsWith('java.wasm') ? (() => { throw new Error('gone'); })() : readAsset(name)) });
  const model = await jv('import org.junit.jupiter.api.Test;\nclass ATest { @Test void a() {} }\n', undefined, { parser });
  assert.deepEqual([model.parseStatus, model.capabilities, model.role, model.tests, model.runner], ['failed', [], 'test', [], 'junit5']);
  assert.equal((await jv('class LoginPage {}\n', `${TESTS}/pages/LoginPage.java`, { parser })).role, 'support');
});

test('robustness: CRLF, a byte order mark and non-ASCII names', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcr-java-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'src/test/java'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'pom.xml'), '<project><artifactId>junit-jupiter</artifactId></project>\n');
  const text = 'import org.junit.jupiter.api.DisplayName;\nimport org.junit.jupiter.api.Test;\n\nclass CaféTest {\n    @Test\n    @DisplayName("prüft Überweisung ☕")\n    void überweisung() {\n        String 名前 = "カート";\n    }\n}\n';
  fs.writeFileSync(path.join(dir, 'src/test/java/CaféTest.java'), `${String.fromCharCode(0xfeff)}${text.replaceAll('\n', '\r\n')}`);
  const [{ model, source }] = await normalizeProject(javaAdapter, dir);
  assert.equal(source.text, toLf(text));
  assert.deepEqual(model.tests.map((entry) => [entry.fullTitle, entry.span]), [['CaféTest > prüft Überweisung ☕', { startLine: 5, startColumn: 5, endLine: 9, endColumn: 6 }]]);
  assert.deepEqual([model.parseStatus, model.runner], ['ok', 'junit5']);
});

test('robustness: a 1,000-line file is normalized in under 2 seconds from a cold start', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcr-java-timing-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, BIG_FILES.java.name);
  fs.writeFileSync(file, BIG_FILES.java.text);
  assert.ok(BIG_FILES.java.text.split('\n').length >= 1000);
  const helper = path.join(repoRoot, 'tests', 'helpers', 'normalize-once.mjs');
  const runs = [1, 2].map(() => JSON.parse(spawnSync(process.execPath, [helper, 'java', file], { encoding: 'utf8', windowsHide: true, shell: false }).stdout));
  t.diagnostic(`java: ${runs.map((run) => `${Math.round(run.ms)} ms`).join(', ')}`);
  assert.deepEqual([runs[0].tests, runs[0].parseStatus], [166, 'ok']);
  assert.ok(Math.min(...runs.map((run) => run.ms)) < 2000);
});

test('robustness: broken copies of every fixture are normalized without an error', async () => {
  let seed = 23;
  const next = (limit) => (seed = (seed * 1103515245 + 12345) % 2147483648) % limit;
  for (const framework of FRAMEWORKS) {
    for (const { file, source } of await modelsOf(framework)) {
      for (let round = 0; round < 12; round += 1) {
        const at = next(source.text.length);
        const broken = [source.text.slice(0, at), source.text.slice(0, at) + source.text.slice(at + 1 + next(10)), `${source.text.slice(0, at)}${'([{;)]}"\'@\n\t'[next(12)]}${source.text.slice(at)}`][round % 3];
        const model = await jv(broken, file);
        assert.deepEqual(schemaErrors('model.schema.json', model), [], `${file} cut at ${at}`);
      }
    }
  }
});

test('classifyFile tells test files from support files without parsing', () => {
  const classify = (relPath, text) => javaAdapter.classifyFile({ path: relPath, absPath: relPath, text, language: 'java', project: null });
  assert.equal(classify('src/test/java/CartTest.java', 'class CartTest { @Test void a() {} }\n'), 'test');
  assert.equal(classify('src/test/java/CartTest.java', 'class CartTest {\n  @ParameterizedTest(name = "{0}")\n  void a(int n) {}\n}\n'), 'test');
  assert.equal(classify('src/test/java/CartTest.java', 'class CartTest { @org.junit.jupiter.api.RepeatedTest(3) void a() {} }\n'), 'test');
  assert.equal(classify('src/test/java/Contract.java', 'interface Contract { @TestFactory Stream<DynamicTest> a(); @TestTemplate void b(); }\n'), 'test');
  assert.equal(classify('src/test/java/BaseTest.java', 'abstract class BaseTest { @BeforeEach void setUp() {} }\n'), 'support');
  assert.equal(classify('src/test/java/pages/LoginPage.java', 'public class LoginPage { void open() {} }\n'), 'support');
  assert.equal(classify('src/test/java/Notes.java', '// @Test void a() {}\nclass Notes { String s = "@Test"; /* @Test */ @Tested int x; }\n'), 'support');
});

test('the rules read the Java model: skipped tests and a test file with no test are found, and the rest waits for the next parts', async () => {
  const review = async (framework) => {
    const { report } = await runReview({ root: fixtureRoot('adapters', 'java', framework), config: resolveConfig({}).config, git: false, rules: builtinRules });
    return { report, lines: report.findings.map((finding) => `${finding.location.file.replace(`${TESTS}/`, '')}:${finding.location.startLine} ${finding.ruleId} ${finding.message}`) };
  };
  const junit5 = await review('junit5');
  for (const line of [
    'CartTest.java:61 QCR-F002 This test is skipped: the coupon service is not ready.',
    'CartTest.java:69 QCR-F002 This test is skipped, and no reason is given.',
    'CartTest.java:110 QCR-F002 This suite is skipped, so none of its tests run.',
    'ForgottenAnnotationTest.java:1 QCR-X001 No test was found in this file, although its name says it is a test file.',
    'QualifiedTest.java:19 QCR-F002 This test is skipped: the stub server is replaced.',
  ]) assert.ok(junit5.lines.includes(line), `${line}\n${junit5.lines.join('\n')}`);
  // Two test methods with one name and other parameters are not the same test.
  assert.deepEqual(junit5.lines.filter((line) => line.includes('QCR-D001')), []);
  // A test that is skipped on a condition is not reported.
  assert.deepEqual(junit5.lines.filter((line) => line.startsWith('ConditionsTest.java')).map((line) => line.split(' ').slice(0, 2).join(' ')), ['ConditionsTest.java:109 QCR-F002', 'ConditionsTest.java:122 QCR-F002']);
  const testng = await review('testng');
  assert.deepEqual(testng.lines.filter((line) => line.includes('QCR-F002')).map((line) => line.split(' ').slice(0, 2).join(' ')), [
    'CartTest.java:45 QCR-F002', 'CartTest.java:51 QCR-F002', 'CartTest.java:55 QCR-F002', 'CartTest.java:91 QCR-F002', 'CheckoutTest.java:27 QCR-F002', 'LegacyCheckoutTest.java:8 QCR-F002',
  ]);
  // The rules that need what a body checks or does do not run on a Java file yet.
  const ran = testng.report.files.find((file) => file.file.endsWith('/CartTest.java'));
  assert.deepEqual(ran.rulesSkipped.map((rule) => rule.ruleId), ['QCR-A001', 'QCR-A002', 'QCR-A003', 'QCR-A004', 'QCR-W001', 'QCR-S001', 'QCR-E001', 'QCR-N001', 'QCR-M001', 'QCR-P001', 'QCR-C001']);
});
