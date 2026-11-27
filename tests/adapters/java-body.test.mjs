// The Java adapter, what a body does (SPEC.md Sections 8.1 and 9.3): waits, selectors, steps,
// data operations, mocks and the class under test, resources and their release, the hooks a
// class inherits from its base class, the lexical fallback, and the rules that read all this.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { builtinRules, createHelperIndex, createTreeSitterService, javaAdapter, readAsset, resolveConfig, runReview, toLf } from '../../dist/index.js';
import { adapterContext, fixtureRoot, normalizeText } from '../helpers/adapter-suite.mjs';
import { schemaErrors } from '../helpers/schema.mjs';

const TESTS = 'src/test/java/shop';
const JUNIT5 = 'import org.junit.jupiter.api.*;\nimport static org.junit.jupiter.api.Assertions.*;\n';
const MOCKITO = `${JUNIT5}import static org.mockito.Mockito.*;\nimport static org.mockito.BDDMockito.*;\nimport org.mockito.*;\nimport shop.mail.Mailer;\n`;
const RESTASSURED = `${JUNIT5}import static io.restassured.RestAssured.*;\n`;
const WIREMOCK = `${JUNIT5}import static com.github.tomakehurst.wiremock.client.WireMock.*;\n`;

const classWith = (members, { header = JUNIT5, name = 'ATest', ...options } = {}) =>
  normalizeText(javaAdapter, `${TESTS}/${name}.java`, `${header}\nclass ${name} {\n${members.map((line) => `    ${line}`).join('\n')}\n}\n`, options);
/** The one test of a class whose body is these statements. */
const body = async (statements, options) => (await classWith(['@Test void a() {', ...statements.map((line) => `    ${line}`), '}'], options)).tests[0];
const waitsOf = (t) => t.waits.map((w) => `${w.kind} ${w.ms}`);
const selectorsOf = (t) => t.selectors.map((s) => `${s.api} ${s.strategy} ${s.value}${s.positional ? ` pick ${s.positional.kind} ${s.positional.index}` : ''}`);
const mocksOf = (list) => list.map((m) => `${m.kind} ${m.target} subject=${m.targetsSubject}${m.passthrough ? ' passthrough' : ''}${m.stubbedReturn ? ' stubbed' : ''}${m.fulfillsAllNetwork ? ' all-network' : ''}`);
const resourcesOf = (list) => list.map((r) => `${r.kind} ${r.acquiredIn} ${r.autoManaged ? 'auto' : r.released ? 'released' : 'leak'}: ${r.text}`);
/** Data operations, by the statement of the body they are in, counted from 1. */
const dataOf = (t) => t.data.map((d) => `${d.span.startLine - t.span.startLine}: ${d.op} ${d.via}`);

test('fixed sleeps in milliseconds, whatever unit they are written in', async () => {
  assert.deepEqual(waitsOf(await body([
    'Thread.sleep(1500);', 'Thread.sleep(2_000L);', 'java.lang.Thread.sleep(100);', 'TimeUnit.SECONDS.sleep(2);', 'SECONDS.sleep(3);', 'Thread.sleep(Duration.ofMillis(250));',
    'Uninterruptibles.sleepUninterruptibly(3, TimeUnit.SECONDS);', 'Uninterruptibles.sleepUninterruptibly(Duration.ofMinutes(1));', 'page.waitForTimeout(300);',
    // An amount that is not written out is still a sleep. A method named `sleep` on any other object is not, and neither is a `sleep` that is not imported.
    'Thread.sleep(delay);', 'Thread.sleep(Duration.ofSeconds(n));', 'cart.sleep(5);', 'sleep(100);',
  ])), ['1500', '2000', '100', '2000', '3000', '250', '3000', '60000', '300', 'null', 'null'].map((ms) => `fixed-sleep ${ms}`));
  assert.deepEqual(waitsOf(await body(['sleep(100);', 'Selenide.sleep(200);'], { header: `${JUNIT5}import static com.codeborne.selenide.Selenide.sleep;\n` })), ['fixed-sleep 100', 'fixed-sleep 200']);
});

test('an implicit wait setting and waits for a condition are told from sleeps', async () => {
  assert.deepEqual(waitsOf(await body([
    'driver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));', 'driver.manage().timeouts().implicitlyWait(10, TimeUnit.SECONDS);', 'driver.manage().timeouts().implicitlyWait(timeout);',
    'new WebDriverWait(driver, Duration.ofSeconds(5)).until(d -> ok());', 'WebDriverWait wait = new WebDriverWait(driver, limit);', 'wait.until(visible(title));', 'Wait<WebDriver> patient = new FluentWait<>(driver);',
    'patient.until(d -> ok());', 'explicitWait.until(d -> ok());', 'await().atMost(5, SECONDS).until(() -> saved());', 'Awaitility.await().untilAsserted(() -> assertTrue(saved()));', 'waitAtMost(limit).untilTrue(done);',
    'page.waitForSelector("#done");', 'page.waitForURL("**/cart");', 'locator.waitFor();',
    // `until` on something that is no wait.
    'list.until(x);', 'queue.until(1);',
  ])), ['implicit-wait-config 10000', 'implicit-wait-config 10000', 'implicit-wait-config null', ...Array(10).fill('condition null')]);
});

test('selectors: By, Playwright calls, page actions with a selector, Selenide, and picks by position', async () => {
  const t = await body([
    'driver.findElement(By.id("user-name")).sendKeys("a");', 'driver.findElement(By.xpath("//div[2]/input")).click();', 'driver.findElement(org.openqa.selenium.By.cssSelector("[data-test=\'login\']"));',
    'driver.findElement(By.cssSelector("#" + id));', 'driver.findElement(By.className(name));', 'driver.findElements(By.tagName("li")).get(2).click();', 'driver.findElements(By.name("row")).get(0);',
    'driver.findElements(By.linkText("More")).get(index);', 'By locator = By.partialLinkText("Mo");', 'page.locator("li.item").nth(3).click();', 'page.getByRole(AriaRole.BUTTON).first().click();',
    'page.getByTestId("buy").last();', 'page.getByLabel("Name").fill("Ada");', 'page.click("#buy");', 'page.fill("#name", "Ada");', 'frame.locator("css=button");', '$("#sel").click();', '$$(".row").get(1);',
    '$x("//a");', 'Selenide.$$x("//li").first();',
    // No selector: a value typed into a locator, one argument too few, a method of the same name on some other object.
    'locator.fill("Ada");', 'page.fill(value);', 'checkout.click("#buy");', 'cart.$("x");',
  ]);
  assert.deepEqual(selectorsOf(t), [
    'By.id id user-name', 'By.xpath xpath //div[2]/input', "By.cssSelector test-id [data-test='login']",
    // A selector that is put together or held in a variable has no value. Its strategy is still known when the method names it.
    'By.cssSelector other null', 'By.className class null', 'By.tagName css li pick nth 2', 'By.name name row pick nth 0', 'By.linkText link-text More', 'By.partialLinkText link-text Mo',
    'locator css li.item pick nth 3', 'getByRole role null pick first null', 'getByTestId test-id buy pick last null', 'getByLabel label Name', 'click id #buy', 'fill id #name', 'locator css css=button',
    '$ id #sel', '$$ class .row pick nth 1', '$x xpath //a', '$$x xpath //li pick first null',
  ]);
  assert.deepEqual([t.selectors[0].text, t.selectors[0].span.startLine, t.selectors[0].span.startColumn], ['By.id("user-name")', 6, 28]);
  // Steps: an action on an element or a page. `page.fill(value)` is one, with no selector written in it.
  assert.deepEqual(t.steps.map((step) => `${step.kind} ${step.span.startLine - t.span.startLine}`), ['action 1', 'action 2', 'action 6', 'action 10', 'action 11', 'action 13', 'action 14', 'action 15', 'action 17', 'action 22']);
  // A page and a driver are known by their declared type too, whatever their name.
  const typed = await classWith(['Page shop;', 'WebDriver browser;', '@Test void a() { shop.click("#buy"); shop.navigate("https://www.saucedemo.com"); browser.get("https://www.saucedemo.com"); browser.navigate().to("/cart"); driver.get("/x"); map.get("k"); }']);
  assert.deepEqual([selectorsOf(typed.tests[0]), typed.tests[0].steps.map((step) => `${step.kind} ${step.text}`)], [['click id #buy'], [
    'action shop.click("#buy")', 'navigate shop.navigate("https://www.saucedemo.com")', 'navigate browser.get("https://www.saucedemo.com")', 'navigate browser.navigate().to("/cart")', 'navigate driver.get("/x")',
  ]]);
  assert.deepEqual(selectorsOf(await body(['page.locator("[data-automation=buy]");'], { config: { testIdAttribute: 'data-automation' } })), ['locator test-id [data-automation=buy]']);
});

test('a @FindBy field is a selector of the first test or hook that uses the field', async () => {
  const model = await classWith([
    '@FindBy(xpath = "//div[3]/span") WebElement badge;', '@FindBy(how = How.CSS, using = ".title") WebElement title;', '@FindBy(id = "unused") WebElement unused;', '@FindBy WebElement byName;',
    '@BeforeEach void open() { title.click(); }', '@Test void a() { badge.click(); title.click(); byName.click(); driver.findElement(By.id("x")); }', '@Test void b() { badge.click(); }',
  ]);
  assert.deepEqual([selectorsOf(model.suites[0].hooks[0]), selectorsOf(model.tests[0]), selectorsOf(model.tests[1])], [['@FindBy(CSS) class .title'], ['@FindBy(xpath) xpath //div[3]/span', 'By.id id x'], []]);
  assert.deepEqual([model.tests[0].selectors[0].text, model.tests[0].selectors[0].span.startLine], ['@FindBy(xpath = "//div[3]/span")', 5]);
  // The fields are elements: an action on one is a step, and `assertNotNull` on one says nothing.
  assert.deepEqual(model.tests[0].steps.map((step) => step.text), ['badge.click()', 'title.click()', 'byName.click()']);
});

test('requests and data: REST Assured, other HTTP clients by their name, SQL and stores of records', async () => {
  assert.deepEqual(dataOf(await body([
    'given().body(order).post("/orders").then().statusCode(201);', 'given().when().put("/orders/7");', 'with().patch("/orders/7");', 'RestAssured.given().delete("/orders/7");', 'get("/orders");',
    // What is read from the answer after `then()` is no second request.
    'when().get("/orders").then().extract().jsonPath().get("items");', 'response.jsonPath().get("id");', 'given().header("a", "b").head("/orders");', 'given().post();',
  ], { header: RESTASSURED })), ['1: create http', '2: update http', '3: update http', '4: delete http', '5: read http', '6: read http', '8: read http', '9: create http']);
  // Without the import, and with a `get` or a `post` that comes from somewhere else, nothing is a request.
  assert.deepEqual(dataOf(await body(['given().post("/orders");', 'post("/orders");'])), []);
  const others = `${RESTASSURED}import static com.github.tomakehurst.wiremock.client.WireMock.post;\nimport static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;\n`;
  assert.deepEqual(dataOf(await body(['get("/orders");', 'post(urlEqualTo("/pay"));'], { header: others })), []);
  const clients = await body([
    'restTemplate.postForEntity(url, order, Order.class);', 'rest.getForObject(url, Order.class);', 'template.postForLocation(url, order);', 'client.post("/orders", order);', 'apiClient.delete("/orders/7");',
    'this.http.put("/orders/7", order);', 'webTestClient.patch();', 'cart.post("/x");', 'map.put("k", "v");', 'postForObject(url);',
  ]);
  assert.deepEqual([dataOf(clients), clients.steps.map((step) => step.kind)], [['1: create http', '2: read http', '3: create http', '4: create http', '5: delete http', '6: update http', '7: update http'], Array(7).fill('request')]);
  assert.deepEqual(dataOf(await body([
    'jdbc.update("INSERT INTO orders VALUES (7)");', 'jdbc.update("  delete from orders");', 'statement.executeQuery("SELECT 1");', 'jdbc.update(sql);', 'jdbc.execute("CREATE TABLE t (id INT)");',
    'orderRepository.save(order);', 'orderRepository.saveAll(orders);', 'orders.save(order);', 'cartRepo.deleteById(7);', 'userDao.removeAll();', 'orderRepository.findAll();', 'ORDER_REPOSITORY.insert(order);',
  ])), ['1: create db', '2: delete db', '3: read db', '6: create db', '7: create db', '9: delete db', '10: delete db', '12: create db']);
});

test('mocks: fields and calls of Mockito, spies that keep the real behavior, and the replies they are given', async () => {
  const model = await classWith([
    '@Mock Mailer mailer;', '@Mock Cart cart;', '@Spy Audit audit;', '@Spy Ledger ledger;', '@MockBean Clock clock;', '@org.mockito.Mock Stock stock;', '@Autowired Prices prices;', 'Sms sms = mock(Sms.class);',
    '@BeforeEach void stubs() { when(mailer.send(any())).thenReturn(true); }',
    '@Test void a() { when(cart.total()).thenReturn(42); doReturn(1).when(audit).count(); given(sms.send("a")).willReturn(true); willThrow(new IllegalStateException()).given(stock).take("fig"); assertEquals(42, cart.total()); }',
    '@Test void b() { Cart local = mock(Cart.class); Cart real = spy(new Cart()); Cart wrapped = Mockito.spy(cart); Prices loose = mock(Prices.class, CALLS_REAL_METHODS); Object any = mock(type); when(unknown.size()).thenReturn(1); }',
    '@Test void c() { given().when().get("/x"); given(spec).when().get("/y"); when(total).thenReturn(1); when(real.size()).thenCallRealMethod(); doCallRealMethod().when(cart).clear(); }',
  ], { header: MOCKITO, name: 'CartTest' });
  assert.deepEqual(model.subject, { module: 'Cart', via: 'filename' });
  assert.deepEqual(mocksOf(model.fileMocks), [
    // A mocked class goes by its simple name. A reply given in any body is noted on the mock: `audit` is a spy no more, `ledger` still is.
    'class Mailer subject=false stubbed', 'class Cart subject=true stubbed', 'class Audit subject=false stubbed', 'class Ledger subject=false passthrough', 'class Clock subject=false', 'class Stock subject=false stubbed',
    'class Sms subject=false stubbed',
    // A reply given in a hook holds for every test.
    'function mailer.send subject=false stubbed',
  ]);
  assert.deepEqual(model.tests.map((t) => mocksOf(t.mocks)), [
    // Each reply is a mock of one method, named the way the test calls it, so that a rule can see the test call it and check the answer.
    ['function cart.total subject=true stubbed', 'function audit.count subject=false stubbed', 'function sms.send subject=false stubbed', 'function stock.take subject=false stubbed'],
    // With no class named, the variable is the name. A reply on something that is not known to be a mock says nothing about the class under test.
    ['class Cart subject=true', 'class Cart subject=true passthrough', 'class Cart subject=true passthrough', 'class Prices subject=false passthrough', 'class any subject=null', 'function unknown.size subject=null stubbed'],
    // The `given()` and `when()` of REST Assured, a `when` with no call in it and a reply that runs the real method are no replies.
    [],
  ]);
  assert.deepEqual([model.fileMocks[0].text, model.fileMocks[0].span.startLine, model.tests[0].mocks[0].text], ['@Mock Mailer mailer;', 9, 'when(cart.total()).thenReturn(42)']);
  // With no class under test known, nothing is said about it.
  assert.deepEqual(mocksOf((await classWith(['@Mock Mailer mailer;'], { header: MOCKITO })).fileMocks), ['class Mailer subject=null']);
});

test('the class under test: the subject map, the @InjectMocks field, or the name of the file when the file names that class', async () => {
  const subject = async (name, members, options) => (await classWith(members, { header: MOCKITO, name, ...options })).subject;
  const byName = { module: 'Cart', via: 'filename' };
  assert.deepEqual([await subject('CartTest', ['Cart cart;']), await subject('CartTests', ['Cart cart;']), await subject('CartIT', ['Cart cart;']), await subject('TestCart', ['Cart cart;']), await subject('CartTest', ['shop.Cart cart;'])], Array(5).fill(byName));
  // The name of the file alone proves nothing, and a class of a test library is not what a test is about.
  assert.deepEqual([await subject('CartTest', ['Basket cart;']), await subject('Test', ['Cart cart;']), await subject('Tests', [])], [null, null, null]);
  assert.equal(await subject('SoftAssertionsTest', ['SoftAssertions soft;'], { header: `${JUNIT5}import org.assertj.core.api.SoftAssertions;\n` }), null);
  // A class that the file imports is named in full.
  assert.deepEqual(await subject('MailerTest', ['Mailer mailer;']), { module: 'shop.mail.Mailer', via: 'filename' });
  assert.deepEqual(await subject('CartTest', ['@InjectMocks Checkout checkout;', 'Cart cart;']), { module: 'Checkout', via: 'class-under-test' });
  assert.deepEqual(await subject('CartTest', ['@InjectMocks Mailer mailer;']), { module: 'shop.mail.Mailer', via: 'class-under-test' });
  const mapped = { config: { rules: { 'QCR-M001': { subjectMap: { '**/CartTest.java': 'shop.basket.Basket', '**/Other.java': 'x.Y' } } } } };
  assert.deepEqual([await subject('CartTest', ['@InjectMocks Checkout checkout;'], mapped), await subject('OrderTest', ['Order order;'], mapped)], [{ module: 'shop.basket.Basket', via: 'subjectMap' }, { module: 'Order', via: 'filename' }]);
  // The mapped class is the one a mock is compared with.
  assert.deepEqual(mocksOf((await classWith(['@Mock Basket basket;', '@Mock Cart cart;'], { header: MOCKITO, name: 'CartTest', ...mapped })).fileMocks), ['class Basket subject=true', 'class Cart subject=false']);
});

test('network fakes: WireMock stubs and Playwright routes, and whether they answer every request', async () => {
  assert.deepEqual(mocksOf((await body([
    'stubFor(get(urlEqualTo("/orders")).willReturn(okJson("[]")));', 'stubFor(any(anyUrl()).willReturn(ok()));', 'stubFor(any(urlMatching(".*")).willReturn(ok()));', 'stubFor(post(urlPathMatching(pattern)));',
    'wireMock.stubFor(get("/plain").willReturn(ok()));', 'stubFor(mapping);', 'page.route("**/*", route -> route.fulfill(options));', 'page.route("**/api/**", route -> route.resume());',
    'context.route(Pattern.compile("x"), route -> { log(route); });', 'browserContext.route("*", route -> { route.fulfill(o); });', 'router.route("/a", handler);',
  ], { header: WIREMOCK })).mocks), [
    'network /orders subject=false stubbed', 'network anyUrl() subject=false stubbed all-network', 'network .* subject=false stubbed all-network', 'network urlPathMatching(pattern) subject=false',
    'network /plain subject=false stubbed', 'network **/* subject=false stubbed all-network',
    // A route that lets the call through fakes nothing.
    'network **/api/** subject=false passthrough', 'network Pattern.compile("x") subject=false', 'network * subject=false stubbed all-network',
  ]);
  // WireMock `verify` checks that a request was made: an assertion on a mock.
  const checked = await body(['verify(postRequestedFor(urlEqualTo("/pay")));', 'verify(2, getRequestedFor(urlEqualTo("/orders")).withHeader("a", equalTo("b")));', 'wireMock.verify(exactly(1), postRequestedFor(anyUrl()));'], { header: WIREMOCK });
  assert.deepEqual(checked.assertions.map((a) => [a.library, a.matcher, a.kind, a.complete]), Array(3).fill(['wiremock', 'verify', 'mock-call', true]));
});

test('resources: a release in the same body, in an after hook of the class or around it, or by a try-with-resources', async () => {
  const model = await classWith([
    'private WebDriver driver;', 'private WebDriver field = new ChromeDriver();', 'private static WebDriver shared;', 'private WireMockServer server = new WireMockServer();',
    '@BeforeAll static void startAll() { shared = new ChromeDriver(); System.setProperty("shop.mode", "test"); }', '@AfterAll static void stopAll() { shared.quit(); System.clearProperty("shop.mode"); }',
    '@BeforeEach void start() { driver = new FirefoxDriver(); }', '@AfterEach void stop() { this.driver.quit(); System.setProperty("shop.zone", "UTC"); }',
    '@Test void a() { WebDriver own = new ChromeDriver(); WebDriver closed = new EdgeDriver(); closed.quit(); new SafariDriver().get("x"); WebDriver managed = WebDriverManager.chromedriver().create(); WebDriverManager.chromedriver().setup(); }',
    '@Test void b() { System.setProperty("shop.zone", "CET"); System.setProperty("shop.lang", "en"); System.setProperty("shop.lang", old); System.setProperty("shop.cur", "EUR"); System.clearProperty("shop.cur"); System.setProperty(key, "x"); System.setProperty("shop.leak", "1"); }',
    '@Test void c() { MockedStatic<Prices> fixed = mockStatic(Prices.class); MockedStatic<Clock> closed = mockStatic(Clock.class); closed.close(); try (MockedStatic<Stock> scoped = mockStatic(Stock.class); MockedConstruction<Cart> made = mockConstruction(Cart.class)) { run(); } }',
    '@Test void d() { try (Playwright pw = Playwright.create(); Browser browser = pw.chromium().launch()) { Page page = browser.newPage(); } Playwright playwright = Playwright.create(); Browser b = playwright.firefox().launch(); Page p = b.newContext().newPage(); playwright.close(); Browser lost = Playwright.create().webkit().launch(); }',
    '@Test void e(BrowserContext context, Browser browser) { Page page = context.newPage(); BrowserContext other = browser.newContext(); Page orphan = other.newPage(); }',
    '@Test void f() throws Exception { Connection open = DriverManager.getConnection(url); try (Connection c = DriverManager.getConnection(url)) { c.commit(); } MockWebServer web = new MockWebServer(); web.shutdown(); server.stop(); }',
    '@Nested class Inner { WebDriver inner; @BeforeEach void up() { inner = new ChromeDriver(); } @AfterEach void down() { inner.quit(); } @Test void g() { WebDriver local = new ChromeDriver(); driver = new ChromeDriver(); } }',
  ], { header: MOCKITO });
  assert.deepEqual(resourcesOf(model.fileResources), [
    // A field with no after hook that releases it. `server.stop()` in one test is no cleanup.
    'driver file leak: new ChromeDriver()', 'server file leak: new WireMockServer()',
    'driver hook released: new ChromeDriver()', 'env hook released: System.setProperty("shop.mode", "test")', 'driver hook released: new FirefoxDriver()', 'driver hook released: new ChromeDriver()',
  ]);
  assert.deepEqual(model.tests.map((t) => resourcesOf(t.resources)), [
    ['driver test leak: new ChromeDriver()', 'driver test released: new EdgeDriver()', 'driver test leak: new SafariDriver()', 'driver test leak: WebDriverManager.chromedriver().create()'],
    // A property is put back by a second write, a clear, or any write in an after hook. A key that is not written out is not followed.
    ['env test released: System.setProperty("shop.zone", "CET")', 'env test released: System.setProperty("shop.lang", "en")', 'env test released: System.setProperty("shop.cur", "EUR")', 'env test leak: System.setProperty("shop.leak", "1")'],
    ['patch test leak: mockStatic(Prices.class)', 'patch test released: mockStatic(Clock.class)', 'patch test released: mockStatic(Stock.class)', 'patch test released: mockConstruction(Cart.class)'],
    // Closing Playwright closes the browser made from it, and with the browser its contexts and pages.
    ['browser test released: Playwright.create()', 'browser test released: pw.chromium().launch()', 'page test released: browser.newPage()', 'browser test released: Playwright.create()', 'browser test released: playwright.firefox().launch()',
      'page test released: b.newContext().newPage()', 'context test released: b.newContext()', 'browser test leak: Playwright.create().webkit().launch()', 'browser test leak: Playwright.create()'],
    // A page made from a context that the framework hands in is closed with it. A context the test makes itself is not.
    ['page test auto: context.newPage()', 'context test leak: browser.newContext()', 'page test leak: other.newPage()'],
    ['connection test leak: DriverManager.getConnection(url)', 'connection test released: DriverManager.getConnection(url)', 'server test released: new MockWebServer()'],
    // In a class inside: its own after hook does not know `local`, and the after hook of the class around it quits `driver`.
    ['driver test leak: new ChromeDriver()', 'driver test released: new ChromeDriver()'],
  ]);
  const hooks = (suite) => suite.hooks.map((hook) => `${hook.kind}: ${hook.releases.join(' ')}`);
  assert.deepEqual([hooks(model.suites[0]), hooks(model.suites[0].suites[0])], [['beforeAll: ', 'afterAll: var:shared env:shop.mode', 'beforeEach: ', 'afterEach: var:driver env:shop.zone'], ['beforeEach: ', 'afterEach: var:inner']]);
  assert.deepEqual(model.tests[2].mocks.map((mock) => mock.target), ['Prices', 'Clock', 'Stock', 'Cart']);
});

test('the hooks of a base class are joined to the classes that extend it, through the helper index', async () => {
  const span = { startLine: 1, startColumn: 1, endLine: 9, endColumn: 2 };
  const base = (owner, file, hooks, superclass = null) => ({ name: `extends ${owner}`, owner, file, span, inherited: { hooks, superclass } });
  const quit = { kind: 'afterEach', scope: 'suite', releases: ['var:driver'], data: [{ span, text: 'orders.deleteAll()', op: 'delete', via: 'db' }] };
  const start = { kind: 'beforeEach', scope: 'suite', releases: [], data: [] };
  const extending = async (helpers, clause = 'extends BaseTest') => {
    const text = `${JUNIT5}\nclass ATest ${clause} {\n    @Test void a() { driver = new ChromeDriver(); }\n}\n`;
    const model = await normalizeText(javaAdapter, `${TESTS}/ATest.java`, text, { helperIndex: createHelperIndex(helpers) });
    return [model.suites[0].hooks.map((h) => [h.kind, h.scope, h.span.startLine, h.span.startColumn, h.releases.join(' '), h.data.map((d) => `${d.op}@${d.span.startLine}`).join(' ')]), resourcesOf(model.tests[0].resources)];
  };
  // The hooks stand at the `extends` of the class, with what they release and delete. The driver of the test is quit by the base class.
  const quits = ['afterEach', 'suite', 4, 13, 'var:driver', 'delete@4'];
  assert.deepEqual(await extending([base('BaseTest', `${TESTS}/BaseTest.java`, [start, quit])]), [[['beforeEach', 'suite', 4, 13, '', ''], quits], ['driver test released: new ChromeDriver()']]);
  assert.deepEqual(await extending([]), [[], ['driver test leak: new ChromeDriver()']]);
  // Of two classes with one name the one in the folder of the file is meant. With neither there, the base class is not known.
  assert.deepEqual((await extending([base('BaseTest', `${TESTS}/BaseTest.java`, [quit]), base('BaseTest', 'other/BaseTest.java', [start])]))[0], [quits]);
  assert.deepEqual(await extending([base('BaseTest', 'a/BaseTest.java', [quit]), base('BaseTest', 'b/BaseTest.java', [quit])]), [[], ['driver test leak: new ChromeDriver()']]);
  // The hooks of the class above the base class come first. A class that extends itself in the end does not loop.
  assert.deepEqual((await extending([base('BaseTest', 'a/BaseTest.java', [start], 'RootTest'), base('RootTest', 'a/RootTest.java', [quit], 'BaseTest')]))[0].map((hook) => hook[0]), ['afterEach', 'beforeEach']);
  assert.deepEqual((await extending([base('BaseTest', 'a/BaseTest.java', [quit])], 'extends base.BaseTest<Cart> implements Runnable'))[0], [quits]);
  // A class with no test and no hook of its own is no suite, whatever it extends.
  assert.deepEqual((await normalizeText(javaAdapter, `${TESTS}/Money.java`, 'class Money extends BaseTest { int cents; }\n', { helperIndex: createHelperIndex([base('BaseTest', 'a/BaseTest.java', [quit])]) })).suites, []);

  // What the adapter puts in the index for a class: its hooks, with what they release and delete, and the class it extends.
  const text = `${RESTASSURED}abstract class BaseUiTest extends RootTest {\n    protected WebDriver driver;\n    @BeforeEach void start() { driver = new ChromeDriver(); }\n    @AfterEach void stop() { driver.quit(); given().delete("/orders"); }\n`
    + '    @org.junit.jupiter.api.AfterAll static void end() { System.clearProperty("shop.mode"); }\n    void helper() { }\n    abstract void declared();\n    static class Plain { }\n    static class Child extends Plain { }\n}\n';
  const parsed = await javaAdapter.parse({ path: `${TESTS}/BaseUiTest.java`, absPath: '/x', language: 'java', project: null, text }, adapterContext());
  assert.deepEqual(javaAdapter.collectHelpers(parsed).map((entry) => [entry.name, entry.owner, entry.span.startLine, entry.inherited.superclass, entry.inherited.hooks.map((hook) => [hook.kind, hook.scope, hook.releases.join(' '), hook.data.map((op) => op.op).join(' ')])]), [
    ['extends BaseUiTest', 'BaseUiTest', 4, 'RootTest', [['beforeEach', 'suite', '', ''], ['afterEach', 'suite', 'var:driver', 'delete'], ['afterAll', 'suite', 'env:shop.mode', '']]],
    ['extends Child', 'Child', 12, 'Plain', []],
  ]);
  parsed.tree.delete();
});

test('robustness: with a missing grammar the lexical scanner still finds tests, skips, assertions and fixed sleeps', async () => {
  const parser = createTreeSitterService({ readAsset: (name) => (name.endsWith('java.wasm') ? (() => { throw new Error('gone'); })() : readAsset(name)) });
  const java = (text, relPath = `${TESTS}/CartTest.java`) => normalizeText(javaAdapter, relPath, text, { parser });
  const model = await java([
    '// qa-core-review-disable QCR-W001 -- the scanner reads comments too', 'package shop;', '', 'import org.junit.jupiter.api.*;', '', 'class CartTest {', '    @Test', '    void addsAnItem() {', '        cart.add("apple");',
    '        assertEquals(1, cart.size());', '    }', '', '    @Disabled("later")', '    @Test', '    @DisplayName("applies a coupon")', '    void appliesACoupon() throws Exception {', '        Thread.sleep(1_500);',
    '        page.waitForTimeout(300);', '        Thread.sleep(delay);', '        String note = "assertEquals(1, 2); Thread.sleep(9)"; // assertTrue in a comment', '        assertThat(cart.total()).isEqualTo(9);', '    }', '',
    '    @ParameterizedTest', '    @CsvSource({', '        "apple, 1",', '        "pear, 2"', '    })', '    void addsThatMany(String name, int count) {', '        if (count > 0) {', '            verify(mailer).send(name);', '        }', '    }', '',
    '    @Test void onOneLine() { assertTrue(cart.isEmpty()); }', '', '    @Test', '    void declaredOnly();', '', '    void helper() {', '        assertTrue(true);', '    }', '',
    '    @Nested', '    class WhenEmpty {', '        @Test(enabled = false)', '        public void paysNothing() {', '            given().get("/cart").then().statusCode(200);', '            fail("no");', '        }', '    }', '}', '',
  ].join('\n'));
  assert.deepEqual([model.parseStatus, model.capabilities, model.role, model.runner], ['partial', ['tests', 'modifiers', 'assertions', 'waits'], 'test', 'junit5']);
  assert.deepEqual(model.tests.map((t) => [t.fullTitle, t.modifiers, t.skip?.unconditional ?? null, t.span.startLine, t.span.endLine, t.statementCount, t.assertions.map((a) => a.span.startLine), t.waits.map((w) => [w.span.startLine, w.ms])]), [
    ['CartTest > addsAnItem', [], null, 7, 11, 2, [10], []],
    // The span starts at the first annotation. Both sleeps take milliseconds. Strings and comments are not searched.
    ['CartTest > appliesACoupon', ['skip'], true, 13, 22, 5, [21], [[17, 1500], [18, 300], [19, null]]],
    // An annotation that runs over several lines.
    ['CartTest > addsThatMany', [], null, 24, 33, 3, [31], []],
    ['CartTest > onOneLine', [], null, 35, 35, 1, [35], []],
    // A method with no body and a method with no test annotation are no tests. `enabled = false` is a skip.
    ['CartTest > WhenEmpty > paysNothing', ['skip'], true, 46, 50, 2, [48, 49], []],
  ]);
  assert.deepEqual([model.tests[0].assertions[0], model.suppressions.map((s) => s.rules), model.suites, model.imports], [
    { span: { startLine: 10, startColumn: 9, endLine: 10, endColumn: 38 }, text: 'assertEquals(1, cart.size());', kind: 'other', library: 'unknown', actual: null, expected: null, matcher: null, negated: false, soft: false, complete: true,
      awaited: 'not-needed', guarded: false, reachable: true, viaHelper: null },
    [['QCR-W001']], [], [],
  ]);
  assert.deepEqual(schemaErrors('model.schema.json', model), []);
  // CRLF line ends and a byte order mark are taken out when a file is read (toLf), so they change nothing here either.
  const crlf = await java(toLf(`${String.fromCharCode(0xfeff)}class ATest {\r\n    @Test\r\n    void a() {\r\n        Thread.sleep(1);\r\n    }\r\n}\r\n`));
  assert.deepEqual([crlf.tests.map((t) => t.title), crlf.tests[0].waits.map((w) => [w.ms, w.span.startLine, w.span.endColumn])], [['a'], [[1, 4, 25]]]);
  // With no test found, or none that ends, the scanner has nothing to offer and the file stays failed.
  for (const text of ['class Money { int cents; }\n', 'class ATest {\n    @Test\n}\n', 'class ATest {\n    @Test\n    void a() {\n        open();\n', '@Test\n@Test\nvoid a() { }\n@Test (\n']) {
    assert.deepEqual((({ parseStatus, capabilities }) => [parseStatus, capabilities])(await java(text)), text.includes('void a() { }') ? ['partial', ['tests', 'modifiers', 'assertions', 'waits']] : ['failed', []], text);
  }
  assert.equal((await javaAdapter.parse({ path: 'ATest.java', absPath: '/ATest.java', language: 'java', project: null, text: 'x' }, { ...adapterContext(), parser })).tree, null);
});

test('the rules read what a Java body does', async () => {
  const review = async (framework) => {
    const { report } = await runReview({ root: fixtureRoot('adapters', 'java', framework), config: resolveConfig({}).config, git: false, rules: builtinRules });
    return report.findings.filter((finding) => /^QCR-[WSMC]/.test(finding.ruleId)).map((finding) => `${finding.location.file.replace(`${TESTS}/`, '')}:${finding.location.startLine} ${finding.ruleId} ${finding.severity}`);
  };
  assert.deepEqual(await review('junit5'), [
    // Every assertion checks a call on a mock, and a reply that the test gave itself is checked.
    'CheckoutServiceTest.java:53 QCR-M001 warn', 'CheckoutServiceTest.java:60 QCR-M001 error',
    // `MailerTest` has `@Mock Mailer mailer`: by the name of the file, the class under test is the mock.
    'MailerTest.java:34 QCR-M001 error', 'MailerTest.java:46 QCR-M001 warn', 'MailerTest.java:54 QCR-M001 warn', 'MailerTest.java:63 QCR-M001 warn', 'MailerTest.java:69 QCR-M001 warn', 'MailerTest.java:79 QCR-M001 error',
    // A system property that is set and never cleared.
    'OrderStoreTest.java:91 QCR-C001 warn',
    // SPEC.md Section 18, Milestone 14: `@Mock` of the class under test is QCR-M001, an error. A spy that keeps the real behavior is not.
    'PricesTest.java:16 QCR-M001 error', 'PricesTest.java:21 QCR-M001 error', 'PricesTest.java:26 QCR-M001 error', 'PricesTest.java:28 QCR-M001 error',
  ]);
  assert.deepEqual(await review('junit4'), []);
  // A driver that an after hook only forgets.
  assert.deepEqual(await review('testng'), ['DriverLifecycleTest.java:20 QCR-C001 warn']);
  assert.deepEqual(await review('selenium'), [
    'CheckoutIT.java:22 QCR-W001 warn', 'CheckoutIT.java:24 QCR-W001 warn', 'CheckoutIT.java:25 QCR-W001 warn', 'CheckoutIT.java:26 QCR-W001 warn', 'CheckoutIT.java:33 QCR-W001 warn', 'CheckoutIT.java:34 QCR-W001 warn',
    'CheckoutIT.java:35 QCR-W001 warn', 'CheckoutIT.java:36 QCR-W001 warn', 'CheckoutIT.java:38 QCR-W001 warn', 'CheckoutIT.java:39 QCR-W001 warn', 'CheckoutIT.java:40 QCR-W001 warn',
    // An implicit wait of 30 seconds, an XPath that follows the layout, and a pick by index.
    'CheckoutIT.java:56 QCR-W001 info', 'CheckoutIT.java:64 QCR-S001 warn', 'CheckoutIT.java:71 QCR-S001 info',
    // Three drivers that are never quit. The tests of the classes that extend `BaseUiTest` leak nothing: the base class quits the driver.
    'DriversIT.java:42 QCR-C001 warn', 'DriversIT.java:64 QCR-C001 warn', 'DriversIT.java:74 QCR-C001 warn',
    'FindByIT.java:15 QCR-S001 warn', 'FindByIT.java:33 QCR-S001 warn', 'SelenideIT.java:21 QCR-S001 warn', 'SelenideIT.java:29 QCR-W001 warn', 'SelenideIT.java:30 QCR-W001 warn', 'SelenideIT.java:31 QCR-S001 info',
    'SelenideIT.java:32 QCR-S001 info',
  ]);
  assert.deepEqual(await review('playwright-java'), [
    // Every request is answered by a fake, and the test then checks the page.
    'RoutesTest.java:41 QCR-M001 warn', 'RoutesTest.java:58 QCR-W001 warn', 'RoutesTest.java:69 QCR-S001 warn', 'RoutesTest.java:78 QCR-S001 info', 'RoutesTest.java:93 QCR-C001 warn',
  ]);
  // An order that is created over HTTP and never deleted is an info. The test that deletes it again is not reported.
  assert.deepEqual(await review('restassured'), ['OrderLifecycleApiTest.java:41 QCR-C001 info', 'OrderLifecycleApiTest.java:56 QCR-C001 info', 'OrderLifecycleApiTest.java:70 QCR-C001 warn']);
});
