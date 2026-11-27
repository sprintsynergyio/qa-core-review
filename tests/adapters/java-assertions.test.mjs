// The Java adapter, what a body checks (SPEC.md Sections 8.1 and 9.3): the assertions of JUnit,
// TestNG, AssertJ, Hamcrest, REST Assured, Mockito and Playwright for Java with their
// operands, guards and reachability, try blocks, helpers, and the rules that read them.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { builtinRules, createHelperIndex, javaAdapter, resolveConfig, runReview } from '../../dist/index.js';
import { adapterContext, fixtureRoot, normalizeText } from '../helpers/adapter-suite.mjs';

const TESTS = 'src/test/java/shop';
const JUNIT5 = 'import org.junit.jupiter.api.*;\nimport static org.junit.jupiter.api.Assertions.*;\n';
const JUNIT4 = 'import org.junit.Test;\nimport static org.junit.Assert.*;\n';
const TESTNG = 'import org.testng.annotations.Test;\nimport org.testng.Assert;\nimport org.testng.AssertJUnit;\n';
const ASSERTJ = 'import org.junit.jupiter.api.Test;\nimport static org.assertj.core.api.Assertions.*;\nimport org.assertj.core.api.SoftAssertions;\n';
const HAMCREST = 'import org.junit.jupiter.api.Test;\nimport static org.hamcrest.MatcherAssert.assertThat;\nimport static org.hamcrest.Matchers.*;\n';
const MOCKITO = 'import org.junit.jupiter.api.Test;\nimport static org.mockito.Mockito.*;\nimport org.mockito.Mockito;\nimport org.mockito.BDDMockito;\n';
const BARE = 'import org.junit.jupiter.api.Test;\n';

const classWith = (members, { header = JUNIT5, ...options } = {}) =>
  normalizeText(javaAdapter, `${TESTS}/ATest.java`, `${header}\nclass ATest {\n${members.map((line) => `    ${line}`).join('\n')}\n}\n`, options);
/** The one test of a class whose body is these statements. */
const body = async (statements, options) => (await classWith(['@Test void a() {', ...statements.map((line) => `    ${line}`), '}'], options)).tests[0];
const flagsOf = (a) => [
  a.negated && 'not', a.soft && 'soft', !a.complete && 'incomplete', a.guarded && 'guarded', !a.reachable && 'unreachable', a.viaHelper && `via ${a.viaHelper}`, a.operator,
  a.statusCodes && `codes ${a.statusCodes}`,
].filter(Boolean).join(' ');
const mark = (e) => (e ? `${e.normalized}${e.isLocator ? '~locator' : ''}${e.isCount ? '~count' : ''}${e.isMock ? '~mock' : ''}` : '-');
/** One line per assertion: `library.matcher kind: actual | expected [flags]`. */
const checksOf = (t) => t.assertions.map((a) => `${a.library}.${a.matcher} ${a.kind}: ${mark(a.actual)} | ${mark(a.expected)}${flagsOf(a) ? ` [${flagsOf(a)}]` : ''}`);
const checks = async (statements, options) => checksOf(await body(statements, options));
const blocksOf = (t) => t.tryBlocks.map((b) => [b.assertionsInside, b.catches.join(' '), b.catchesAssertionFailures, [b.handlerRethrows && 'rethrows', b.handlerFails && 'fails', b.handlerAsserts && 'asserts'].filter(Boolean).join(' ')]);

test('JUnit 5 takes the expected value first, JUnit 4 a message before it, and TestNG the actual value first', async () => {
  assert.deepEqual(await checks(['assertEquals(2, cart.size());', 'assertEquals(1.5, cart.total(), 0.01, "total");', 'assertNotEquals("b", cart.name());', 'assertSame(Status.OPEN, cart.status());']), [
    'junit.assertEquals equality: cart.size()~count | 2', 'junit.assertEquals equality: cart.total() | 1.5', 'junit.assertNotEquals equality: cart.name() | "b" [not]',
    'junit.assertSame equality: cart.status() | Status.OPEN',
  ]);
  // The first of three values is a message when it is a text: a delta as the third value is not mixed up with it.
  assert.deepEqual(await checks([
    'assertEquals("size", 2, cart.size());', 'assertEquals("a" + 1, "a1", cart.name());', 'assertEquals(1.5, cart.total(), 0.01);', 'assertEquals("total", 1.5, cart.total(), 0.01);',
    'assertTrue("open", cart.open());', 'assertNull("none", cart.coupon());', 'assertEquals("a", cart.name());',
  ], { header: JUNIT4 }), [
    'junit.assertEquals equality: cart.size()~count | 2', 'junit.assertEquals equality: cart.name() | "a1"', 'junit.assertEquals equality: cart.total() | 1.5',
    'junit.assertEquals equality: cart.total() | 1.5', 'junit.assertTrue truthiness: cart.open() | -', 'junit.assertNull nullness: cart.coupon() | -',
    'junit.assertEquals equality: cart.name() | "a"',
  ]);
  assert.deepEqual(await checks([
    'Assert.assertEquals(cart.size(), 2);', 'Assert.assertEquals(cart.size(), 2, "size");', 'AssertJUnit.assertEquals("size", 2, cart.size());', 'Assert.assertNotEquals(cart.name(), "b");',
  ], { header: TESTNG }), [
    'testng.assertEquals equality: cart.size()~count | 2', 'testng.assertEquals equality: cart.size()~count | 2', 'testng.assertEquals equality: cart.size()~count | 2',
    'testng.assertNotEquals equality: cart.name() | "b" [not]',
  ]);
});

test('an assertion that is not imported is the one of the runner of the file, and one from another class is not ours', async () => {
  const lines = ['assertEquals(2, cart.size());', 'Assertions.assertEquals(2, cart.size());', 'org.junit.jupiter.api.Assertions.assertTrue(cart.open());', 'fail("no");'];
  assert.deepEqual(await checks(lines, { header: BARE }), [
    'junit.assertEquals equality: cart.size()~count | 2', 'junit.assertEquals equality: cart.size()~count | 2', 'junit.assertTrue truthiness: cart.open() | -', 'junit.fail fail-call: - | -',
  ]);
  assert.deepEqual(await checks(['assertEquals(cart.size(), 2);', 'Assert.assertEquals(cart.size(), 2);'], { header: 'import org.testng.annotations.Test;\n' }), [
    'testng.assertEquals equality: cart.size()~count | 2', 'testng.assertEquals equality: cart.size()~count | 2',
  ]);
  assert.deepEqual(await checks(['assertEquals("size", 2, cart.size());', 'Assert.assertEquals(2, cart.size());'], { header: 'import org.junit.Test;\n' }), [
    'junit.assertEquals equality: cart.size()~count | 2', 'junit.assertEquals equality: cart.size()~count | 2',
  ]);
  // Called on some object, the order of the values is not known: the name alone says it is a check. `fail` and `verify` on an object say nothing.
  assert.deepEqual(await checks(['checker.assertEquals(1, 2);', 'checker.fail("x");', 'this.fail("x");', 'report.verify(order);', 'promise.then(result).isEqualTo(1);', 'cart.assertAll();', 'Objects.requireNonNull(cart);']), [
    'assert-method.assertEquals other: 1 | 2',
  ]);
  assert.deepEqual(await checks(['assertEquals(1, cart.size());', 'fail("x");'], { header: `${BARE}import static shop.support.Checks.assertEquals;\nimport static shop.support.Checks.fail;\n` }), [
    'assert-method.assertEquals other: 1 | cart.size()~count',
  ]);
});

test('a condition inside assertTrue, assertFalse or `assert` is read as the comparison it holds', async () => {
  assert.deepEqual(await checks([
    'assertTrue(cart.size() == 2);', 'assertTrue(cart.size() != 2);', 'assertFalse(cart.size() == 2);', 'assertTrue(cart.name() != null);', 'assertTrue(null == cart.name());', 'assertTrue(3 > cart.size());',
    'assertFalse(cart.size() < 0);', 'assertTrue(!(cart.size() <= 1));', 'assertTrue(cart.name().equals("a"));', 'assertTrue(!cart.open());', 'assertTrue(cart instanceof Cart);',
    'assertTrue(cart.open() && cart.size() > 0);', 'assert cart.open();', 'assert cart.size() >= 0 : "never";',
  ]), [
    'junit.assertTrue equality: cart.size()~count | 2', 'junit.assertTrue equality: cart.size()~count | 2 [not]', 'junit.assertFalse equality: cart.size()~count | 2 [not]',
    'junit.assertTrue nullness: cart.name() | - [not]', 'junit.assertTrue nullness: cart.name() | -',
    // The value under test is the side that is not a literal.
    'junit.assertTrue comparison: cart.size()~count | 3 [<]', 'junit.assertFalse comparison: cart.size()~count | 0 [not <]', 'junit.assertTrue comparison: cart.size()~count | 1 [not <=]',
    'junit.assertTrue equality: cart.name() | "a"', 'junit.assertTrue truthiness: cart.open() | - [not]', 'junit.assertTrue type: cart | Cart', 'junit.assertTrue truthiness: cart.open()&&cart.size()>0 | -',
    'java.assert truthiness: cart.open() | -', 'java.assert comparison: cart.size()~count | 0 [>=]',
  ]);
});

test('operands: literals, collections, names, members and calls', async () => {
  const t = await body([
    'assertEquals(-1, n);', 'assertEquals(1_000L, n);', 'assertEquals("a" + "b", s);', 'assertTrue(true);', 'assertNull(null);', 'assertArrayEquals(new int[] {}, xs);', 'assertArrayEquals(new int[] {1}, xs);',
    'assertArrayEquals(new int[2], xs);', 'assertEquals(cart.total, this.total);', 'assertEquals(xs[0], (int) n);', 'assertEquals(new Money(1), cart.total());', "assertEquals('a', c);",
  ]);
  const kind = (e) => (e.literal ? `${e.kind}:${e.literal.type}:${e.literal.value}` : e.kind);
  assert.deepEqual(t.assertions.map((a) => [kind(a.expected ?? a.actual), kind(a.actual)]), [
    ['literal:number:-1', 'identifier'], ['literal:number:1_000L', 'identifier'], ['other', 'identifier'], ['literal:bool:true', 'literal:bool:true'], ['literal:null:null', 'literal:null:null'],
    ['literal:empty-collection:{}', 'identifier'], ['collection', 'identifier'], ['call', 'identifier'], ['member', 'member'], ['member', 'identifier'], ['call', 'call'], ['literal:string:a', 'identifier'],
  ]);
  // A cast and parentheses do not hide what a value is, and the text of an operand is kept as it is written.
  assert.deepEqual([t.assertions[9].actual.text, t.assertions[9].actual.normalized, t.assertions[0].text, t.assertions[0].span.startLine], ['(int) n', '(int)n', 'assertEquals(-1, n)', 6]);
});

test('AssertJ: one assertion per check, and a chain with no check is not finished', async () => {
  assert.deepEqual(await checks([
    'assertThat(cart.size()).isEqualTo(2);', 'assertThat(cart.items()).as("items").hasSize(2).contains("a").doesNotContain("b");', 'assertThat(cart);', 'assertThat(cart).as("the cart");',
    'assertThat(cart).matches(c -> c.open());', 'assertThat(cart.size()).isGreaterThanOrEqualTo(0);', 'Assertions.assertThat(cart.name()).isEqualTo("a");',
    'org.assertj.core.api.Assertions.assertThat(cart.name()).isNotEqualTo("b");', 'assertThat(cart).extracting(Cart::name).isEqualTo("a");', 'assertThat(1).isEqualTo(1);', 'fail("no");',
  ], { header: ASSERTJ }), [
    'assertj.isEqualTo equality: cart.size()~count | 2', 'assertj.hasSize count: cart.items() | 2', 'assertj.contains contains: cart.items() | "a"', 'assertj.doesNotContain contains: cart.items() | "b" [not]',
    'assertj.null other: cart | - [incomplete]', 'assertj.null other: cart | - [incomplete]',
    // A method that the vocabulary does not know is still a check.
    'assertj.matches other: cart | -', 'assertj.isGreaterThanOrEqualTo comparison: cart.size()~count | 0 [>=]', 'assertj.isEqualTo equality: cart.name() | "a"',
    'assertj.isNotEqualTo equality: cart.name() | "b" [not]',
    // After `extracting` the value under test is another one, which is not written in the code.
    'assertj.isEqualTo equality: - | "a"', 'assertj.isEqualTo equality: 1 | 1', 'assertj.fail fail-call: - | -',
  ]);
  // A check that is one call of a chain starts at the name of that call and ends with it.
  const chain = await body(['assertThat(cart.items())', '    .hasSize(2)', '    .contains("a");'], { header: ASSERTJ });
  assert.deepEqual(chain.assertions.map((a) => [a.span.startLine, a.span.startColumn, a.span.endLine]), [[8, 14, 8], [9, 14, 9]]);
  // `then` is the BDD name of AssertJ only when it is imported from there.
  assert.deepEqual(await checks(['then(cart.size()).isEqualTo(2);'], { header: `${BARE}import static org.assertj.core.api.BDDAssertions.then;\n` }), ['assertj.isEqualTo equality: cart.size()~count | 2']);
  assert.deepEqual(await checks(['then(cart.size()).isEqualTo(2);'], { header: BARE }), []);
  assert.deepEqual(await checks(['assertThat(cart.name()).isEqualTo("a");'], { header: `${BARE}import static com.google.common.truth.Truth.assertThat;\n` }), ['truth.isEqualTo equality: cart.name() | "a"']);
});

test('AssertJ on code that throws: the test expects an exception only when the check is finished', async () => {
  const throwing = await body([
    'assertThatThrownBy(() -> cart.pay()).isInstanceOf(IllegalStateException.class);', 'assertThatThrownBy(() -> cart.pay());',
    'assertThatExceptionOfType(IllegalStateException.class).isThrownBy(() -> cart.pay()).withMessage("x");', 'assertThatIllegalArgumentException().isThrownBy(() -> cart.add(null));',
    'assertThatCode(() -> cart.pay()).isInstanceOf(IllegalStateException.class);',
  ], { header: ASSERTJ });
  assert.deepEqual([throwing.expectsException, checksOf(throwing)], [true, [
    'assertj.assertThatThrownBy throws: - | -', 'assertj.assertThatThrownBy throws: - | -', 'assertj.assertThatExceptionOfType throws: - | IllegalStateException.class',
    'assertj.assertThatIllegalArgumentException throws: - | -', 'assertj.assertThatCode throws: - | -',
  ]]);
  const quiet = await body(['assertThatCode(() -> cart.clear()).doesNotThrowAnyException();', 'assertThatNoException().isThrownBy(() -> cart.clear());'], { header: ASSERTJ });
  assert.deepEqual([quiet.expectsException, checksOf(quiet)], [false, ['assertj.assertThatCode throws: - | - [not]', 'assertj.assertThatNoException throws: - | - [not]']]);
  const unfinished = await body(['assertThatExceptionOfType(IllegalStateException.class);', 'assertThatCode(() -> cart.clear());', 'assertThatNoException();'], { header: ASSERTJ });
  assert.deepEqual([unfinished.expectsException, checksOf(unfinished)], [false, [
    'assertj.assertThatExceptionOfType throws: - | IllegalStateException.class [incomplete]', 'assertj.assertThatCode throws: - | - [incomplete]', 'assertj.assertThatNoException throws: - | - [incomplete]',
  ]]);
});

test('soft assertions are finished only when the object that collects them reports', async () => {
  const made = ['SoftAssertions softly = new SoftAssertions();', 'softly.assertThat(a).isTrue();', 'softly.assertThat(b).isEqualTo(1);'];
  assert.deepEqual(await checks(made, { header: ASSERTJ }), ['assertj.isTrue truthiness: a | - [soft incomplete]', 'assertj.isEqualTo equality: b | 1 [soft incomplete]']);
  assert.deepEqual(await checks([...made, 'softly.assertAll();'], { header: ASSERTJ }), ['assertj.isTrue truthiness: a | - [soft]', 'assertj.isEqualTo equality: b | 1 [soft]']);
  // An object that this body does not make with `new` is reported somewhere else: a field, an extension, a callback, a try-with-resources.
  assert.deepEqual(await checks([
    'SoftAssertions mine = factory.soft();', 'mine.assertThat(a).isTrue();', 'softly.assertThat(a).isTrue();', 'SoftAssertions.assertSoftly(s -> s.assertThat(a).isTrue());',
    'try (AutoCloseableSoftAssertions auto = new AutoCloseableSoftAssertions()) { auto.assertThat(a).isTrue(); }',
  ], { header: ASSERTJ }), Array(4).fill('assertj.isTrue truthiness: a | - [soft]'));
  // TestNG: the same methods as `Assert`, with the actual value first.
  const testng = { header: 'import org.testng.annotations.Test;\nimport org.testng.asserts.SoftAssert;\n' };
  const soft = ['SoftAssert soft = new SoftAssert();', 'soft.assertEquals(cart.size(), 2, "size");', 'soft.assertTrue(cart.size() >= 0);', 'soft.fail("x");'];
  assert.deepEqual(await checks(soft, testng), [
    'testng.assertEquals equality: cart.size()~count | 2 [soft incomplete]', 'testng.assertTrue comparison: cart.size()~count | 0 [soft incomplete >=]', 'testng.fail fail-call: - | - [soft incomplete]',
  ]);
  assert.deepEqual((await body([...soft, 'soft.assertAll();'], testng)).assertions.map((a) => [a.soft, a.complete]), Array(3).fill([true, true]));
});

test('Hamcrest: the matcher gives the kind, through `is` and `not`, and the shape of the call tells it from AssertJ', async () => {
  assert.deepEqual(await checks([
    'assertThat(cart.size(), is(2));', 'assertThat(cart.size(), equalTo(2));', 'assertThat(cart.size(), is(not(2)));', 'assertThat(cart.size(), not(is(equalTo(2))));',
    'assertThat("size", cart.size(), greaterThanOrEqualTo(0));', 'assertThat(cart.name(), is(nullValue()));', 'assertThat(cart.name(), not(nullValue()));', 'assertThat(cart.items(), not(hasItem("x")));',
    'assertThat(cart.items(), allOf(hasSize(1), hasItem("a")));', 'assertThat(cart.items(), is(custom()));', 'assertThat(cart, is(cart));',
  ], { header: HAMCREST }), [
    'hamcrest.assertThat equality: cart.size()~count | 2', 'hamcrest.assertThat equality: cart.size()~count | 2', 'hamcrest.assertThat equality: cart.size()~count | 2 [not]',
    'hamcrest.assertThat equality: cart.size()~count | 2 [not]', 'hamcrest.assertThat comparison: cart.size()~count | 0 [>=]', 'hamcrest.assertThat nullness: cart.name() | -',
    'hamcrest.assertThat nullness: cart.name() | - [not]', 'hamcrest.assertThat contains: cart.items() | "x" [not]',
    // A matcher that is not known, or a call that may give a matcher or a value: a check of an unknown kind.
    'hamcrest.assertThat other: cart.items() | -', 'hamcrest.assertThat other: cart.items() | -', 'hamcrest.assertThat equality: cart | cart',
  ]);
  assert.deepEqual(await checks(['assertThat(cart.size()).isEqualTo(2);', 'assertThat(cart.size(), is(2));'], { header: `${HAMCREST}import static org.assertj.core.api.Assertions.assertThat;\n` }), [
    'assertj.isEqualTo equality: cart.size()~count | 2', 'hamcrest.assertThat equality: cart.size()~count | 2',
  ]);
  // The `assertThat` of JUnit 4 is the one of Hamcrest.
  assert.deepEqual(await checks(['assertThat("size", cart.size(), is(2));'], { header: `${JUNIT4}import static org.hamcrest.CoreMatchers.*;\n` }), ['hamcrest.assertThat equality: cart.size()~count | 2']);
});

test('REST Assured: the checks after then() are assertions, in a file that imports it', async () => {
  const header = `${BARE}import static io.restassured.RestAssured.*;\nimport static org.hamcrest.Matchers.*;\n`;
  assert.deepEqual(await checks([
    'given().get("/a").then().statusCode(200).body("id", equalTo(7));', 'get("/a").then().statusCode(anyOf(is(200), is(201)));', 'get("/a").then().log().all();',
    'get("/a").then().assertThat().statusCode(404).and().body("items", not(empty()));', 'response.then().statusCode(HttpStatus.SC_OK);', 'get("/a").then().header("X-Id", "7").time(lessThan(500L));',
    'get("/a").then().extract().path("id");', 'get("/a").statusCode();',
  ], { header }), [
    'restassured.statusCode status: - | 200 [codes 200]', 'restassured.body equality: - | 7', 'restassured.statusCode status: - | - [codes 200,201]', 'restassured.statusCode status: - | 404 [codes 404]',
    'restassured.body count: - | - [not]',
    // A constant for the code: a status check with no code known.
    'restassured.statusCode status: - | HttpStatus.SC_OK', 'restassured.header equality: - | "7"', 'restassured.time comparison: - | 500L [<]',
  ]);
  assert.deepEqual(await checks(['promise.then().statusCode(200);', 'client.get("/a").then().body("id", 7);'], { header: BARE }), []);
  // A status that is read by hand and compared is a status check too.
  assert.deepEqual(await checks(['assertEquals(201, response.statusCode());', 'assertTrue(response.getStatusCode() == 404);', 'assertEquals(201, response.size());']), [
    'junit.assertEquals status: response.statusCode() | 201 [codes 201]', 'junit.assertTrue status: response.getStatusCode() | 404 [codes 404]', 'junit.assertEquals equality: response.size()~count | 201',
  ]);
});

test('Spring response checks, a Reactor StepVerifier and snapshot checks are assertions', async () => {
  assert.deepEqual(await checks([
    'mockMvc.perform(get("/a")).andExpect(status().isOk()).andExpect(jsonPath("$.id").value(7));', 'mockMvc.perform(get("/a")).andExpect(status().is(404));',
    'client.get().uri("/a").exchange().expectStatus().isEqualTo(409).expectBody().jsonPath("$.id").isEqualTo(7);', 'mockMvc.perform(get("/a")).andDo(print());',
  ], { header: BARE }), [
    'spring.andExpect status: - | -', 'spring.andExpect other: - | -', 'spring.andExpect status: - | - [codes 404]', 'spring.expectStatus status: - | - [codes 409]', 'spring.expectBody other: - | -',
  ]);
  // The expectations of a StepVerifier are checked only when a `verify...` call at the end runs it.
  assert.deepEqual(await checks(['StepVerifier.create(orders).expectNext(first).verifyComplete();', 'StepVerifier.create(orders).expectNext(first).expectComplete();', 'reactor.test.StepVerifier.create(orders).expectError().verify();'], { header: BARE }), [
    'reactor.verifyComplete other: - | -', 'reactor.expectComplete other: - | - [incomplete]', 'reactor.verify other: - | -',
  ]);
  assert.deepEqual(await checks(['Approvals.verify(cart.receipt());', 'org.approvaltests.Approvals.verifyAsJson(cart);', 'expect.scenario("a").toMatchSnapshot(cart);', 'Checks.verify(cart);'], { header: BARE }), [
    'snapshot.verify snapshot: cart.receipt() | -', 'snapshot.verifyAsJson snapshot: cart | -', 'snapshot.toMatchSnapshot snapshot: cart | -',
  ]);
});

test('Mockito: verify with a call named on the mock is a check, and verify(mock) alone is not finished', async () => {
  assert.deepEqual(await checks([
    'Mailer mailer = mock(Mailer.class);', 'verify(mailer).send("a");', 'verify(mailer, times(2)).send("a");', 'verify(mailer, never()).send("a");', 'verify(mailer, Mockito.never()).send("a");', 'verify(mailer);',
    'Mockito.verify(mailer).send("a");', 'verifyNoInteractions(mailer);', 'Mockito.verifyNoMoreInteractions(mailer);', 'BDDMockito.then(mailer).should().send("a");',
    'BDDMockito.then(mailer).should(never()).send("a");', 'BDDMockito.then(mailer).should();', 'BDDMockito.then(mailer).shouldHaveNoInteractions();', 'assertEquals(1, mailer.sent());',
    'inOrder.verify(mailer).send("a");', 'verify();',
  ], { header: MOCKITO }), [
    'mockito.verify mock-call: mailer~mock | -', 'mockito.verify mock-call: mailer~mock | -', 'mockito.verify mock-call: mailer~mock | - [not]', 'mockito.verify mock-call: mailer~mock | - [not]',
    'mockito.verify mock-call: mailer~mock | - [incomplete]', 'mockito.verify mock-call: mailer~mock | -', 'mockito.verifyNoInteractions mock-call: mailer~mock | -',
    'mockito.verifyNoMoreInteractions mock-call: mailer~mock | -', 'mockito.should mock-call: mailer~mock | -', 'mockito.should mock-call: mailer~mock | - [not]',
    'mockito.should mock-call: mailer~mock | - [incomplete]', 'mockito.shouldHaveNoInteractions mock-call: mailer~mock | -',
    // A value that is read from a mock is marked, for the rules about mocks.
    'junit.assertEquals equality: mailer.sent()~mock | 1', 'mockito.verify mock-call: mailer~mock | -',
  ]);
  // Without the import, `verify` is the one of Mockito only on something that is known to be a mock.
  assert.deepEqual(await checks(['verify(mailer).send("a");', 'verifyNoInteractions(mailer);', 'then(mailer).should().send("a");'], { header: BARE }), []);
  const fields = await classWith(['@Mock Mailer mailer;', '@Spy Audit audit;', 'Clock clock = spy(new Clock());', '@Test void a() { verify(mailer).send("a"); verify(this.audit).record(); verify(clock).now(); assertNotNull(order.mailer); }']);
  assert.deepEqual(checksOf(fields.tests[0]), ['mockito.verify mock-call: mailer~mock | -', 'mockito.verify mock-call: this.audit~mock | -', 'mockito.verify mock-call: clock~mock | -', 'junit.assertNotNull nullness: order.mailer | - [not]']);
  assert.deepEqual(await checks(['try (MockedStatic<Prices> fixed = mockStatic(Prices.class)) { fixed.verify(() -> Prices.of("a")); fixed.verify(() -> Prices.of("a"), never()); }'], { header: MOCKITO }), [
    'mockito.verify mock-call: fixed~mock | -', 'mockito.verify mock-call: fixed~mock | - [not]',
  ]);
});

test('Playwright and Selenium: elements and counts are marked on the operands', async () => {
  const playwright = `${BARE}import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;\nimport static org.junit.jupiter.api.Assertions.*;\nimport com.microsoft.playwright.*;\n`;
  assert.deepEqual(await checks([
    'Locator rows = page.locator("tr");', 'assertThat(rows).hasCount(3);', 'assertThat(page.getByText("Hi")).not().isVisible();', 'assertThat(page).hasURL("https://www.saucedemo.com/");',
    'assertThat(rows.first());', 'assertNotNull(rows.nth(2));', 'assertTrue(rows.count() >= 0);', 'assertTrue(rows.isVisible());', 'int n = rows.count();', 'assertTrue(n >= 0);',
    'ElementHandle handle = page.querySelector("h1");', 'assertNotNull(handle);', 'Locator.FilterOptions options = new Locator.FilterOptions();', 'assertNotNull(options);', 'assertEquals(2, names.count("a"));',
  ], { header: playwright }), [
    'playwright.hasCount count: rows~locator | 3', 'playwright.isVisible ui-state: page.getByText("Hi")~locator | - [not]', 'playwright.hasURL ui-state: page | -',
    'playwright.null other: rows.first()~locator | - [incomplete]', 'junit.assertNotNull nullness: rows.nth(2)~locator | - [not]', 'junit.assertTrue comparison: rows.count()~count | 0 [>=]',
    'junit.assertTrue truthiness: rows.isVisible() | -', 'junit.assertTrue comparison: n~count | 0 [>=]',
    // `querySelector` gives null when nothing matches, so this is a real check. A class inside `Locator` is no locator, and `count(x)` is no count.
    'junit.assertNotNull nullness: handle | - [not]', 'junit.assertNotNull nullness: options | - [not]', 'junit.assertEquals equality: names.count("a") | 2',
  ]);
  assert.deepEqual(await checks([
    'WebElement title = driver.findElement(By.id("t"));', 'assertNotNull(title);', 'assertNotNull(driver.findElement(By.id("t")));', 'assertTrue(title.isDisplayed());',
    'List<WebElement> rows = driver.findElements(By.tagName("tr"));', 'assertNotNull(rows.get(0));', 'assertFalse(rows.size() < 0);', 'assertEquals(3, rows.size());', 'String text = title.getText();',
    'assertNotNull(text);', 'assertTrue(names.length >= 0);', 'WebElement other;', 'other = driver.findElement(By.id("o"));', 'assertNotNull(other);',
  ], { header: `${JUNIT5}import org.openqa.selenium.*;\n` }), [
    'junit.assertNotNull nullness: title~locator | - [not]', 'junit.assertNotNull nullness: driver.findElement(By.id("t"))~locator | - [not]', 'junit.assertTrue truthiness: title.isDisplayed() | -',
    'junit.assertNotNull nullness: rows.get(0)~locator | - [not]', 'junit.assertFalse comparison: rows.size()~count | 0 [not <]', 'junit.assertEquals equality: rows.size()~count | 3',
    'junit.assertNotNull nullness: text | - [not]', 'junit.assertTrue comparison: names.length~count | 0 [>=]', 'junit.assertNotNull nullness: other~locator | - [not]',
  ]);
  const page = await classWith(['@FindBy(id = "badge") private WebElement badge;', '@Test void a() { assertNotNull(badge); assertEquals("1", badge.getText()); }']);
  assert.deepEqual(checksOf(page.tests[0]), ['junit.assertNotNull nullness: badge~locator | - [not]', 'junit.assertEquals equality: badge.getText() | "1"']);
});

test('an expected exception: assertThrows, the annotation of JUnit 4 and TestNG, and the ExpectedException rule', async () => {
  const thrown = await body(['assertThrows(IllegalStateException.class, () -> cart.pay());', 'assertThrowsExactly(IllegalStateException.class, cart::pay, "empty");', 'assertDoesNotThrow(() -> cart.clear());']);
  assert.deepEqual([thrown.expectsException, checksOf(thrown)], [true, [
    'junit.assertThrows throws: - | IllegalStateException.class', 'junit.assertThrowsExactly throws: - | IllegalStateException.class', 'junit.assertDoesNotThrow throws: - | - [not]',
  ]]);
  assert.equal((await body(['assertDoesNotThrow(() -> cart.clear());'])).expectsException, false);
  const expects = async (members, header) => (await classWith(members, { header })).tests.map((t) => [t.expectsException, t.assertions.length]);
  assert.deepEqual(await expects(['@Test(expected = IllegalStateException.class) public void a() { cart.pay(); }', '@Test(timeout = 100) public void b() { cart.pay(); }'], JUNIT4), [[true, 0], [false, 0]]);
  assert.deepEqual(await expects(['@Test(expectedExceptions = IllegalStateException.class) public void a() { cart.pay(); }', '@Test(description = "pays") public void b() { cart.pay(); }'], TESTNG), [[true, 0], [false, 0]]);
  const rule = await classWith(['@Rule public ExpectedException thrown = ExpectedException.none();', '@Test public void a() { thrown.expect(IllegalStateException.class); thrown.expectMessage("empty"); cart.pay(); }', '@Test public void b() { other.expect(1); }'], { header: JUNIT4 });
  assert.deepEqual(rule.tests.map((t) => [t.expectsException, checksOf(t)]), [[true, ['junit.expect throws: - | IllegalStateException.class', 'junit.expectMessage throws: - | "empty"']], [false, []]]);
});

test('guards: a condition, a loop that may run zero times and a callback, and what always runs', async () => {
  const header = `${JUNIT5}import org.testng.SkipException;\n`;
  assert.deepEqual(await checks([
    'if (a) assertTrue(x); else assertFalse(x);', 'for (int i = 0; i < n; i++) assertTrue(x);', 'while (it.hasNext()) assertNotNull(it.next());', 'for (String s : names) assertNotNull(s);',
    'for (String s : List.of()) assertNotNull(s);', 'for (String s : new String[] {}) assertNotNull(s);', 'String s = ok ? check(assertOk()) : "";', 'boolean b = ok && assertOk(x);',
    'names.forEach(n -> assertNotNull(n));', 'run(new Runnable() { public void run() { assertTrue(x); } });', 'switch (n) { case 1: assertTrue(x); }',
  ], { header }), [
    'junit.assertTrue truthiness: x | - [guarded]', 'junit.assertFalse truthiness: x | - [not guarded]', 'junit.assertTrue truthiness: x | - [guarded]', 'junit.assertNotNull nullness: it.next() | - [not guarded]',
    'junit.assertNotNull nullness: s | - [not guarded]', 'junit.assertNotNull nullness: s | - [not guarded]', 'junit.assertNotNull nullness: s | - [not guarded]', 'assert-method.assertOk other: - | - [guarded]',
    'assert-method.assertOk other: x | - [guarded]', 'junit.assertNotNull nullness: n | - [not guarded]', 'junit.assertTrue truthiness: x | - [guarded]', 'junit.assertTrue truthiness: x | - [guarded]',
  ]);
  assert.deepEqual(await checks([
    // A loop over values that are written out, a do-while, the left side of `||`, and the callbacks of calls that always run them.
    'for (String s : List.of("a")) assertNotNull(s);', 'for (String s : new String[] {"a"}) assertNotNull(s);', 'do { assertTrue(x); } while (more());', 'boolean c = assertOk(x) || ok;',
    'assertAll(() -> assertTrue(x));', 'assertTimeout(limit, () -> { assertTrue(x); });', 'assertThat(cart).satisfies(c -> assertTrue(c.open()));', 'await().untilAsserted(() -> assertTrue(x));',
  ], { header }), [
    'junit.assertNotNull nullness: s | - [not]', 'junit.assertNotNull nullness: s | - [not]', 'junit.assertTrue truthiness: x | -', 'assert-method.assertOk other: x | -', 'junit.assertTrue truthiness: x | -',
    'junit.assertTimeout other: - | -', 'junit.assertTrue truthiness: x | -', 'assertj.satisfies other: cart | -', 'junit.assertTrue truthiness: c.open() | -', 'junit.assertTrue truthiness: x | -',
  ]);
  assert.deepEqual(await checks([
    // `if (!ok) fail()` is a check in itself, and so is a throw in the flow of the test. In a loop it may never run.
    'if (!ok) fail("no");', 'if (!ok) { throw new AssertionError("no"); }', 'for (String s : names) fail(s);',
    // A class declared in the body, a throw inside a callback and a thrown skip are not checks of this test.
    'class Local { void m() { assertTrue(x); } }', 'names.forEach(n -> { throw new IllegalStateException(n); });', 'assertThrows(IllegalStateException.class, () -> { throw new IllegalStateException(); });',
    'throw new SkipException("later");',
  ], { header }), ['junit.fail fail-call: - | -', 'throw.throw fail-call: - | new AssertionError("no")', 'junit.fail fail-call: - | - [guarded]', 'junit.assertThrows throws: - | IllegalStateException.class']);
  // The lambda of a dynamic test is a test of its own, whatever makes it.
  const factory = await classWith(['@TestFactory Stream<DynamicTest> a() { return names.stream().map(n -> DynamicTest.dynamicTest(n, () -> { if (n.isEmpty()) return; assertNotNull(find(n)); })); }']);
  assert.deepEqual(checksOf(factory.tests[0]), ['junit.assertNotNull nullness: find(n) | - [not]']);
});

test('reachability: an assertion after an unconditional return, throw, break, continue or fail is never reached', async () => {
  assert.deepEqual(await checks(['assertTrue(a);', 'if (x) { return; }', 'assertTrue(b);', 'return;', 'assertTrue(c);']), [
    'junit.assertTrue truthiness: a | -', 'junit.assertTrue truthiness: b | -', 'junit.assertTrue truthiness: c | - [unreachable]',
  ]);
  assert.deepEqual(await checks(['fail("not written yet");', 'assertTrue(c);']), ['junit.fail fail-call: - | -', 'junit.assertTrue truthiness: c | - [unreachable]']);
  assert.deepEqual(await checks([
    'for (String s : List.of("a")) { continue; assertTrue(s); }', 'while (true) { break; assertTrue(d); }', 'if (x) { throw new IllegalStateException(); }', 'assertTrue(e);',
    'throw new IllegalStateException("end");', 'assertTrue(f);',
  ]), [
    'junit.assertTrue truthiness: s | - [unreachable]', 'junit.assertTrue truthiness: d | - [guarded unreachable]', 'throw.throw fail-call: - | new IllegalStateException()', 'junit.assertTrue truthiness: e | -',
    'throw.throw fail-call: - | new IllegalStateException("end")', 'junit.assertTrue truthiness: f | - [unreachable]',
  ]);
});

test('try blocks: only a catch that names an Error or a Throwable catches a failed assertion', async () => {
  const t = await body([
    'try { assertTrue(a); } catch (Throwable t) { }', 'try { assertTrue(a); } catch (Exception e) { }', 'try { assertTrue(a); } catch (java.lang.AssertionError e) { log(e); }',
    'try { assertTrue(a); } catch (IOException | Error e) { throw e; }', 'try { assertTrue(a); } catch (AssertionError e) { fail("x"); }', 'try { assertTrue(a); } catch (AssertionError e) { assertNotNull(e); }',
    'try { assertTrue(a); } catch (IllegalStateException e) { throw e; } catch (AssertionError e) { }', 'try { assertTrue(a); } catch (AssertionError e) { } catch (Throwable t) { throw t; }',
    'try { run(); } catch (Throwable t) { }', 'try { soft.assertThat(a).isTrue(); } catch (Throwable t) { }', 'try { assertTrue(a); } finally { close(); }', 'try (Session s = open()) { assertTrue(a); }',
    'try (Session s = open()) { assertTrue(a); } catch (Error e) { }',
  ]);
  assert.deepEqual(blocksOf(t), [
    [1, 'Throwable', true, ''], [1, 'Exception', false, ''], [1, 'java.lang.AssertionError', true, ''], [1, 'IOException Error', true, 'rethrows'], [1, 'AssertionError', true, 'fails'],
    [1, 'AssertionError', true, 'asserts'],
    // The first clause that catches the failure decides what happens to it.
    [1, 'IllegalStateException AssertionError', true, ''], [1, 'AssertionError Throwable', true, ''],
    // Nothing to hide: no assertion inside, or a soft one that fails later.
    [0, 'Throwable', true, ''], [0, 'Throwable', true, ''],
    // `finally` and resources alone are no block. With a catch they are.
    [1, 'Error', true, ''],
  ]);
  assert.deepEqual([t.tryBlocks[0].span.startLine, t.tryBlocks[0].kind, t.assertions.filter((a) => a.guarded).map((a) => a.matcher)], [6, 'try-catch', ['fail', 'assertNotNull']]);
  // The usual way to expect an error by hand: the fail is inside the try, the check of the message in the handler.
  const byHand = await body(['try {', '    cart.pay();', '    fail("should throw");', '} catch (IllegalStateException e) {', '    assertEquals("empty", e.getMessage());', '}']);
  assert.deepEqual([blocksOf(byHand), checksOf(byHand)], [[[1, 'IllegalStateException', false, 'asserts']], ['junit.fail fail-call: - | -', 'junit.assertEquals equality: e.getMessage() | "empty" [guarded]']]);
});

test('helpers: a method of the class, of the project or of the config that holds an assertion counts as one', async () => {
  const members = [
    '@Test void a() { checkTotal(cart); printCart(cart); }', '@Test void b() { cart.items().forEach(this::checkItem); }', '@Test void c() { assertCart(cart); }', '@Test void d() { Checks.cartHasItems(cart, 2); }',
    '@Test void e() { expectOrder(order); }', '@BeforeEach void open() { checkTotal(cart); }',
    'private void checkTotal(Cart cart) { assertEquals(0, cart.total()); }', 'private void checkItem(Item item) { assertNotNull(item); }', 'private void printCart(Cart cart) { System.out.println(cart); }',
    'private void viaAnother(Cart cart) { checkTotal(cart); }', 'private void guard(Cart cart) { if (cart == null) throw new IllegalStateException(); }',
    'private void strict(Cart cart) { if (cart == null) throw new AssertionError("no cart"); }',
  ];
  const found = async (options) => {
    const model = await classWith(members, options);
    return [...model.tests.map((t) => checksOf(t)), checksOf(model.suites[0].hooks[0])];
  };
  assert.deepEqual(await found(), [
    ['helper.null other: - | - [via checkTotal]'],
    // A helper that is handed over is called by someone else, maybe never.
    ['helper.null other: - | - [guarded via checkItem]'],
    // A method that is named like an assertion is taken as one.
    ['assert-method.assertCart other: cart | -'], [], [], ['helper.null other: - | - [via checkTotal]'],
  ]);
  const helperIndex = createHelperIndex([{ name: 'cartHasItems', owner: 'Checks', file: `${TESTS}/support/Checks.java`, span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 } }]);
  assert.deepEqual((await found({ helperIndex }))[3], ['helper.null other: - | - [via cartHasItems]']);
  assert.deepEqual((await found({ config: { assertionHelpers: ['expectOrder'] } }))[4], ['helper.null other: - | - [via expectOrder]']);

  const source = `${JUNIT5}\nclass ATest {\n${members.map((line) => `    ${line}`).join('\n')}\n    Runnable later = new Runnable() { public void run() { assertTrue(ok); } };\n}\n`;
  const parsed = await javaAdapter.parse({ path: `${TESTS}/ATest.java`, absPath: '/x', language: 'java', project: null, text: source }, adapterContext());
  // One level deep: a method that only calls a helper, or only throws an error of its own, is not one. Tests and hooks are not helpers.
  // The last entry stands for the class itself: what it hands down to a class that extends it (java-body.test.mjs).
  assert.deepEqual(javaAdapter.collectHelpers(parsed).map((helper) => [helper.name, helper.owner, helper.file, helper.span.startLine]), [
    ['checkTotal', 'ATest', `${TESTS}/ATest.java`, 11], ['checkItem', 'ATest', `${TESTS}/ATest.java`, 12], ['strict', 'ATest', `${TESTS}/ATest.java`, 16], ['extends ATest', 'ATest', `${TESTS}/ATest.java`, 4],
  ]);
  parsed.tree.delete();
});

test('support files: the project classes a file imports, and the classes of its own package that it names', async () => {
  const guesses = async (relPath, text) => {
    const parsed = await javaAdapter.parse({ path: relPath, absPath: '/x', language: 'java', project: null, text }, adapterContext());
    const result = javaAdapter.supportFiles(parsed);
    parsed.tree?.delete();
    return result;
  };
  const text = [
    'package shop.cart;', 'import static shop.support.Checks.cartHasItems;', 'import static shop.support.Other.*;', 'import shop.pages.LoginPage;', 'import shop.pages.LoginPage.Banner;', 'import shop.util.*;',
    'import java.util.List;', 'import javax.inject.Inject;', 'import org.junit.jupiter.api.Test;', 'import org.assertj.core.api.SoftAssertions;',
    'class CartTest extends BaseTest {', '    @Test void a() { List<Item> items = new Cart().items(); Totals.check(items); helper.run(); }', '}', '',
  ].join('\n');
  assert.deepEqual(await guesses('app/src/test/java/shop/cart/CartTest.java', text), [
    'app/src/test/java/shop/support/Checks.java', 'app/src/test/java/shop/support/Other.java', 'app/src/test/java/shop/pages/LoginPage.java',
    'app/src/test/java/shop/cart/BaseTest.java', 'app/src/test/java/shop/cart/Item.java', 'app/src/test/java/shop/cart/Cart.java', 'app/src/test/java/shop/cart/Totals.java',
  ]);
  // A file that is not in the folder of its package: the imports cannot be placed, the classes beside it can.
  assert.deepEqual(await guesses('tests/CartTest.java', text), ['tests/BaseTest.java', 'tests/Item.java', 'tests/Cart.java', 'tests/Totals.java']);
  assert.deepEqual(await guesses('CartTest.java', 'import shop.Checks;\nclass CartTest { }\n'), []);
  const unparsed = { file: { path: 'ATest.java', absPath: '/x', language: 'java', project: null, text: '' }, tree: null, tokens: null, parseStatus: 'failed' };
  assert.deepEqual([javaAdapter.supportFiles(unparsed), javaAdapter.collectHelpers(unparsed)], [[], []]);
});

test('the rules read what a Java body checks', async () => {
  const review = async (framework) => {
    const { report } = await runReview({ root: fixtureRoot('adapters', 'java', framework), config: resolveConfig({}).config, git: false, rules: builtinRules });
    return report.findings.filter((finding) => /^QCR-[AEP]/.test(finding.ruleId)).map((finding) => `${finding.location.file.replace(`${TESTS}/`, '')}:${finding.location.startLine} ${finding.ruleId}`);
  };
  assert.deepEqual(await review('junit5'), [
    // `isGreaterThanOrEqualTo(0)` on a size, and four chains with no check.
    'AssertJTest.java:64 QCR-A003', 'AssertJTest.java:120 QCR-A003', 'AssertJTest.java:121 QCR-A003', 'AssertJTest.java:122 QCR-A003', 'AssertJTest.java:123 QCR-A003',
    // `assertTrue(cart.size() >= 0)`, every check under a condition, and two checks after a return and after a fail.
    'AssertionsTest.java:55 QCR-A003', 'AssertionsTest.java:96 QCR-A004', 'AssertionsTest.java:143 QCR-A003', 'AssertionsTest.java:149 QCR-A003',
    'HamcrestTest.java:83 QCR-A003',
    // A helper that is only handed to forEach, and a test that only prints.
    'HelpersTest.java:31 QCR-A004', 'HelpersTest.java:39 QCR-A001',
    // `verify(mailer);` names no call.
    'MailerTest.java:63 QCR-A003',
    // Waiting for a condition is not an assertion, and neither is printing an answer.
    'OrderServiceTest.java:31 QCR-A001', 'OrdersControllerTest.java:43 QCR-A001',
    // A StepVerifier that is never run.
    'OrdersControllerTest.java:55 QCR-A003',
    'SnapshotTest.java:14 QCR-P001', 'SnapshotTest.java:19 QCR-P001', 'SnapshotTest.java:28 QCR-P001',
    // Soft assertions that are never reported.
    'SoftAssertionsTest.java:31 QCR-A003', 'SoftAssertionsTest.java:32 QCR-A003', 'SoftAssertionsTest.java:38 QCR-A003',
    // A catch of Throwable, AssertionError, Error and the failure classes of JUnit. `catch (Exception e)` is not one of them.
    'TryCatchTest.java:16 QCR-E001', 'TryCatchTest.java:25 QCR-E001', 'TryCatchTest.java:30 QCR-E001', 'TryCatchTest.java:35 QCR-E001', 'TryCatchTest.java:40 QCR-E001',
  ]);
  assert.deepEqual(await review('junit4'), ['LegacyAssertTest.java:58 QCR-E001']);
  assert.deepEqual(await review('testng'), ['AssertOrderTest.java:60 QCR-A003', 'AssertOrderTest.java:61 QCR-A003']);
  // SPEC.md Section 18, Milestone 14: `assertNotNull(driver.findElement(...))` is QCR-A003.
  assert.deepEqual(await review('selenium'), [
    'InventoryIT.java:40 QCR-A003', 'InventoryIT.java:41 QCR-A003', 'InventoryIT.java:42 QCR-A003', 'InventoryIT.java:43 QCR-A003', 'InventoryIT.java:44 QCR-A003',
    'InventoryIT.java:50 QCR-A003', 'InventoryIT.java:51 QCR-A003', 'InventoryIT.java:52 QCR-A003',
  ]);
  assert.deepEqual(await review('playwright-java'), ['InventoryTest.java:62 QCR-A003', 'InventoryTest.java:63 QCR-A003', 'InventoryTest.java:64 QCR-A003', 'InventoryTest.java:75 QCR-A003']);
  // SPEC.md Section 18, Milestone 14: REST Assured `.then().statusCode(...)` counts as an assertion. Only the test that logs the answer has none.
  assert.deepEqual(await review('restassured'), ['ProductsApiTest.java:57 QCR-A001']);
});
