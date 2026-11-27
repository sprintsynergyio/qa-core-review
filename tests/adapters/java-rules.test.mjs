// The rules on Java files (SPEC.md Sections 10 and 18, Milestone 14): a fixture folder for
// every rule that applies, with the Java fix text and example on each finding, and the
// acceptance criteria of the milestone that are about rules, from end to end.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { FIX_TEXT, builtinRules, examplesFor, fixFor, termFor } from '../../dist/index.js';
import { ruleFixtureFolders, runRuleFixtures } from '../helpers/fixtures.mjs';

const folders = ruleFixtureFolders().filter((entry) => entry.name.startsWith('java-'));
const reports = new Map();
/** The report of one Java fixture folder, made once. */
async function reportOf(ruleId, name) {
  const key = `${ruleId}/${name}`;
  if (!reports.has(key)) reports.set(key, await runRuleFixtures(folders.find((entry) => entry.ruleId === ruleId && entry.name === name).dir));
  return reports.get(key);
}
/** The findings of the rule in the bad files of one folder, as "File.java:line severity message". */
const messages = async (ruleId, name) => (await reportOf(ruleId, name)).report.findings.filter((entry) => entry.ruleId === ruleId && entry.location.file.startsWith('bad/'))
  .map((entry) => `${entry.location.file.slice(4)}:${entry.location.startLine} ${entry.severity} ${entry.message}`);
const finding = async (ruleId, name, file, line) => (await reportOf(ruleId, name)).report.findings.find((entry) => entry.ruleId === ruleId && entry.location.file === file && entry.location.startLine === line);

test('Java has fixtures for every rule that applies, per framework where the vocabulary differs', () => {
  const byRule = {};
  for (const { ruleId, name } of folders) (byRule[ruleId] ??= []).push(name.replace('java-', ''));
  assert.deepEqual(byRule, {
    'QCR-A001': ['junit5', 'restassured', 'testng'], 'QCR-A002': ['junit5', 'testng'], 'QCR-A003': ['junit5', 'playwright', 'selenium'], 'QCR-A004': ['junit5'],
    'QCR-C001': ['junit5', 'playwright', 'restassured', 'selenium'], 'QCR-D001': ['junit5'], 'QCR-E001': ['junit5', 'testng'], 'QCR-F002': ['junit4', 'junit5', 'testng'],
    'QCR-M001': ['junit5', 'playwright'], 'QCR-N001': ['junit5', 'restassured'], 'QCR-P001': ['junit5'], 'QCR-S001': ['playwright', 'selenium'],
    'QCR-W001': ['playwright', 'selenium'], 'QCR-X002': ['junit5'],
  });
  // QCR-F001 has none: JUnit and TestNG have no way to focus a test in the code. QCR-X001 is checked on broken files, not on fixtures.
  assert.deepEqual(builtinRules.map((rule) => rule.id).filter((id) => !byRule[id]), ['QCR-F001', 'QCR-X001']);
  // Every folder is a project of its own, with a pom.xml that names the framework, and at least 3 bad and 3 good files.
  const artifact = { junit4: 'junit', junit5: 'junit-jupiter', testng: 'testng', selenium: 'selenium-java', playwright: 'playwright', restassured: 'rest-assured' };
  for (const { dir, name } of folders) {
    assert.ok(fs.readFileSync(path.join(dir, 'pom.xml'), 'utf8').includes(`<artifactId>${artifact[name.replace('java-', '')]}</artifactId>`), name);
    for (const kind of ['bad', 'good']) assert.ok(fs.readdirSync(path.join(dir, kind)).filter((file) => file.endsWith('.java')).length >= 3, `${dir}/${kind}`);
  }
});

test('every Java fix text is reached by a bad fixture, and the finding carries the Java fix and example', async () => {
  const seen = new Map();
  for (const { ruleId, name } of folders) {
    const { report, bad } = await reportOf(ruleId, name);
    assert.ok(report.files.every((file) => file.language === 'java' && file.parseStatus === 'ok'), `${ruleId}/${name}`);
    for (const entry of report.findings.filter((entry) => entry.location.file.startsWith('bad/') && entry.ruleId === ruleId)) {
      const key = Object.keys(FIX_TEXT).find((candidate) => (candidate === ruleId || candidate.startsWith(`${ruleId}/`)) && fixFor(candidate, 'java').fix === entry.fix && fixFor(candidate, 'java').goodExample === entry.goodExample);
      assert.ok(key, `${ruleId}/${name} ${entry.location.file}:${entry.location.startLine}: no fix text for "${entry.fix}"`);
      assert.ok(entry.goodExample, `${key}: a Java example`);
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    assert.ok(bad.every((entry) => entry.expected.length > 0), name);
  }
  const java = Object.keys(FIX_TEXT).filter((key) => FIX_TEXT[key].examples.java);
  assert.deepEqual([...seen.keys()].sort(), [...java].sort());
  // The cases with no Java text are the ones a Java file cannot have, and "every import is mocked", which stays silent for Java.
  assert.deepEqual(Object.keys(FIX_TEXT).filter((key) => !FIX_TEXT[key].examples.java), [
    'QCR-A003/unawaited', 'QCR-A003/collection', 'QCR-A003/second-value', 'QCR-E001/promise', 'QCR-F001', 'QCR-F002/expected-failure', 'QCR-P001/inline', 'QCR-P001/visual',
    'QCR-C001/timers', 'QCR-C001/global', 'QCR-M001/everything',
  ]);
  // A Java example is Java: no arrow function, no const or def, no await, no # comment, and no block opened with a colon.
  for (const key of java) {
    const { bad, good } = FIX_TEXT[key].examples.java;
    for (const line of `${bad}\n${good}`.split('\n')) assert.ok(!/=>|\bconst\b|\bawait\b|^\s*def\s|^\s*#|:\s*$/.test(line), `${key}: ${line}`);
  }
});

test('the fix is in Java words where the general one names things Java does not have', () => {
  assert.deepEqual(fixFor('QCR-E001', 'java'), {
    fix: 'Take the assertion out of the try block, or throw the error again in the catch block. To go on after a failed check, use soft assertions (AssertJ SoftAssertions, TestNG SoftAssert).',
    goodExample: 'assertEquals("$32.39", cart.total());',
  });
  assert.match(fixFor('QCR-C001/spy', 'java').fix, /try-with-resources/);
  assert.match(fixFor('QCR-C001/env', 'java').fix, /@AfterEach/);
  assert.match(fixFor('QCR-D001', 'java').fix, /@ParameterizedTest, or one test with a TestNG @DataProvider/);
  assert.match(fixFor('QCR-A003/unreachable', 'java').fix, /fail\(\.\.\.\)/);
  // A key with no Java fix of its own keeps the general one, and the other languages are not touched.
  assert.equal(fixFor('QCR-A002', 'java').fix, FIX_TEXT['QCR-A002'].fix);
  assert.equal(fixFor('QCR-E001', 'typescript').fix, FIX_TEXT['QCR-E001'].fix);
  assert.match(fixFor('QCR-E001', 'python').fix, /except block/);
  assert.deepEqual(examplesFor('QCR-C001', 'java').map((entry) => [entry.title, entry.example !== null]), [
    ['Fake timers that are never switched back', false], ['A spy or stub that is never restored', true], ['An environment variable that is never set back', true],
    ['A global that is never put back', false], ['A browser, context, page or client that is never closed', true], ['Test data that is never deleted (info)', true],
  ]);
  // The same thing under the name Java gives it. Other languages keep the general word.
  assert.deepEqual([termFor('environment variable', 'java'), termFor('patch', 'java'), termFor('environment variable', 'python'), termFor('patch', 'typescript'), termFor('catch block', 'java')],
    ['system property', 'static mock', 'environment variable', 'patch', 'catch block']);
});

test('QCR-A003 on Java: each case has its message, and a soft assertion that is never reported is a case of its own', async () => {
  const cases = [
    ['java-junit5', 'bad/CartTotalTest.java', 15, 'This assertion is never finished: no matcher is called, so nothing is checked.', 'incomplete'],
    ['java-junit5', 'bad/CartTotalTest.java', 21, 'This assertion is never finished: no matcher is called, so nothing is checked.', 'incomplete'],
    ['java-playwright', 'bad/InventoryTitleTest.java', 15, 'This assertion is never finished: no matcher is called, so nothing is checked.', 'incomplete'],
    ['java-junit5', 'bad/SoftCartTest.java', 16, 'This soft assertion is never reported: nothing asks the object that collects it for its failures, so the test passes whatever it finds.', 'soft'],
    ['java-junit5', 'bad/SoftCartTest.java', 17, 'This soft assertion is never reported: nothing asks the object that collects it for its failures, so the test passes whatever it finds.', 'soft'],
    ['java-junit5', 'bad/ReceiptMailTest.java', 23, 'This is not a check on the mock: the assertion method does not exist or is never called, so nothing is checked.', 'mock'],
    ['java-junit5', 'bad/OrderRowsTest.java', 14, 'A count is never below zero, so this check always passes.', 'count'],
    ['java-playwright', 'bad/InventoryListTest.java', 15, 'A count is never below zero, so this check always passes.', 'count'],
    ['java-junit5', 'bad/OrderRowsTest.java', 21, 'This assertion is never reached: the code before it always returns or throws.', 'unreachable'],
    ['java-selenium', 'bad/CartBadgeIT.java', 30, 'This checks only that a locator or element object exists, and it always does. It says nothing about the page.', 'locator'],
    ['java-playwright', 'bad/CheckoutButtonTest.java', 16, 'This checks only that a locator or element object exists, and it always does. It says nothing about the page.', 'locator'],
  ];
  for (const [name, file, line, message, key] of cases) {
    const found = await finding('QCR-A003', name, file, line);
    assert.deepEqual([found?.message, found?.fix, found?.goodExample, found?.severity], [message, fixFor(`QCR-A003/${key}`, 'java').fix, FIX_TEXT[`QCR-A003/${key}`].examples.java.good, 'error'], `${file}:${line}`);
  }
  // The same object with assertAll() at the end, and assertSoftly, which reports by itself, are clean.
  const { good } = await reportOf('QCR-A003', 'java-junit5');
  assert.deepEqual(good.find((entry) => entry.file === 'good/SoftCartTest.java').actual, []);
});

test('Milestone 14: catch (Exception e) around an assertion is not E001; catch (AssertionError e) and catch (Throwable t) are', async () => {
  assert.deepEqual(await messages('QCR-E001', 'java-junit5'), [
    'CartTotalTest.java:13 error This catch block catches the assertion failure and hides it.',
    'CheckoutTest.java:13 error This catch block catches the assertion failure and hides it.',
    'StockTest.java:13 error This catch block catches the assertion failure and hides it.',
  ]);
  const text = (kind, file) => fs.readFileSync(path.join(folders.find((entry) => entry.ruleId === 'QCR-E001' && entry.name === 'java-junit5').dir, kind, file), 'utf8');
  assert.match(text('bad', 'CartTotalTest.java'), /catch \(Throwable ignored\)/);
  assert.match(text('bad', 'CheckoutTest.java'), /catch \(AssertionError error\)/);
  assert.match(text('bad', 'StockTest.java'), /catch \(RuntimeException \| Error problem\)/);
  const found = await finding('QCR-E001', 'java-junit5', 'bad/CheckoutTest.java', 13);
  assert.deepEqual([found.evidence, found.fix], ['assertEquals("paid", receipt.status())', fixFor('QCR-E001', 'java').fix]);
  // Not reported: catch (Exception e), which a failed assertion passes by, a handler that throws again or fails, and one that asserts.
  assert.match(text('good', 'StockTest.java'), /assertEquals\(2, stock\.count\("onesie"\)\);\n {8}\} catch \(Exception problem\) \{\n {12}System\.out\.println/);
  const { good } = await reportOf('QCR-E001', 'java-junit5');
  assert.deepEqual(good.map((entry) => [entry.file, entry.actual]), [['good/CartTotalTest.java', []], ['good/CheckoutTest.java', []], ['good/StockTest.java', []]]);
  assert.deepEqual((await messages('QCR-E001', 'java-testng')).map((line) => line.split(' ')[0]), ['CartTotalTest.java:13', 'OrderTest.java:11', 'StockTest.java:12']);
});

test('Milestone 14: assertNotNull(driver.findElement(...)) is A003, a REST Assured statusCode is an assertion, and @Mock of the class under test is an M001 error', async () => {
  const locator = await finding('QCR-A003', 'java-selenium', 'bad/CheckoutButtonIT.java', 29);
  assert.deepEqual([locator.evidence, locator.message, locator.severity, locator.goodExample], [
    'assertNotNull(driver.findElement(By.id("checkout")))', 'This checks only that a locator or element object exists, and it always does. It says nothing about the page.', 'error',
    'assertTrue(driver.findElement(By.id("checkout")).isDisplayed());',
  ]);
  // `.then().statusCode(200)` is the check of the test. `.then().log().all()` and a request with no `then()` are not.
  const api = await reportOf('QCR-A001', 'java-restassured');
  assert.deepEqual(api.good.map((entry) => entry.actual), [[], [], []]);
  assert.match(fs.readFileSync(path.join(folders.find((entry) => entry.ruleId === 'QCR-A001' && entry.name === 'java-restassured').dir, 'good', 'HealthApiTest.java'), 'utf8'), /when\(\)\.get\("https:\/\/api\.example\.test\/health"\)\.then\(\)\.statusCode\(200\);/);
  assert.deepEqual(await messages('QCR-A001', 'java-restassured'), [
    'HealthApiTest.java:10 error This test has no assertion, so it passes whatever the code does.',
    'OrdersApiTest.java:10 error This test has no assertion, so it passes whatever the code does.',
    'ProductsApiTest.java:10 error This test has no assertion, so it passes whatever the code does.',
  ]);
  assert.deepEqual(await messages('QCR-M001', 'java-junit5'), [
    'CheckoutTest.java:22 error gateway.fee is given a fixed reply and is then called and checked, so this assertion checks the mock.',
    // PricesTest tests Prices, and `@Mock Prices prices` replaces it.
    'PricesTest.java:13 error The code under test, Prices, is replaced by a mock, so the tests check the mock.',
    'PricesTest.java:19 error prices.of is given a fixed reply and is then called and checked, so this assertion checks the mock.',
    'ReceiptMailTest.java:22 warn The only assertion of this test checks a call on a mock. No real result is checked.',
  ]);
  assert.deepEqual((await messages('QCR-M001', 'java-playwright')).map((line) => line.split(', so')[0]), [
    'CartTest.java:14 warn Every network request is answered by a fake (**)', 'CheckoutTest.java:14 warn Every network request is answered by a fake (**/*)', 'InventoryTest.java:14 warn Every network request is answered by a fake (**/*)',
  ]);
});

test('QCR-C001 on Java: the message uses the Java word, a hook or a try-with-resources releases, and every bad file has a fixed twin', async () => {
  assert.deepEqual(await messages('QCR-C001', 'java-junit5'), [
    'CurrencyTest.java:10 warn This system property is changed and never set back.',
    'ReceiptTimeTest.java:17 warn This static mock is never undone.',
    'RegionTest.java:10 warn This system property is changed and never set back.',
  ]);
  assert.deepEqual(await messages('QCR-C001', 'java-selenium'), [
    'CartIT.java:13 warn This driver is started and never quit.', 'InventoryIT.java:17 warn This driver is started and never quit.', 'LoginPageIT.java:15 warn This driver is started and never quit.',
  ]);
  // Everything made from a Playwright object that is never closed is reported, one finding per thing.
  assert.deepEqual((await messages('QCR-C001', 'java-playwright')).filter((line) => line.startsWith('LoginPageTest')), [
    'LoginPageTest.java:13 warn This browser is opened and never closed.', 'LoginPageTest.java:14 warn This browser is opened and never closed.', 'LoginPageTest.java:15 warn This page is opened and never closed.',
  ]);
  const data = await finding('QCR-C001', 'java-restassured', 'bad/OrdersApiTest.java', 12);
  assert.deepEqual([data.message, data.severity, data.confidence, data.goodExample], ['This test creates data over HTTP and never deletes it.', 'info', 'low', FIX_TEXT['QCR-C001/data'].examples.java.good]);
  for (const name of ['java-junit5', 'java-playwright', 'java-restassured', 'java-selenium']) {
    const { bad, good } = await reportOf('QCR-C001', name);
    assert.deepEqual(good.map((entry) => entry.file.replace('good/', '')), bad.map((entry) => entry.file.replace('bad/', '')), `${name}: one good twin per bad file`);
  }
});

test('the other rules on Java: skips with their reason, copies, waits, selectors, snapshots and suppressions', async () => {
  assert.deepEqual(await messages('QCR-F002', 'java-junit5'), [
    'CouponTest.java:10 warn This test is skipped, and no reason is given.', 'CouponTest.java:16 warn This test is skipped: the coupon service is down.',
    'RefundTest.java:7 warn This suite is skipped, so none of its tests run.', 'ShippingTest.java:15 warn This test is skipped, and no reason is given.',
  ]);
  assert.deepEqual(await messages('QCR-F002', 'java-junit4'), [
    'CouponTest.java:10 warn This test is skipped, and no reason is given.', 'RefundTest.java:7 warn This suite is skipped, so none of its tests run.',
    'ShippingTest.java:10 warn This test is skipped: SHOP-123: the price table is not final.',
  ]);
  // TestNG: @Test(enabled = false) on a method and on a class, and @Ignore.
  assert.deepEqual((await messages('QCR-F002', 'java-testng')).map((line) => line.split(' warn ')[0]), ['CouponTest.java:10', 'RefundTest.java:7', 'ShippingTest.java:10']);
  assert.deepEqual(await messages('QCR-D001', 'java-junit5'), [
    'CartTest.java:16 warn This test has the same body as "addsAnApple" (line 10).',
    'CouponTest.java:17 warn This test has the same title as the test on line 10, so a report cannot tell the two apart.',
    'ShoppingCartTest.java:10 warn This test has the same body as "addsAnApple" (bad/CartTest.java:10).',
  ]);
  assert.deepEqual(await messages('QCR-W001', 'java-selenium'), [
    'CartBadgeIT.java:29 warn Hard wait of 3000 ms.', 'CheckoutIT.java:30 warn Hard wait of 2000 ms.',
    'SlowPageIT.java:18 info Implicit wait of 30000 ms. Mixed with explicit waits, the two add up and a missing element takes that long to fail.',
  ]);
  // A sleep whose time is a constant is still a hard wait. Its length is not guessed.
  assert.deepEqual(await messages('QCR-W001', 'java-playwright'), ['CartBadgeTest.java:16 warn Hard wait of 3000 ms.', 'CheckoutTest.java:16 warn Hard wait of 1500 ms.', 'LoginTest.java:17 warn Hard wait: the test sleeps for a fixed time.']);
  assert.deepEqual(await messages('QCR-S001', 'java-selenium'), [
    'CheckoutIT.java:28 warn Selector uses a generated name that changes from build to build: css-1x2y3z4.',
    'CheckoutIT.java:29 warn Selector follows the page structure through many levels: #root > div > div > main > section > button.',
    'InventoryIT.java:28 info Picks the element at index 2 of a list, so the test depends on the order of the list.',
    'InventoryIT.java:29 warn Selector picks an element by its position in the page: ul.inventory_list > li:nth-child(3) button.',
    'LoginIT.java:28 warn XPath depends on layout: //div[2]/div[1]/div/form/input[3].',
    'LoginIT.java:29 warn XPath depends on layout: /html/body/div/div/div/div[1]/div[2]/span.',
  ]);
  assert.deepEqual((await messages('QCR-S001', 'java-playwright')).map((line) => line.split(' ').slice(0, 2).join(' ')), [
    'CheckoutTest.java:15 warn', 'CheckoutTest.java:16 warn', 'InventoryTest.java:15 warn', 'InventoryTest.java:16 info', 'LoginTest.java:15 warn', 'LoginTest.java:16 warn',
  ]);
  assert.deepEqual(await messages('QCR-P001', 'java-junit5'), [
    'InvoiceTest.java:14 warn All 2 assertions of this test are snapshots, which the first run records whatever the output is.',
    'OrderJsonTest.java:13 warn The only assertion of this test is a snapshot, which the first run records whatever the output is.',
    'ReceiptTest.java:15 warn The only assertion of this test is a snapshot, which the first run records whatever the output is.',
  ]);
  assert.deepEqual((await messages('QCR-A004', 'java-junit5')).map((line) => line.split(' of this test')[0]), [
    'CatalogTest.java:14 warn The only assertion', 'DiscountTest.java:14 warn All 2 assertions', 'OrderHistoryTest.java:14 warn The only assertion',
  ]);
  // A suppression with no reason is ignored, so the finding it was meant for still shows: next line, an empty reason, and the whole-file form above `package`.
  const { bad, good } = await reportOf('QCR-X002', 'java-junit5');
  assert.deepEqual(bad.map((entry) => [entry.file, entry.actual]), [
    ['bad/AnimationTest.java', ['QCR-W001@14', 'QCR-X002@13']], ['bad/CartTest.java', ['QCR-A001@11', 'QCR-X002@10']], ['bad/StockTest.java', ['QCR-A002@14', 'QCR-X002@1']],
  ]);
  assert.deepEqual(good.map((entry) => entry.actual), [[], [], []]);
  assert.equal((await finding('QCR-X002', 'java-junit5', 'bad/StockTest.java', 1)).evidence, 'qa-core-review-disable QCR-A002');
});
