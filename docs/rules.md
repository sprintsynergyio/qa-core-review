# Rules

Each rule has an id that never changes. A finding names the rule, the place, the evidence and a fix. Run `qa-core-review rules` for the list and `qa-core-review explain <ruleId>` for one rule with its examples.

This page covers every rule that is built. The examples are in TypeScript. The same rules run on JavaScript files. Python and Java examples are added with those adapters.

| Id | Name | Default | Scope | What it finds | Also in qa-core-verify |
| --- | --- | --- | --- | --- | --- |
| [QCR-A001](#qcr-a001) | no-assertion | error | universal | A test with no assertion. | QCV-W001 |
| [QCR-A002](#qcr-a002) | trivial-assertion | error | universal | An assertion whose result is fixed by the code itself. | QCV-W004 |
| [QCR-A003](#qcr-a003) | cannot-fail-assertion | error | universal, with cases for some frameworks | An assertion that looks real and cannot fail. | QCV-W002, QCV-W003 |
| [QCR-A004](#qcr-a004) | conditional-assertion | warn | universal | Every assertion sits inside a condition, a loop or a callback. | QCV-W007 |
| [QCR-W001](#qcr-w001) | hard-wait | warn | universal | A fixed sleep in a test or a hook. | QCV-W010 |
| [QCR-S001](#qcr-s001) | brittle-selector | warn | UI frameworks | A selector that depends on page layout or on generated names. | locator checks |
| [QCR-E001](#qcr-e001) | swallowed-error | error | universal | An assertion failure that is caught and ignored. | QCV-W008 |
| [QCR-F001](#qcr-f001) | focused-test | error | runners with focus | A focused test or suite: `.only`, `fit`, `fdescribe`. | QCV-W009 |
| [QCR-F002](#qcr-f002) | skipped-test | warn | universal | A test or suite that is skipped with no condition, a to-do, or a fixme. | QCV-W009 |
| [QCR-D001](#qcr-d001) | duplicate-test | warn | universal | A test with the same body as another test, or the same title in one file. | none |
| [QCR-N001](#qcr-n001) | missing-negative-case | info | universal | A group of tests with happy paths only. | none |
| [QCR-M001](#qcr-m001) | over-mocking | error / warn | universal, with subject detection per framework | The code under test is replaced by a mock. | none |
| [QCR-P001](#qcr-p001) | snapshot-only | warn / info | universal | A test whose only assertions are snapshots. | none |
| [QCR-C001](#qcr-c001) | missing-cleanup | warn | universal | State that a test creates and never restores. | none |
| [QCR-X001](#qcr-x001) | parse-error | info | universal | A file that cannot be parsed, or a test file with no test in it. | QCV-W000 (similar) |
| [QCR-X002](#qcr-x002) | suppression-without-reason | info | universal | A suppression comment that does not say why. | none |

The last column names the check in qa-core-verify that looks for the same problem when it runs your tests. qa-core-review finds it by reading the code, before anything runs.

Not built yet: `QCR-X003` no-static-adapter, and for v0.2 `QCR-G001` unmatched-step (Gherkin) and `QCR-K001` perf-no-thresholds (k6, JMeter).

## Which rules run on which language

A rule runs on a file when the adapter of its language fills in everything the rule needs. This table is made from the code by `scripts/gen-support-matrix.mjs`.

<!-- support-matrix:start -->
| Rule | Needs from the adapter | JavaScript, TypeScript | Python | Java |
| --- | --- | --- | --- | --- |
| [QCR-A001](#qcr-a001) | tests, assertions | yes | yes | planned |
| [QCR-A002](#qcr-a002) | assertions, assertion-operands | yes | yes | planned |
| [QCR-A003](#qcr-a003) | assertions, assertion-operands, reachability | yes | yes | planned |
| [QCR-A004](#qcr-a004) | assertions | yes | yes | planned |
| [QCR-W001](#qcr-w001) | waits | yes | no | planned |
| [QCR-S001](#qcr-s001) | selectors | yes | no | planned |
| [QCR-E001](#qcr-e001) | try-blocks | yes | yes | planned |
| [QCR-F001](#qcr-f001) | modifiers | yes | yes | planned |
| [QCR-F002](#qcr-f002) | modifiers | yes | yes | planned |
| [QCR-D001](#qcr-d001) | body-hash | yes | yes | planned |
| [QCR-N001](#qcr-n001) | tests, assertions | yes | yes | planned |
| [QCR-M001](#qcr-m001) | mocks, assertions, assertion-operands | yes | no | planned |
| [QCR-P001](#qcr-p001) | assertions | yes | yes | planned |
| [QCR-C001](#qcr-c001) | resources, hooks | yes | no | planned |
| [QCR-X001](#qcr-x001) | none | yes | yes | planned |
| [QCR-X002](#qcr-x002) | none | yes | yes | planned |
<!-- support-matrix:end -->

When a file cannot be parsed, the tool reads it line by line. It then knows the tests, their modifiers, their assertions and their sleeps, so only the rules that need nothing more still run, and their findings have low confidence.

## Settings every rule has

In the config, a rule is `"off"`, a severity (`"error"`, `"warn"`, `"info"`), or an object:

```json
{
  "rules": {
    "QCR-A004": "off",
    "QCR-A002": "warn",
    "QCR-A001": { "severity": "warn", "languages": ["typescript"] }
  }
}
```

A severity in the config sets the level of the rule. A case that a rule reports at a level of its own keeps it: the picks by position of `QCR-S001`, the implicit wait of `QCR-W001`, the expected failure of `QCR-F002`, the visual checks of `QCR-P001` and the test data of `QCR-C001` stay info, and the three warn cases of `QCR-M001` stay warn. Set the rule to `"info"` to bring everything down to info. `languages` limits the rule to those languages.

## Suppressing a finding

When a rule is right in general and wrong in one place, switch it off there and say why. There are three ways.

**For the next line**, with a comment in the syntax of the language:

```ts
// qa-core-review-disable-next-line QCR-W001 -- the animation has no event to wait for
await page.waitForTimeout(500);
```

```python
# qa-core-review-disable-next-line QCR-W001 -- the report job has no event to wait for
time.sleep(2)
```

The comment covers the findings that start on the line after it. Name one rule or several, with commas between them. A finding about a whole test, such as `QCR-A001`, starts on the line of the test, so the comment goes above the test.

**For a whole file**, with a comment before the first statement of the file:

```ts
// qa-core-review-disable QCR-S001 -- the legacy grid has no test ids, tracked in SHOP-142
import { expect, test } from '@playwright/test';
```

**In the config**, which also works for files that have no comments:

```json
{
  "suppressions": [
    { "file": "legacy/**", "rules": ["QCR-W001", "QCR-S001"], "reason": "The legacy suite is replaced in Q1." },
    { "file": "tests/smoke.spec.ts", "rules": ["QCR-A001"], "test": "Smoke > opens the shop", "reason": "It only has to load." }
  ]
}
```

`file` is a glob. `test` is optional and is the full title of one test: the titles of its suites and its own title, joined by " > ".

A reason is required: the text after ` -- ` in a comment, or `reason` in the config. A comment with no reason does nothing, and [QCR-X002](#qcr-x002) reports it. A config entry with no reason is a config error.

A suppressed finding is not printed and counts for nothing: not for the verdict of a test, not for the totals, not for the exit code. It stays in `report.json` with `"suppressed": true`, and the summary line says how many there are.

<a id="qcr-a001"></a>
## QCR-A001 `no-assertion` (error)

A test that runs code and checks nothing. It passes whatever the code does.

Bad:

```ts
test('user can log in', async ({ page }) => {
  await page.goto('https://www.saucedemo.com');
  await page.getByRole('button', { name: 'Login' }).click();
});
```

Good:

```ts
test('user can log in', async ({ page }) => {
  await page.goto('https://www.saucedemo.com');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/inventory\.html/);
});
```

Fix: Add an assertion that checks the result of the action, for example the URL, a visible element or the response body.

What counts as an assertion:

- `expect(...)`, `assert(...)` and `assert.method(...)`, Chai `should`, Cypress `.should(...)` and `.and(...)`, `sinon.assert`.
- A supertest check inside the request chain: `request(app).get('/orders').expect(200)`.
- A call to a helper that contains an assertion: a function in the same file, a page object method or a function the test file imports, a custom Cypress command. Helpers are counted one level deep: a helper that only calls another helper does not count.
- A test that expects an error: `expect(fn).toThrow()`, `.rejects`, `assert.throws`.
- A check written by hand: `if (response.status() !== 200) throw new Error(...)`, `expect.fail()`, `assert.fail()`.
- A Cypress chain that ends with `.contains('text')`, when it is the last command of the test.

Not reported: a test that is skipped, `todo` or `fixme` (also through its `describe`), and a test with an empty body.

If the tool cannot see into one of your helpers, for example one that comes from a package, name it in the config:

```json
{ "assertionHelpers": ["verifyCart", "expectLoggedIn"] }
```

Turn it off: `"rules": { "QCR-A001": "off" }` in the config, or `--disable QCR-A001` on the command line.

<a id="qcr-a002"></a>
## QCR-A002 `trivial-assertion` (error)

An assertion whose result is fixed by the code itself: a literal checked against a literal, or the same expression on both sides.

Bad:

```ts
expect(true).toBe(true);
expect(cart.total()).toBe(cart.total());
```

Good:

```ts
expect(cart.items).toContainEqual(item);
expect(cart.total()).toBe(29.99);
```

Fix: Check a value that the code under test produced, against the value you expect.

Also reported: `assert(true)`, `assert.ok(1)`, `expect(null).toBeNull()`, and the same assertions inside a hook.

Not reported:

- A real check written backwards, with the expected value first: `expect(2).toBe(items.length)`.
- A negated self comparison such as `expect(nextId()).not.toBe(nextId())`. It can fail, so it is a real check.

Turn it off: `"rules": { "QCR-A002": "off" }` in the config, or `--disable QCR-A002` on the command line.

<a id="qcr-a003"></a>
## QCR-A003 `cannot-fail-assertion` (error)

An assertion that looks real and can never go red. Each case below has its own message. An assertion is reported once, for the first case that matches.

### An assertion that is started and never finished

Bad:

```ts
expect(page.getByText('Products'));
expect(total).toBeTruthy;
```

Good:

```ts
await expect(page.getByText('Products')).toBeVisible();
expect(total).toBeTruthy();
```

Fix: Finish the assertion by calling a matcher.

### An assertion after a return or a throw

Bad:

```ts
return;
expect(cart.items).toHaveLength(1);
```

Good:

```ts
expect(cart.items).toHaveLength(1);
return;
```

Fix: Move the assertion before the return or throw, or remove the early exit.

### An async assertion that is not awaited

Bad:

```ts
expect(page.getByRole('button', { name: 'Checkout' })).toBeVisible();
expect(loadCart('c-1')).resolves.toHaveProperty('items');
```

Good:

```ts
await expect(page.getByRole('button', { name: 'Checkout' })).toBeVisible();
await expect(loadCart('c-1')).resolves.toHaveProperty('items');
```

Fix: Put await before the assertion, or return it from the test.

### A check that a locator object exists

Bad:

```ts
expect(page.locator('#checkout')).toBeTruthy();
```

Good:

```ts
await expect(page.locator('#checkout')).toBeVisible();
```

Fix: Check what the element shows or does, for example that it is visible or has the right text.

### A count compared with zero in a way that is always true

Bad:

```ts
expect(await rows.count()).toBeGreaterThanOrEqual(0);
```

Good:

```ts
await expect(rows).toHaveCount(3);
```

Fix: Compare the count with the number you expect, or check that it is greater than zero.

### A list or object literal checked for being truthy

Bad:

```ts
expect([cart.total(), 42]).toBeTruthy();
```

Good:

```ts
expect(cart.total()).toBe(42);
```

Fix: Check the value itself. A list or an object that is written out is always truthy.

Details:

- **Not finished** is only reported for a whole statement. `const check = expect(total)` is left alone, because it may be finished later.
- **Not awaited** covers Playwright web-first matchers, `expect.poll`, `.resolves` and `.rejects`, `assert.rejects`, and expect-webdriverio matchers on an element or on `browser`. An assertion that is returned, or passed to `Promise.all` that is awaited, counts as awaited.
- **Locator** needs the tool to know that the value is a locator: a call such as `page.locator(...)`, `page.getByRole(...)`, `cy.get(...)`, `$(...)`, or a variable that holds one in the same test. In a Testing Library file, `getByText` throws when the text is missing, so `expect(screen.getByText('x')).toBeTruthy()` is a real check and is not reported.
- **Count** means "at least 0": `toBeGreaterThanOrEqual(0)` or `not.toBeLessThan(0)` on a `.length`, a `.size` or a `.count()`.

Turn it off: `"rules": { "QCR-A003": "off" }` in the config, or `--disable QCR-A003` on the command line.

<a id="qcr-a004"></a>
## QCR-A004 `conditional-assertion` (warn)

Every assertion of the test is inside an `if`, a `switch`, a ternary, `&&`, a loop, a `catch` block, or a callback that may never run. When the condition is false or the list is empty, the test passes with zero checks.

Bad:

```ts
const error = page.getByTestId('error');
if (await error.isVisible()) {
  await expect(error).toContainText('locked out');
}
```

Good:

```ts
await expect(page.getByTestId('error')).toContainText('locked out');
```

Fix: Assert without the condition, or first check that there is something to check: for example the length of the list before the loop.

Not reported when:

- At least one assertion always runs, for example a check of the length before the loop.
- The test calls `expect.assertions(n)` or `expect.hasAssertions()`.
- The callback always runs: `test.step`, a promise `then`, `waitFor`, Cypress `should(fn)`, `then` and `within`, the function given to `expect(...)`.
- The callback is what ends the test: it calls `done()`, or the `resolve` of a promise the test returns.
- The condition is the check: `if (!ok) throw new Error(...)` or `if (!ok) expect.fail(...)`.

Turn it off: `"rules": { "QCR-A004": "off" }` in the config, or `--disable QCR-A004` on the command line.

<a id="qcr-w001"></a>
## QCR-W001 `hard-wait` (warn)

A fixed sleep in a test or in a hook. It makes every run slower, and the test still fails on the day the page needs longer than the sleep.

Bad:

```ts
await page.getByRole('button', { name: 'Add to cart' }).click();
await page.waitForTimeout(3000);
await expect(page.getByTestId('shopping-cart-badge')).toHaveText('1');
```

Good:

```ts
await page.getByRole('button', { name: 'Add to cart' }).click();
await expect(page.getByTestId('shopping-cart-badge')).toHaveText('1');
```

Fix: Wait for a condition instead: a web-first assertion, an explicit wait (WebDriverWait, waitForResponse) or a polling helper. For timing failures that come and go, see qa-core-flaky.

What counts as a fixed sleep:

- Playwright `page.waitForTimeout(3000)`, Cypress `cy.wait(2000)`, WebdriverIO `browser.pause(3000)`.
- `await sleep(500)`, `await delay(500)`, `await setTimeout(500)` from `node:timers/promises`, and `await new Promise((resolve) => setTimeout(resolve, 500))`.
- A sleep whose amount is a variable, such as `cy.wait(pageLoad)`. The message then has no number.

Not reported:

- A wait for a condition: `cy.wait('@orders')`, `page.waitForResponse(...)`, `page.waitForURL(...)`, `waitForDisplayed`, `browser.waitUntil(...)`, `waitFor(...)`, `expect.poll(...)`.
- A fake clock: `jest.advanceTimersByTime(300)`, `vi.runAllTimers()`, `cy.tick(1000)`, `page.clock.fastForward(...)`.
- A timeout setting: `test.setTimeout(60_000)`, `{ timeout: 10000 }`.
- A sleep at or below `maxMs`.

### A long implicit wait (info)

WebdriverIO only, for now. `browser.setTimeout({ implicit: ... })` above 5000 ms is reported as info. With an implicit wait, every lookup of a missing element takes that long to fail, and it adds up with your explicit waits.

Bad:

```ts
await browser.setTimeout({ implicit: 10000 });
```

Good:

```ts
await $('[data-test="shopping-cart-badge"]').waitForDisplayed({ timeout: 10000 });
```

Fix: Keep the implicit wait at 0 or short, and wait for each condition where the test needs it.

### Options

```json
{ "rules": { "QCR-W001": { "maxMs": 250 } } }
```

`maxMs` (default 0): a sleep of this many milliseconds or fewer is not reported.

Turn it off: `"rules": { "QCR-W001": "off" }` in the config, or `--disable QCR-W001` on the command line.

<a id="qcr-s001"></a>
## QCR-S001 `brittle-selector` (warn)

A selector that depends on the layout of the page or on generated names. It breaks when the page changes, while the feature still works. This rule runs on UI tests: Playwright, Cypress and WebdriverIO so far. Selectors in hooks such as `beforeEach` are checked too.

Fix: Prefer role, label or test id selectors. For Playwright suites, qa-core-heal can repair many broken locators at once.

### An XPath that depends on layout

The XPath starts at `/html`, has a positional index such as `[3]` or `[last()]`, or has 4 or more steps. A short XPath on an attribute, such as `//button[@data-test="add-to-cart"]`, is fine.

Bad:

```ts
await page.locator('//div[3]/div[2]/button[2]').click();
```

Good:

```ts
await page.getByRole('button', { name: 'Add to cart' }).click();
```

### A selector that picks by position

The selector has `:nth-child(`, `:nth-of-type(`, `:nth-last-child(`, `:nth-last-of-type(` or the Playwright `>> nth=`.

Bad:

```ts
cy.get('.inventory_list > div:nth-child(2) button').click();
```

Good:

```ts
cy.get('[data-test="add-to-cart-sauce-labs-backpack"]').click();
```

### A generated class or id

A class or an id that a styling library or a framework writes at build time, so it changes with the next build: `css-1q2w3e4` (Emotion), `sc-bdnylx` (styled-components), `jss42` and `makeStyles-root-12` (Material UI), `_button_1x2y3_12` and `Button_primary__3xK2a` (CSS modules), `ng-tns-c123-4` (Angular), `ember123` (Ember), or a name with a hash in it such as `item-4f3a2b1c`.

Bad:

```ts
await page.locator('.css-1q2w3e4').click();
```

Good:

```ts
await page.getByTestId('checkout').click();
```

### A selector that follows the page structure

The selector chains 4 or more combinators (`>`, a space, `+`, `~`). One new wrapper `div` breaks it.

Bad:

```ts
await page.locator('#root > div > main > section > button').click();
```

Good:

```ts
await page.getByRole('button', { name: 'Checkout' }).click();
```

### A pick by position in a list (info)

`.nth(2)` or `.eq(2)` with an index above 0, and `.first()` or `.last()` on a selector that is not a role, a label or a test id. Often there is no better way, so this is info: it never changes the verdict of a test.

Bad:

```ts
await page.locator('.inventory_item').nth(2).click();
```

Good:

```ts
await page.locator('.inventory_item').filter({ hasText: 'Sauce Labs Backpack' }).click();
```

Fix: Pick the element by something it shows, such as its text, a role with a name or a test id, not by its place in a list.

### Not reported

- Role, label, text and test id locators: `getByRole`, `getByLabel`, `getByText`, `getByTestId`, `cy.contains`, `$('aria/Username')`.
- Test id attributes: `[data-testid=...]`, `[data-test=...]`, `[data-qa=...]`, `[data-cy=...]`, and the attribute you name in `testIdAttribute`.
- Plain ids and classes written by people: `#login-button`, `.inventory_item_name`, `.card__title`.
- `.first()` or `.last()` of a role, a label or a test id, and index 0.
- A selector built at run time (a variable or a template with a value in it). The tool only reads literal text.

Each selector gives one finding: the first case that fits, in the order above.

### Options

```json
{
  "testIdAttribute": "data-automation",
  "rules": { "QCR-S001": { "allowPatterns": ["^#app-root", "\\.legacy-"] } }
}
```

- `allowPatterns` (default none): regular expressions. A selector whose text matches one of them is not reported.
- `testIdAttribute` (top level, default `data-testid`): your own test id attribute. A selector on it counts as a test id.

Turn it off: `"rules": { "QCR-S001": "off" }` in the config, or `--disable QCR-S001` on the command line.

<a id="qcr-e001"></a>
## QCR-E001 `swallowed-error` (error)

An assertion inside a `try` block or a promise chain whose handler catches the failure and goes on. The check fails, the handler logs a line, and the test passes.

### A catch block that hides a failed assertion

Bad:

```ts
try {
  await expect(page.getByTestId('total')).toHaveText('$32.39');
} catch (e) {
  console.log('total did not match', e);
}
```

Good:

```ts
await expect(page.getByTestId('total')).toHaveText('$32.39');
```

Fix: Take the assertion out of the try block, or throw the error again in the handler. To go on after a failed check, use a soft assertion.

Reported when the `try` part has an assertion (also one level down, in a helper) and the `catch` block does none of these: throw, call `expect.fail(...)`, `assert.fail(...)` or `done(error)`, or make an assertion of its own.

### A .catch() handler that hides a failed assertion

Bad:

```ts
await expect(page.getByTestId('promo-banner')).toBeVisible().catch(() => {});
```

Good:

```ts
await expect(page.getByTestId('promo-banner')).toBeVisible();
```

Fix: Remove the .catch() from the assertion, so that a failed check fails the test. To go on after a failed check, use a soft assertion.

Reported when the chain before `.catch(...)` has an assertion and the handler does nothing or only logs: `() => {}`, `() => undefined`, `() => null`, `console.log`, `console.error`, `console.warn`, `noop`, or a function whose body does not throw. `.catch(() => done())` is reported too: `done()` with no argument ends a Mocha test as passed.

### Not reported

- `try` with `finally` and no `catch`.
- A handler that throws again, also with a new error: `catch (e) { throw new Error('cart', { cause: e }); }`.
- A handler that fails the test or checks the error: `.catch(done)`, `catch (e) { expect(e.status).toBe(400); }`.
- A `try` block with no assertion inside, such as a click on a cookie banner that may not be there.
- Soft assertions (`expect.soft`). They do not throw, so a handler cannot hide them, and the runner still fails the test at the end.
- A handler that turns the failure into a value the test goes on with: `.then(() => true).catch(() => false)`.
- A handler given by a name the tool cannot see into: `.catch(reportFailure)`.

Turn it off: `"rules": { "QCR-E001": "off" }` in the config, or `--disable QCR-E001` on the command line.

<a id="qcr-f001"></a>
## QCR-F001 `focused-test` (error)

A test or a suite that is marked to run alone. When it is committed by mistake, the runner skips every other test and the run is still green.

Bad:

```ts
test.only('adds item to cart', async ({ page }) => {
  // ...
});
```

Good:

```ts
test('adds item to cart', async ({ page }) => {
  // ...
});
```

Fix: Remove the focus before you commit. To stop it from coming back, let CI refuse focused tests (Playwright forbidOnly, Mocha --forbid-only).

What counts: `test.only`, `it.only`, `describe.only`, `context.only`, `specify.only`, `test.describe.only`, `fit`, `fdescribe`, `it.only.each(...)`, and `{ only: true }` in the options of a `node:test` test. A focused suite gives one finding, on the suite.

Not reported: the word `only` in a title or as a method of your own code (`filters.only('in-stock')`), and tags that select tests from the command line.

Turn it off: `"rules": { "QCR-F001": "off" }` in the config, or `--disable QCR-F001` on the command line.

<a id="qcr-f002"></a>
## QCR-F002 `skipped-test` (warn)

A test or a suite that is switched off with no condition. Nobody is told, and the check it made is gone until someone remembers it.

Bad:

```ts
it.skip('rejects an empty password', () => {
  // ...
});
```

Good:

```ts
test('uploads a file', async ({ page }) => {
  test.skip(process.platform === 'win32', 'File picker is not supported on Windows CI');
  // ...
});
```

Fix: Turn the test back on, or delete it. If it has to wait, skip it on a condition and say why, with the ticket that tracks it.

What counts:

- `test.skip('title', ...)`, `it.skip`, `xit`, `xtest`, `test.fixme('title', ...)`, `test.skip.each(...)`, and `{ skip: true }` in the options of a `node:test` test.
- A bare `test.skip()`, `test.fixme()` or `this.skip()` at the top of a test body.
- A to-do: `it.todo('title')`, `{ todo: true }`, and a Mocha test with a title and no function.
- A skipped suite: `describe.skip`, `xdescribe`, `context.skip`, `test.describe.skip`, `test.describe.fixme`. It gives one finding, on the suite.

The message has the reason when the test gives one: "This test is skipped: The orders API is down until SHOP-142 is fixed."

A skipped test with no assertion is reported once, by this rule, and not by `QCR-A001`.

Not reported:

- A skip on a condition: `test.skip(browserName === 'webkit', 'reason')`, `test.fixme(isMobile, 'reason')`, `if (!process.env.API_URL) this.skip();`, `it.skipIf(...)`, `it.runIf(...)`.
- A condition for a whole file or group: `test.skip(process.platform === 'win32', 'reason')` and `test.skip(({ browserName }) => browserName !== 'chromium', 'reason')`.
- `test.slow()`.

### An expected failure (info)

`test.fail(...)`, `it.failing(...)` and `it.fails(...)` say that a test is known to fail. That is a fair way to keep a known bug visible, so it is info: "Expected failure: make sure this is tracked."

Bad:

```ts
test.fail('rounds the tax up', async ({ page }) => {
  // ...
});
```

Good:

```ts
// Fails until SHOP-142 is fixed: the tax is rounded down.
test.fail('rounds the tax up', async ({ page }) => {
  // ...
});
```

Fix: Say which bug makes the test fail and where it is tracked, and remove the mark when the bug is fixed.

Turn it off: `"rules": { "QCR-F002": "off" }` in the config, or `--disable QCR-F002` on the command line.

<a id="qcr-d001"></a>
## QCR-D001 `duplicate-test` (warn)

A copied test. It adds run time and a second place to fix, and it often means a case was planned and never written.

### A test with the same body as another test

Two tests have the same body when their code is the same after comments and spaces are taken out. Every copy after the first is reported, in the same file or in another file of the same language. The message and the evidence name the first copy.

Bad:

```ts
test('login works', async ({ page }) => {
  await login(page, 'standard_user');
  await expect(page).toHaveURL(/inventory/);
});

test('login works for standard user', async ({ page }) => {
  await login(page, 'standard_user');
  await expect(page).toHaveURL(/inventory/);
});
```

Good:

```ts
for (const user of ['standard_user', 'performance_glitch_user']) {
  test(`login works for ${user}`, async ({ page }) => {
    await login(page, user);
    await expect(page).toHaveURL(/inventory/);
  });
}
```

Fix: Delete the copy, or change it so that it checks another case. For the same steps with other data, write one parameterized test.

### Two tests with the same title in one file

Two tests in one file with the same full title (suite titles and test title). Their bodies may differ.

Bad:

```ts
it('adds an item', () => {
  expect(new Cart().add('backpack').items).toHaveLength(1);
});

it('adds an item', () => {
  expect(new Cart().add('backpack').add('onesie').total).toBe(37.98);
});
```

Good:

```ts
it('adds an item', () => {
  expect(new Cart().add('backpack').items).toHaveLength(1);
});

it('adds the prices of two items', () => {
  expect(new Cart().add('backpack').add('onesie').total).toBe(37.98);
});
```

Fix: Give each test a title that says what it checks, so that a failure report points to one test.

### Not reported

- A parameterized test: `it.each(...)`, `test.each(...)`, and tests made in a `for` loop or a `forEach`. It is one test with many cases.
- The same steps with other data. A different user name or price makes a different body.
- A body with fewer than 2 statements. It is too small to call a copy.
- The same title in two different suites, or in two files.
- A copy in another language. A `.js` file is not compared with a `.ts` file.

Turn it off: `"rules": { "QCR-D001": "off" }` in the config, or `--disable QCR-D001` on the command line.

<a id="qcr-n001"></a>
## QCR-N001 `missing-negative-case` (info)

A group of tests where every test is a happy path. Tests written in one go, by a person or by an AI tool, often cover only what should work. This rule is a hint with low confidence: it reads titles and assertions, it does not know your feature.

Bad:

```ts
describe('applyDiscount', () => {
  it('applies 10% off', () => {
    expect(applyDiscount(100, 'SAVE10')).toBe(90);
  });
  it('applies 20% off', () => {
    expect(applyDiscount(100, 'SAVE20')).toBe(80);
  });
});
```

Good:

```ts
describe('applyDiscount', () => {
  it('applies 10% off', () => {
    expect(applyDiscount(100, 'SAVE10')).toBe(90);
  });
  it('rejects an unknown code', () => {
    expect(() => applyDiscount(100, 'NOPE')).toThrow('Invalid code');
  });
});
```

Fix: Add at least one test for what must not work: bad input, a missing value, or a failure of something the code depends on.

A group is the tests of one `describe` block (the innermost one), or the tests of a file that are in no block. The rule reports once per group, on the line of the block, when the group has 2 or more tests and none of them looks like an error case. A test looks like an error case when:

- a word in its title or in the titles of its blocks starts with one of: invalid, error, fail, reject, wrong, empty, missing, denied, unauthorized, forbidden, expired, locked, limit, max, min, zero, negative, boundary, overflow, timeout, edge, null, undefined, none, nil, 404, 401, 403, 500, or the title has "not found". `rejectsUnknownCode` and `rejects_unknown_code` are read as words;
- it expects an exception: `toThrow`, `rejects`, `assert.throws`;
- it checks a status code of 400 or more;
- one of its assertions has the text "error", "invalid" or "required" in it.

The message suggests two or three cases from the title of the group: a group named "checkout" gets "checkout with an empty cart", "checkout with a missing postal code" and "checkout with a payment that is declined". A title the rule does not know gets "empty input", "invalid input" and "a server error".

This rule never changes the verdict of a test or the exit code at the default `--fail-on error`.

Turn it off: `"rules": { "QCR-N001": "off" }` in the config, or `--disable QCR-N001` on the command line.

<a id="qcr-m001"></a>
## QCR-M001 `over-mocking` (error)

The code under test is replaced by a mock, so the test checks the mock. Such a test stays green when the real code is broken or deleted. The first two cases are errors. The other three are warnings, because the test may still check something real.

### The code under test is mocked

Error. The module under test is the one the test file is named after: `cart.test.ts` tests the import `./cart` or `../src/cart`. Reported when that module is mocked with `vi.mock`, `jest.mock` or `jest.doMock`.

Bad:

```ts
import { getTotal } from './cart';

vi.mock('./cart', () => ({ getTotal: vi.fn(() => 42) }));

it('returns the total', () => {
  expect(getTotal([{ price: 40 }, { price: 2 }])).toBe(42);
});
```

Good:

```ts
import { getTotal } from './cart';

vi.mock('./tax', () => ({ taxRate: () => 0 }));

it('returns the total', () => {
  expect(getTotal([{ price: 40 }, { price: 2 }])).toBe(42);
});
```

Fix: Mock what the code under test depends on, not the code under test itself.

### A stubbed function is called and checked

Error. A mock function is given a fixed reply (`mockReturnValue`, `mockResolvedValue`, `vi.fn(() => 42)`, sinon `returns` or `resolves`), and the test then calls that same function inside an assertion. Like the first case, it is reported only in a file whose module under test is known. This covers `vi.fn()`, `jest.fn()` and `sinon.stub()` stored under a name, and `vi.spyOn`, `jest.spyOn` and `sinon.stub` on a method.

Bad:

```ts
it('loads the user', async () => {
  const getUser = vi.fn().mockResolvedValue({ id: 7, name: 'Sam' });
  expect(await getUser(7)).toEqual({ id: 7, name: 'Sam' });
});
```

Good:

```ts
it('loads the user', async () => {
  const http = { get: vi.fn().mockResolvedValue({ id: 7, name: 'Sam' }) };
  expect(await new UserService(http).getUser(7)).toEqual({ id: 7, name: 'Sam' });
});
```

Fix: Call the real function and check what it returns. Give fixed replies only to the things it depends on.

### A test that checks only calls on mocks (warn)

Warn. Every assertion of the test checks a call on a mock (`toHaveBeenCalled`, `toHaveBeenCalledWith`, `sinon.assert.calledOnce`), in a test or file where a mock stands in for real code.

Bad:

```ts
it('places the order', async () => {
  await placeOrder(cart);
  expect(mailer.send).toHaveBeenCalledTimes(1);
});
```

Good:

```ts
it('places the order', async () => {
  const order = await placeOrder(cart);
  expect(order.status).toBe('placed');
  expect(mailer.send).toHaveBeenCalledTimes(1);
});
```

Fix: Also check a result: what the code returns, what it saves, or what the user sees.

### Every import of the file is mocked (warn)

Warn, once per file. Every module the file imports is mocked. Type imports and the test framework do not count. When the module under test is among them, only that case is reported.

Bad:

```ts
import { placeOrder } from '../src/orders';
import { charge } from '../src/payments';

jest.mock('../src/orders');
jest.mock('../src/payments');
```

Good:

```ts
import { placeOrder } from '../src/orders';
import { charge } from '../src/payments';

jest.mock('../src/payments');
```

Fix: Keep the module under test real. Mock only what is slow, random or outside your control.

### Every network request is faked (warn)

Warn. A `page.route` or `cy.intercept` on `**/*`, `**`, `*` or `/.*/` answers every request with a fixed reply, and the test then checks the page.

Bad:

```ts
await page.route('**/*', (route) => route.fulfill({ json: { items: [] } }));
await page.goto('https://www.saucedemo.com/cart.html');
await expect(page.getByTestId('cart-list')).toBeVisible();
```

Good:

```ts
await page.route('**/api/cart', (route) => route.fulfill({ json: { items: [] } }));
await page.goto('https://www.saucedemo.com/cart.html');
await expect(page.getByTestId('cart-list')).toBeVisible();
```

Fix: Fake only the requests this test is about, and let the others go to the real server or to a test server.

### Not reported

- A module mock that keeps the real module: `vi.importActual`, `jest.requireActual`, or `importOriginal` in the factory.
- A mock of something the code under test depends on.
- A test that watches the real code through a plain callback or a spy that calls through: `const onSave = vi.fn(); save(form, onSave); expect(onSave).toHaveBeenCalledWith(form)`.
- A fake for one endpoint, and a route handler that lets requests go on (`route.continue()`).
- The first two cases in a file whose module under test is not known. They need a file name that matches an import, or an entry in `subjectMap`.

### Options

```json
{ "rules": { "QCR-M001": { "subjectMap": { "tests/checkout/**": "../../src/checkout" } } } }
```

`subjectMap` (default none): for test files whose name does not match the module they test. The key is a glob for test files, and the value is the module as the test files import it.

Turn it off: `"rules": { "QCR-M001": "off" }` in the config, or `--disable QCR-M001` on the command line.

<a id="qcr-p001"></a>
## QCR-P001 `snapshot-only` (warn)

A test whose only assertions are snapshots. A snapshot passes on the first run whatever the output is, and when it fails it is often recorded again without a look.

### A test with only snapshot assertions

Snapshot matchers: `toMatchSnapshot`, `toMatchInlineSnapshot`, `toMatchFileSnapshot`, `toThrowErrorMatchingSnapshot`, `toThrowErrorMatchingInlineSnapshot` and the Playwright `toMatchAriaSnapshot`. One finding per test, on its first snapshot.

Bad:

```ts
it('renders the cart', () => {
  const html = renderCart([{ name: 'Backpack', price: 29.99 }]);
  expect(html).toMatchSnapshot();
});
```

Good:

```ts
it('renders the cart', () => {
  const html = renderCart([{ name: 'Backpack', price: 29.99 }]);
  expect(html).toContain('Backpack');
  expect(html).toContain('$29.99');
  expect(html).toMatchSnapshot();
});
```

Fix: Add assertions on the values that matter, so that the test says what must be true. Keep the snapshot next to them if it helps.

### An inline snapshot recorded empty

Reported for each empty inline snapshot, also when the test has other assertions.

Bad:

```ts
it('formats the receipt', () => {
  const receipt = formatReceipt({ items: ['backpack'], tax: 2.4 });
  expect(receipt.total).toBe('$32.39');
  expect(receipt.lines).toMatchInlineSnapshot();
});
```

Good:

```ts
it('formats the receipt', () => {
  const receipt = formatReceipt({ items: ['backpack'], tax: 2.4 });
  expect(receipt.total).toBe('$32.39');
  expect(receipt.lines).toMatchInlineSnapshot(`"Backpack $29.99, Tax $2.40"`);
});
```

Fix: Run the test once, read what the runner writes into the snapshot, and commit it only when it is right.

### A test with only visual checks (info)

Visual matchers: `toHaveScreenshot`, `toMatchImageSnapshot` and `matchImageSnapshot`. Visual testing is a valid choice, so this is info and never changes the verdict of a test. A test with a visual check and a snapshot is reported as snapshot-only (warn).

Bad:

```ts
test('shows the cart', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/cart.html');
  await expect(page).toHaveScreenshot('cart.png');
});
```

Good:

```ts
test('shows the cart', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/cart.html');
  await expect(page.getByTestId('cart-list')).toBeVisible();
  await expect(page).toHaveScreenshot('cart.png');
});
```

Fix: Look at each new baseline image before you commit it. One assertion on what the page must show makes a failure easier to read.

Not reported: a test with at least one assertion that is not a snapshot or a visual check.

Turn it off: `"rules": { "QCR-P001": "off" }` in the config, or `--disable QCR-P001` on the command line.

<a id="qcr-c001"></a>
## QCR-C001 `missing-cleanup` (warn)

State that a test or a hook takes hold of and never gives back. It leaks into the tests that run after it, and they pass or fail by the order of the run.

A thing counts as given back when the release is in the same test, or in an `afterEach` or `afterAll` hook of the same suite or of a suite around it. A hook in another suite does not count. An after hook at the top of the file covers every test in the file.

### Fake timers that are never switched back

`vi.useFakeTimers()`, `jest.useFakeTimers()` and `sinon.useFakeTimers()`, given back by `useRealTimers()` or `sinon.restore()`.

Bad:

```ts
it('uses the fixed date', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01'));
  expect(formatToday()).toBe('Jan 1, 2026');
});
```

Good:

```ts
afterEach(() => {
  vi.useRealTimers();
});

it('uses the fixed date', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01'));
  expect(formatToday()).toBe('Jan 1, 2026');
});
```

Fix: Switch back to real timers in an afterEach hook. A hook also runs when the test fails; a line at the end of the test does not.

### A spy or stub that is never restored

`vi.spyOn`, `jest.spyOn`, `sinon.spy`, `sinon.stub` and `mock.method`, given back by `mockRestore()`, `restore()`, `restoreAllMocks()` or `sinon.restore()`.

Bad:

```ts
it('logs the order', () => {
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  placeOrder({ id: 7 });
  expect(log).toHaveBeenCalledWith('order 7 placed');
});
```

Good:

```ts
afterEach(() => {
  jest.restoreAllMocks();
});

it('logs the order', () => {
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  placeOrder({ id: 7 });
  expect(log).toHaveBeenCalledWith('order 7 placed');
});
```

Fix: Restore every spy in an afterEach hook. If the runner config already does it (restoreMocks), set restoreMocksConfigured for this rule.

### An environment variable that is never set back

An assignment to `process.env.NAME`, or `vi.stubEnv(...)`. Given back by a second assignment or a `delete` in an after hook, or by `vi.unstubAllEnvs()`.

Bad:

```ts
it('uses the staging API', () => {
  process.env.API_URL = 'https://api.example.test';
  expect(apiUrl()).toBe('https://api.example.test');
});
```

Good:

```ts
const original = process.env.API_URL;

afterEach(() => {
  process.env.API_URL = original;
});

it('uses the staging API', () => {
  process.env.API_URL = 'https://api.example.test';
  expect(apiUrl()).toBe('https://api.example.test');
});
```

Fix: Set the variable back in an afterEach hook, or use the stub helper of the runner and undo it there.

### A global that is never put back

An assignment to a member of `globalThis`, `global`, `window` or `Date`, or `vi.stubGlobal(...)`. Given back by a second assignment or a `delete` in an after hook, or by `vi.unstubAllGlobals()`.

Bad:

```ts
it('loads the rates', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{"EUR":0.92}')));
  expect(await loadRates()).toEqual({ EUR: 0.92 });
});
```

Good:

```ts
afterEach(() => {
  vi.unstubAllGlobals();
});

it('loads the rates', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{"EUR":0.92}')));
  expect(await loadRates()).toEqual({ EUR: 0.92 });
});
```

Fix: Put the global back in an afterEach hook, or use the stub helper of the runner and undo it there.

### A browser, context, page or client that is never closed

`chromium.launch()`, `browser.newContext()`, `browser.newPage()` and `request.newContext()`, given back by `close()` or `dispose()`. A page of a context you open is closed with that context.

Bad:

```ts
test('opens the shop', async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://www.saucedemo.com');
  await expect(page).toHaveTitle('Swag Labs');
});
```

Good:

```ts
test('opens the shop', async ({ page }) => {
  await page.goto('https://www.saucedemo.com');
  await expect(page).toHaveTitle('Swag Labs');
});
```

Fix: Close it in an after hook, or let the test runner make it for you: a fixture is closed by the runner.

### Test data that is never deleted (info)

A test that makes a `POST` request (`request.post`, `axios.post`, `cy.request('POST', ...)`) and makes no `DELETE` request. This is info with low confidence: a `POST` is not always a create, and the tool cannot see what an after hook deletes. When the file has an after hook, nothing is reported.

Bad:

```ts
test('creates an order', async ({ request }) => {
  const response = await request.post('https://api.example.test/orders', { data: { item: 'backpack' } });
  expect(response.status()).toBe(201);
});
```

Good:

```ts
test('creates an order', async ({ request }) => {
  const response = await request.post('https://api.example.test/orders', { data: { item: 'backpack' } });
  expect(response.status()).toBe(201);
  const { id } = await response.json();
  await request.delete(`https://api.example.test/orders/${id}`);
});
```

Fix: Delete what the test creates, in the test or in an after hook, so that the next run starts from the same data.

### Not reported

- Playwright fixtures (`page`, `context`, `browser`, `request`) and a second tab of the fixture context. The runner closes them.
- Cypress `cy.clock()`, `cy.stub()` and `cy.spy()`. Cypress restores them after each test.
- `vi.mock(...)` and `jest.mock(...)`. A module mock belongs to the file.
- `jest.fn()` and `vi.fn()` on their own. They replace nothing.

### Options

```json
{ "rules": { "QCR-C001": { "restoreMocksConfigured": true } } }
```

`restoreMocksConfigured` (default false): set it to true when the runner config has `restoreMocks: true` (Jest or Vitest). Spies with no restore are then not reported. The tool does not read the runner config itself.

Turn it off: `"rules": { "QCR-C001": "off" }` in the config, or `--disable QCR-C001` on the command line.

<a id="qcr-x001"></a>
## QCR-X001 `parse-error` (info)

Reported once per file, in two cases:

- The file could not be parsed, so it was not reviewed. A file with a few syntax errors is still reviewed. This is for a file that is too broken, such as one with merge conflict markers all over it.
- The file is named like a test file (`cart.test.ts`, `login.cy.js`) and no test was found in it.

It never changes the exit code unless you run with `--fail-on info`.

Turn it off: `"rules": { "QCR-X001": "off" }` in the config, or `--disable QCR-X001` on the command line.

<a id="qcr-x002"></a>
## QCR-X002 `suppression-without-reason` (info)

A suppression comment that does not say why. It is ignored, so the finding it was written for is still reported.

Bad:

```ts
// qa-core-review-disable-next-line QCR-W001
await page.waitForTimeout(500);
```

Good:

```ts
// qa-core-review-disable-next-line QCR-W001 -- the animation has no event to wait for
await page.waitForTimeout(500);
```

Fix: Say why the rule does not apply here, after two dashes. A suppression with a reason is one that a reviewer can agree or disagree with.

See [Suppressing a finding](#suppressing-a-finding) for the three ways to suppress.

Turn it off: `"rules": { "QCR-X002": "off" }` in the config, or `--disable QCR-X002` on the command line.
