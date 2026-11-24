# Rules

Each rule has an id that never changes. A finding names the rule, the place, the evidence and a fix. Run `qa-core-review rules` for the list and `qa-core-review explain <ruleId>` for one rule with its examples.

This page covers the rules that exist so far. The examples are in TypeScript. The same rules run on JavaScript files. Python and Java examples are added with those adapters.

| Id | Name | Default | What it finds |
| --- | --- | --- | --- |
| [QCR-A001](#qcr-a001) | no-assertion | error | A test with no assertion. |
| [QCR-A002](#qcr-a002) | trivial-assertion | error | An assertion whose result is fixed by the code itself. |
| [QCR-A003](#qcr-a003) | cannot-fail-assertion | error | An assertion that looks real and cannot fail. |
| [QCR-A004](#qcr-a004) | conditional-assertion | warn | Every assertion sits inside a condition, a loop or a callback. |
| [QCR-X001](#qcr-x001) | parse-error | info | A file that cannot be parsed, or a test file with no test in it. |

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

A severity in the config applies to every finding of the rule. `languages` limits the rule to those languages.

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

<a id="qcr-x001"></a>
## QCR-X001 `parse-error` (info)

Reported once per file, in two cases:

- The file could not be parsed, so it was not reviewed. A file with a few syntax errors is still reviewed. This is for a file that is too broken, such as one with merge conflict markers all over it.
- The file is named like a test file (`cart.test.ts`, `login.cy.js`) and no test was found in it.

It never changes the exit code unless you run with `--fail-on info`.

Turn it off: `"rules": { "QCR-X001": "off" }` in the config, or `--disable QCR-X001` on the command line.
