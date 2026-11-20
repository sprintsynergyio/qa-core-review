# qa-core-review: Build Spec (v0.1.0)

> A "Plannotator for tests". `qa-core-review` reviews test code, especially tests written by AI coding agents, before it is merged. It flags tests that look green but check nothing, shows them in a local review page where a person approves, comments or rejects, and sends that feedback back to the agent as a ready-to-paste prompt.

This file is the full spec. `CLAUDE.md` holds the short standing rules. Read both before you write any code. Build the milestones in Section 16 in order, one milestone per branch and per pull request.

---

## 1. Facts you must not change

| Item | Value |
| --- | --- |
| Product name | `qa-core-review` |
| GitHub repo | `github.com/sprintsynergyio/qa-core-review` |
| npm package | `qa-core-review` (unscoped, like `qa-core-heal`, `qa-core-flaky` and `qa-core-verify`) |
| CLI command | `qa-core-review` |
| License | MIT, copyright "SprintSynergy" |
| Commit author | `SprintSynergy <usman@sprintsynergy.com>` |
| Default branch | `main`. Never push to it. Every change goes through a pull request. |
| Node | 22.6 or later (`engines.node: ">=22.6"`, `.nvmrc` contains `22`) |
| Module type | ESM (`"type": "module"`) |
| Language | TypeScript, compiled with `tsc` to `dist/` |
| Test runner | Node's built-in `node:test`, test files `tests/*.test.mjs` (the org convention; do not add vitest or jest as the runner) |
| Report folder | `.qa-core/review/` in the user's project (next to `.qa-core/verify/`) |
| Rule id prefix | `QCR-` |

Do not mention any competition or event in code, docs or commits. Do not use any client or company names in code, fixtures, docs or examples. Use generic names (`shop`, `cart`, `login`) or the public practice site SauceDemo (`https://www.saucedemo.com`), which the other repos already use.

---

## 2. The problem

AI coding agents (Claude Code, Cursor, Codex) now write a large share of test code. Those tests often pass while proving nothing:

- `expect(true).toBe(true)`, or no `expect` at all.
- `expect(page.locator('#btn')).toBeTruthy()`, which can never fail because a locator object is always truthy.
- `await page.waitForTimeout(3000)` instead of waiting for a real condition.
- `div:nth-child(3) > span.css-1x2y3z` selectors that break on the next UI change.
- `try { expect(...) } catch {}`, which hides the failure.
- `test.only` left in, which silently skips the rest of the suite.
- The module under test is itself mocked, so the test checks the mock.
- Only happy paths, no error or edge case.

Reviewers do not have time to read every AI-written test line by line, and linters check style, not whether a test can go red. Teams end up with a green suite they cannot trust.

## 3. Users

1. **Developers using AI agents** who want a quick gate after the agent writes tests, before they commit.
2. **QA engineers and SDETs** reviewing test pull requests.
3. **Engineering leads** who want a PR check that blocks hollow tests.

## 4. Goals for v0.1.0

1. Static review of Playwright, Jest and Vitest tests in JS and TS. No LLM, no API key, no network. Same input, same output.
2. The rule set in Section 9, each rule with fixtures and documented examples.
3. CLI with `pretty`, `json`, `sarif` and `markdown` output, stable exit codes, a config file, and a `--diff` mode that reviews only changed tests.
4. A local review page on `127.0.0.1` where each test is shown with inline findings and the user can approve, comment or reject. The result is exported as a prompt for the AI agent.
5. Claude Code integration: a hook that reviews test files after the agent edits them and feeds findings back, a slash command, and an `init` command that sets it up. Written setup for Cursor and Codex.
6. An optional LLM deep review (Anthropic or OpenAI with the user's own key, or Claude Code itself with no key). Off by default.
7. A GitHub Action that posts one sticky PR comment and can upload SARIF to code scanning.
8. 90% or higher line coverage, CI green on Linux, Windows and macOS.

## 5. Non-goals for v0.1.0

- Running the tests. That is what `qa-core-verify` (runtime checks) and `qa-core-prcheck` do. `qa-core-review` only reads code.
- Auto-fixing code. It suggests fixes and writes a prompt; the agent or the person makes the change.
- pytest, Selenium (Java/Python), Cypress, Mocha. These are the v2 roadmap (Section 19).
- A hosted service, accounts, or telemetry. Nothing is sent anywhere unless LLM mode is turned on.
- A VS Code extension.

## 6. How it relates to the other SprintSynergy agents

| Tool | What it does | Relationship |
| --- | --- | --- |
| `qa-core-verify` | Audits a Playwright suite and, with runtime checks, proves tests go red when the feature breaks | Complementary. `review` is the fast, static, human-in-the-loop gate while code is being written, and it also covers Jest and Vitest. `verify` is the deeper runtime proof. Where a rule overlaps, `docs/rules.md` lists the matching `QCV-` id ("Also in qa-core-verify" column) so the two tools read the same. Do not add `qa-core-verify` as a dependency. |
| `qa-core-prcheck` | Picks and runs the tests a PR can affect, posts a sticky comment | `review --diff` output is designed to be embedded in the prcheck summary (Section 13.3). |
| `qa-core-heal` | Repairs broken Playwright locators | The `QCR-S001` brittle selector message points to `qa-core-heal` for locator repair. |
| `qa-core-flaky` | Triages flaky tests | The `QCR-W001` hard wait message mentions it as a next step for timing problems. |

Match these repos' conventions: `package.json` shape (author `SprintSynergy`, homepage and bugs URLs under `github.com/sprintsynergyio/...`), `tsconfig.build.json`, a `schemas/` folder with JSON Schemas, `skill/SKILL.md`, `evals/`, `scripts/pack-smoke.mjs`, `CHANGELOG.md`, and a README that shows real, copied CLI output with the date it was captured. Some older `package.json` files in the org still point at an old GitHub org name. Always use `sprintsynergyio`.

---

## 7. Architecture

### 7.1 Pipeline

```
paths / --diff base
   -> discover files (globs + config include/exclude, or git diff)
   -> parse each file with the TypeScript compiler API (ts.createSourceFile, no type checker)
   -> detect framework per file (playwright | jest | vitest | unknown)
   -> extract a TestUnit tree (describe blocks, tests, hooks, assertions, calls)
   -> run enabled rules on each TestUnit and file -> Finding[]
   -> apply inline suppressions and config severity overrides
   -> (optional) LLM deep review adds Finding[] with source "llm"
   -> filter to changed tests when --diff
   -> Report -> reporter (pretty | json | sarif | markdown) and/or review UI
   -> exit code
```

Use the TypeScript compiler API directly (`typescript` as a runtime dependency, same as `qa-core-verify`). Do not add ts-morph. `ts.createSourceFile` with the `ScriptKind` chosen from the file extension handles `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.mts`, `.cts`.

### 7.2 Dependencies

Runtime: `typescript` only. Use Node built-ins for everything else: `node:http` for the UI server, `node:child_process` for git, `node:crypto` for hashes, global `fetch` for LLM and GitHub calls, `node:util` `parseArgs` for flags. Glob matching: write a small glob-to-RegExp helper in `src/util/glob.ts` (support `**`, `*`, `?`, `{a,b}`), because `fs.glob` is not stable on Node 22.6. No UI framework: the review page is plain HTML, CSS and vanilla JS in `ui/`.

Dev: `typescript`, `@types/node`, `c8` (coverage), `ajv` and `ajv-formats` (schema tests).

### 7.3 Folder structure

```
qa-core-review/
  .github/
    workflows/ci.yml            # typecheck, lint, coverage, eval, pack smoke on 3 OSes
    workflows/self-review.yml   # runs the action on this repo's own PRs (Linux)
    PULL_REQUEST_TEMPLATE.md
  action.yml                    # composite GitHub Action
  src/
    cli.ts                      # entry, bin: dist/cli.js (starts with #!/usr/bin/env node)
    index.ts                    # public API: review(), types
    version.ts
    config/   load.ts  defaults.ts
    discover/ files.ts  diff.ts
    parse/    source.ts  framework.ts  extract.ts  ast-utils.ts
    rules/
      index.ts                  # registry: id -> Rule
      types.ts                  # Rule, Finding, TestUnit, Report
      qcr-a001-no-assertion.ts
      qcr-a002-trivial-assertion.ts
      qcr-a003-cannot-fail.ts
      qcr-a004-conditional-assertion.ts
      qcr-w001-hard-wait.ts
      qcr-s001-brittle-selector.ts
      qcr-e001-swallowed-error.ts
      qcr-f001-focused-test.ts
      qcr-f002-skipped-test.ts
      qcr-d001-duplicate-test.ts
      qcr-n001-missing-negative-case.ts
      qcr-m001-over-mocking.ts
      qcr-p001-snapshot-only.ts
      qcr-c001-missing-cleanup.ts
    engine/   run.ts  suppress.ts  fingerprint.ts  verdict.ts
    report/   pretty.ts  json.ts  sarif.ts  markdown.ts
    ui/       server.ts  session.ts  feedback.ts
    llm/      index.ts  prompt.ts  anthropic.ts  openai.ts  parse.ts  redact.ts
    integrations/ claude.ts  cursor.ts  codex.ts  github.ts
    util/     glob.ts  git.ts  paths.ts  hash.ts  term.ts
  ui/         index.html  app.js  styles.css
  schemas/    config.schema.json  report.schema.json  llm-output.schema.json
  skill/      SKILL.md                     # Claude Code skill, like qa-core-heal/skill
  templates/
    claude/commands/qa-review.md
    cursor/rules/qa-core-review.mdc
    codex/AGENTS.snippet.md
  docs/       rules.md  config.md  integrations.md  llm.md  github-action.md  privacy.md  prcheck-integration.md
  tests/      *.test.mjs  helpers/  fixtures/llm/  schemas/
  fixtures/
    rules/<rule-id>/bad/*       # files with // expect: markers
    rules/<rule-id>/good/*
    projects/                   # small multi-file projects for discover/diff/e2e tests
  evals/      corpus/  labels.json  run.mjs
  example-project/
    saucedemo/                  # AI-style Playwright specs for the demo
    unit/                       # small Vitest + Jest sample (cart.ts + tests)
  scripts/    pack-smoke.mjs  check-text.mjs  record-demo.mjs
  CHANGELOG.md  LICENSE  README.md  CLAUDE.md  SPEC.md
  package.json  tsconfig.json  tsconfig.build.json  .nvmrc  .gitignore  .gitattributes
```

`.gitattributes` must set `* text=auto eol=lf` so fixture line numbers match on Windows.

---

## 8. Data model

Define these in `src/rules/types.ts`, export them from `src/index.ts`, and mirror them in `schemas/report.schema.json` (JSON Schema draft 2020-12). `tests/schema.test.mjs` validates real reports against the schema with ajv.

```ts
export type Severity = 'error' | 'warn' | 'info';
export type Framework = 'playwright' | 'jest' | 'vitest' | 'unknown';
export type Source = 'static' | 'llm';
export type Verdict = 'pass' | 'review' | 'fail';            // per test
export type Decision = 'pending' | 'approved' | 'rejected';  // set in the UI

export interface Location {
  file: string;          // path relative to the project root, always '/' separators
  startLine: number;     // 1-based
  startColumn: number;   // 1-based
  endLine: number;
  endColumn: number;
}

export interface Finding {
  id: string;            // fingerprint, see 8.1
  ruleId: string;        // 'QCR-A001'
  ruleName: string;      // 'no-assertion'
  severity: Severity;
  source: Source;
  message: string;       // one sentence, plain English, what is wrong
  evidence: string;      // the exact code or fact that triggered it, max 200 chars
  fix: string;           // one or two sentences, what to do instead
  goodExample?: string;  // short code snippet
  location: Location;
  testId: string | null; // TestUnit.id, null for file-level findings
  confidence: 'high' | 'medium' | 'low';
  suppressed: boolean;
  docsUrl: string;       // https://github.com/sprintsynergyio/qa-core-review/blob/main/docs/rules.md#qcr-a001
}

export interface TestUnit {
  id: string;            // sha1(file + '\0' + fullTitle + '\0' + occurrenceIndex), first 12 hex chars
  file: string;
  framework: Framework;
  title: string;
  fullTitle: string;     // 'describe > describe > test'
  kind: 'test' | 'it';
  modifiers: Array<'only' | 'skip' | 'fixme' | 'todo' | 'fail' | 'concurrent' | 'each'>;
  location: Location;    // the whole call expression
  bodyLocation: Location;
  assertionCount: number;
  verdict: Verdict;      // 'fail' if any error, 'review' if any warn, else 'pass'; info does not lower it
  findingIds: string[];
}

export interface FileResult {
  file: string;
  framework: Framework;
  parseError?: string;
  tests: TestUnit[];
}

export interface Report {
  schemaVersion: 1;
  tool: { name: 'qa-core-review'; version: string };
  createdAt: string;     // ISO 8601 UTC
  root: string;          // absolute path, display only
  mode: { diffBase: string | null; llm: 'off' | 'anthropic' | 'openai' | 'claude-code' };
  rulesRun: string[];
  files: FileResult[];
  findings: Finding[];   // sorted by file, then startLine, then ruleId
  summary: {
    files: number; tests: number;
    pass: number; review: number; fail: number;
    errors: number; warnings: number; infos: number;
    suppressed: number;
  };
}
```

### 8.1 Fingerprint

`Finding.id = sha1(ruleId + '\0' + file + '\0' + (testFullTitle ?? '') + '\0' + normalizedEvidence)`, first 16 hex chars. `normalizedEvidence` collapses whitespace. It must not include line numbers, so a decision made in the UI survives unrelated edits above the test.

### 8.2 Review session (UI)

Saved to `.qa-core/review/session.json`:

```ts
export interface ReviewSession {
  schemaVersion: 1;
  reportCreatedAt: string;
  tests: Record<string /* testId */, {
    decision: Decision;
    comment: string;
    findings: Record<string /* findingId */, { dismissed: boolean; comment: string }>;
  }>;
  generalComment: string;
  finishedAt: string | null;
  outcome: 'approved' | 'changes-requested' | null;
}
```

---

## 9. Rules (v1)

Every rule:

- Lives in its own file `src/rules/qcr-xxxx-<name>.ts` and exports `{ id, name, defaultSeverity, frameworks, description, check(ctx) }`.
- Has at least 3 bad fixtures and 3 good fixtures in `fixtures/rules/<id>/`, covering Playwright and at least one of Jest or Vitest where the rule applies.
- Is documented in `docs/rules.md` with an anchor, the bad and good examples below, and how to disable it.
- Must not fire on any file in any `fixtures/rules/*/good/` folder.

**Fixture convention:** each bad fixture marks every expected finding with a trailing comment on the line where the finding starts: `// expect: QCR-A002` (comma-separate several ids). A shared helper `tests/helpers/fixtures.mjs` runs the engine on every fixture and asserts that the set of `(ruleId, line)` pairs equals the set of markers. Good fixtures have no markers, so they must produce no findings from any rule.

### 9.0 Shared detection helpers (`src/parse/ast-utils.ts`)

- **Test call:** `test(...)`, `it(...)`, `describe(...)`, `test.describe(...)`, modifiers `.only .skip .fixme .todo .fail .concurrent .each(...)(...)`, `test.describe.serial/parallel`, and Jest aliases `fit fdescribe xit xtest xdescribe`. The test function is the last function-like argument.
- **Assertion:** a call chain whose root is `expect(...)` (including `expect.soft`, `expect.poll`, `.not.x`, `.resolves.x`, `.rejects.x`), `assert(...)`, `assert.*(...)`, Chai `expect`/`should` chains, `expect.assertions(n)`, `expect.hasAssertions()`, plus any helper name in config `assertionHelpers`. A function defined in the same file whose body contains an assertion also counts when called (one level deep).
- **Playwright web-first matchers:** `toBeVisible toBeHidden toHaveText toContainText toHaveValue toHaveValues toHaveURL toHaveTitle toHaveCount toBeEnabled toBeDisabled toBeChecked toHaveAttribute toHaveClass toHaveCSS toHaveScreenshot toBeAttached toBeEditable toBeFocused toBeEmpty toHaveId toHaveJSProperty toHaveAccessibleName toHaveAccessibleDescription toHaveRole toBeInViewport toBeOK toMatchAriaSnapshot`.
- **Locator expression:** a call of `locator getByRole getByTestId getByText getByLabel getByPlaceholder getByAltText getByTitle frameLocator first last nth filter` on `page`, a frame, or another locator, or a variable assigned from one.

### 9.1 QCR-A001 `no-assertion` (error)

**Detects:** a test body with zero assertions (helpers one level deep count). Skipped and `todo` tests are ignored.

**Detection:** count assertions in the test function body using 9.0. If 0 and the body has at least one statement, report at the test title.

Bad:
```ts
test('user can log in', async ({ page }) => {
  await page.goto('https://www.saucedemo.com');
  await page.getByPlaceholder('Username').fill('standard_user');
  await page.getByPlaceholder('Password').fill('secret_sauce');
  await page.getByRole('button', { name: 'Login' }).click();
});
```
Good:
```ts
test('user can log in', async ({ page }) => {
  await page.goto('https://www.saucedemo.com');
  await page.getByPlaceholder('Username').fill('standard_user');
  await page.getByPlaceholder('Password').fill('secret_sauce');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/inventory\.html/);
  await expect(page.getByText('Products')).toBeVisible();
});
```
Fix text: "Add an assertion that checks the result of the action, for example the URL or a visible element."

### 9.2 QCR-A002 `trivial-assertion` (error)

**Detects:** assertions whose result is fixed by the code itself.

**Detection:** `expect(X).<matcher>(Y)` where:
- `X` is a literal (`true`, `false`, number, string, `null`, `undefined`, `[]`, `{}`) and the matcher is any of `toBe toEqual toStrictEqual toBeTruthy toBeFalsy toBeDefined toBeNull toBeUndefined`; or
- `X` and `Y` are the same expression after whitespace normalization (`expect(a).toBe(a)`, `expect(res.status).toEqual(res.status)`); or
- `assert(true)`, `assert.ok(1)`, `assert.equal(x, x)`, `assert.strictEqual(x, x)`.

Bad:
```ts
it('adds items to the cart', () => {
  addToCart(cart, item);
  expect(true).toBe(true);
});
```
Good:
```ts
it('adds items to the cart', () => {
  addToCart(cart, item);
  expect(cart.items).toContainEqual(item);
});
```

### 9.3 QCR-A003 `cannot-fail-assertion` (error)

**Detects:** assertions that look real but cannot go red. Each sub-case uses this rule id with its own message.

1. `expect(<locator expression>)` with `toBeTruthy()`, `toBeDefined()`, `not.toBeNull()` or `not.toBeUndefined()`. A Locator object always exists. Fix: `await expect(locator).toBeVisible()` or `toHaveCount(n)`.
2. A Playwright web-first matcher (or `expect.poll`) that is not awaited, returned, or passed to `Promise.all`. The check runs after the test ends or never.
3. `expect(x)` with no matcher call (bare expression statement).
4. A matcher accessed but not called: `expect(x).toBeTruthy;`.
5. Always-true numeric checks: a `.length` or `count()` value with `toBeGreaterThanOrEqual(0)` or `not.toBeLessThan(0)`.
6. An assertion after an unconditional `return` or `throw` in the same block (unreachable).
7. Jest/Vitest: `expect(promise).resolves...` or `.rejects...` not awaited or returned.

Bad:
```ts
test('checkout button is shown', async ({ page }) => {
  await page.goto('/cart.html');
  expect(page.locator('#checkout')).toBeTruthy();
  expect(page.getByRole('button', { name: 'Checkout' })).toBeVisible();
});
```
Good:
```ts
test('checkout button is shown', async ({ page }) => {
  await page.goto('/cart.html');
  await expect(page.getByRole('button', { name: 'Checkout' })).toBeVisible();
});
```

### 9.4 QCR-A004 `conditional-assertion` (warn)

**Detects:** every assertion of a test is inside an `if`, `switch`, ternary, `&&`/`||` short-circuit, loop body or `.forEach`/`.map` callback, so the test can pass with zero checks.

**Detection:** if all assertions have an ancestor of those kinds inside the test body, report at the first one. Not reported when the test also has `expect.assertions(n)`, `expect.hasAssertions()`, or an assertion outside the branch or loop (for example `expect(rows).toHaveLength(3)` before the loop).

Bad:
```ts
test('error shows for locked user', async ({ page }) => {
  const error = page.getByTestId('error');
  if (await error.isVisible()) {
    await expect(error).toContainText('locked out');
  }
});
```
Good:
```ts
test('error shows for locked user', async ({ page }) => {
  await expect(page.getByTestId('error')).toContainText('locked out');
});
```

### 9.5 QCR-W001 `hard-wait` (warn)

**Detects:** fixed sleeps.

**Detection:** `page.waitForTimeout(n)` or `frame.waitForTimeout(n)`; `await new Promise(r => setTimeout(r, n))`; awaited calls to functions named `sleep`, `delay`, `wait` or `pause` with a numeric argument; `browser.pause(n)`. Not reported: fake-timer APIs (`vi.advanceTimersByTime`, `jest.advanceTimersByTime`), `setTimeout` that is not awaited, and waits at or below config `rules.QCR-W001.maxMs` (default 0). The message includes the milliseconds when they are a literal.

Bad:
```ts
await page.getByRole('button', { name: 'Add to cart' }).click();
await page.waitForTimeout(3000);
expect(await page.locator('.shopping_cart_badge').textContent()).toBe('1');
```
Good:
```ts
await page.getByRole('button', { name: 'Add to cart' }).click();
await expect(page.getByTestId('shopping-cart-badge')).toHaveText('1');
```
Fix text: "Wait for a condition instead: a web-first assertion, waitForResponse or waitForURL. For timing failures that come and go, see qa-core-flaky."

### 9.6 QCR-S001 `brittle-selector` (warn; info for `.nth()`, `.first()`, `.last()`)

**Detects:** selectors that depend on layout or generated names.

**Detection:** check string literal and no-substitution template literal selector arguments of `locator()`, `page.$()`, `page.$$()`, `$eval`, `$$eval`, `waitForSelector()`, `click(selector)`, `fill(selector, ...)`, `frameLocator()`, `querySelector()`, `querySelectorAll()`. Flag when the selector:
- contains `:nth-child(`, `:nth-of-type(`, `:nth-last-child(` or Playwright `>> nth=`;
- is XPath (starts with `/`, `//`, `(//` or `xpath=`) and either starts with `/html`, has 4 or more steps, or uses a positional index like `[3]`;
- has a class or id matching a generated pattern: `css-[a-z0-9]{4,}`, `sc-[a-zA-Z]{5,}`, `jss\d+`, `makeStyles-`, `_[a-zA-Z0-9]{5}_\d*` (CSS modules hash), `ng-tns-c\d+`, `ember\d+`, or a token of 6+ characters mixing letters with 3+ digits;
- chains 4 or more CSS combinators (`>`, space, `+`, `~`).
Also flag as info: `.nth(k)` with a literal `k > 0`, and `.first()` / `.last()` on a locator that is not built with `getByRole`, `getByTestId` or `getByLabel`.
Options: `rules.QCR-S001.allowPatterns` (array of regex strings) and top-level `testIdAttribute` (default `data-testid`, so `[data-testid=...]` is never flagged).

Bad:
```ts
await page.locator('#root > div > div:nth-child(2) > div.css-1q2w3e4 > button').click();
await page.locator('//html/body/div[1]/div/div[2]/button[3]').click();
```
Good:
```ts
await page.getByRole('button', { name: 'Add to cart' }).click();
await page.getByTestId('add-to-cart-sauce-labs-backpack').click();
```
Fix text: "Prefer getByRole, getByLabel or getByTestId. To repair many broken locators at once, see qa-core-heal."

### 9.7 QCR-E001 `swallowed-error` (error)

**Detects:** assertion failures that are caught and ignored.

**Detection:**
- A `try` block containing an assertion (directly or one helper deep) whose `catch` clause does not rethrow, does not call `expect.fail`, `assert.fail`, `fail()` or `test.fail()`, and has no assertion of its own. `try/finally` without `catch` is fine.
- `.catch(() => {})`, `.catch(() => undefined)`, `.catch(() => null)`, `.catch(console.log)`, `.catch(console.error)` or `.catch(noop)` attached to an assertion promise, or to a Playwright action in a test whose only assertions are in that chain.
- `expect.soft(...)` is not reported.

Bad:
```ts
test('order total is correct', async ({ page }) => {
  try {
    await expect(page.getByTestId('total')).toHaveText('$32.39');
  } catch (e) {
    console.log('total did not match', e);
  }
});
```
Good:
```ts
test('order total is correct', async ({ page }) => {
  await expect(page.getByTestId('total')).toHaveText('$32.39');
});
```

### 9.8 QCR-F001 `focused-test` (error) and QCR-F002 `skipped-test` (warn)

**Detection:** F001: `test.only`, `it.only`, `describe.only`, `test.describe.only`, `fit`, `fdescribe`. F002: `test.skip`, `it.skip`, `describe.skip`, `test.describe.skip`, `xit`, `xtest`, `xdescribe`, `test.fixme`, and a bare `test.skip()` inside a body. A `test.skip(condition, 'reason')` call with both a condition and a reason string is not reported. The F002 message includes the reason when one is given.

Bad:
```ts
test.only('adds item to cart', async ({ page }) => { /* ... */ });
it.skip('rejects an empty password', () => { /* ... */ });
```
Good:
```ts
test('adds item to cart', async ({ page }) => { /* ... */ });
test.skip(process.platform === 'win32', 'File picker is not supported on Windows CI');
```

### 9.9 QCR-D001 `duplicate-test` (warn)

**Detects:** copied tests.

**Detection:** print each test body with `ts.createPrinter({ removeComments: true })` to normalize formatting and comments, then sha1 it. Two or more tests with the same hash, in the same file or across reviewed files, are duplicates: report every copy after the first, with `evidence` naming the first copy's file and line. Also report two tests with the same `fullTitle` in the same file. Bodies with fewer than 2 statements are ignored. Tests generated from one call inside a loop or `.each` are one test, not duplicates.

Bad:
```ts
test('login works', async ({ page }) => { await login(page); await expect(page).toHaveURL(/inventory/); });
test('login works for standard user', async ({ page }) => { await login(page); await expect(page).toHaveURL(/inventory/); });
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

### 9.10 QCR-N001 `missing-negative-case` (info, confidence low)

**Detects:** a describe block (or file) where every test is a happy path. Heuristic only; LLM mode adds specific missing cases.

**Detection:** group tests by their innermost `describe`, or by file when there is none. Report once per group, at the describe title, when the group has 2 or more tests and none of them:
- has a title matching `/(invalid|error|fail|reject|wrong|empty|missing|denied|unauthori[sz]ed|forbidden|expired|locked|limit|max|min|zero|negative|boundary|overflow|timeout|not found|404|401|403|500|edge|null|undefined)/i`;
- uses `toThrow`, `toThrowError`, `.rejects`, or asserts a status of 400 or more (`toBe(4xx|5xx)`, `status()).toBe(4..)`);
- asserts on text containing `error`, `invalid` or `required`.
The message suggests two or three negative cases built from the group title (group "checkout" gives "checkout with an empty cart" and "checkout with a missing postal code"; generic fallbacks: "empty input", "invalid input", "a server error").

Bad:
```ts
describe('applyDiscount', () => {
  it('applies 10% off', () => { expect(applyDiscount(100, 'SAVE10')).toBe(90); });
  it('applies 20% off', () => { expect(applyDiscount(100, 'SAVE20')).toBe(80); });
});
```
Good:
```ts
describe('applyDiscount', () => {
  it('applies 10% off', () => { expect(applyDiscount(100, 'SAVE10')).toBe(90); });
  it('rejects an unknown code', () => { expect(() => applyDiscount(100, 'NOPE')).toThrow('Invalid code'); });
  it('never goes below zero', () => { expect(applyDiscount(5, 'SAVE100')).toBe(0); });
});
```

### 9.11 QCR-M001 `over-mocking` (error when the subject is mocked, warn otherwise)

**Detects:** the code under test is replaced by a mock, so the test checks the mock.

**Detection:**
1. **Subject mocked (error):** the subject module is the import whose path ends with the test file's base name (`cart.test.ts` -> `./cart`, `../src/cart`, `@/cart`), or the path given in `rules.QCR-M001.subjectMap` (test glob -> module path). Report a `vi.mock(path)`, `jest.mock(path)` or `jest.unstable_mockModule(path)` on that path unless its factory spreads `vi.importActual` / `jest.requireActual`.
2. **Function under test stubbed (error):** `vi.spyOn(obj, 'fn')` or `jest.spyOn(obj, 'fn')` with `mockReturnValue`, `mockImplementation`, `mockResolvedValue` (or their `Once` forms), then `obj.fn` is called and its result asserted in the same test.
3. **Only mock assertions (warn):** every assertion in the test is `toHaveBeenCalled`, `toHaveBeenCalledWith`, `toHaveBeenCalledTimes`, `toHaveBeenNthCalledWith`, `toHaveBeenLastCalledWith` or `toHaveReturned*`.
4. **Everything mocked (warn, file level):** every import that is not a type import or a test framework import is mocked.
5. **Playwright full fake (warn):** `page.route('**/*', ...)` or `context.route('**/*', ...)` that calls `route.fulfill`, in a test that then asserts on page content.

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
vi.mock('./tax', () => ({ taxRate: () => 0 })); // mock the dependency, not the subject
it('returns the total', () => {
  expect(getTotal([{ price: 40 }, { price: 2 }])).toBe(42);
});
```

### 9.12 QCR-P001 `snapshot-only` (warn for Jest/Vitest, info for Playwright screenshots)

**Detects:** a test whose only assertions are snapshots, which pass on the first run and are often re-recorded without review.

**Detection:** all assertions in the test are `toMatchSnapshot`, `toMatchInlineSnapshot`, `toMatchFileSnapshot`, `toThrowErrorMatchingSnapshot`, `toThrowErrorMatchingInlineSnapshot`, `toMatchAriaSnapshot` or `toHaveScreenshot`. Screenshot-only Playwright tests are info, because visual tests are a valid choice. Also flag (warn) `toMatchInlineSnapshot()` called with no argument, which records whatever the code returns today.

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

### 9.13 QCR-C001 `missing-cleanup` (warn)

**Detects:** state a test creates and never restores, which leaks into other tests.

**Detection (file scope; a matching restore in the same test, in an `afterEach`/`afterAll`, or a config flag clears the finding):**
- `vi.spyOn` / `jest.spyOn` with no `mockRestore()`, no `vi.restoreAllMocks()` / `jest.restoreAllMocks()` in a hook, and `rules.QCR-C001.restoreMocksConfigured` not `true`.
- `vi.useFakeTimers()` / `jest.useFakeTimers()` with no `useRealTimers()`.
- `vi.stubGlobal` / `vi.stubEnv` with no `unstubAllGlobals` / `unstubAllEnvs`.
- Assignment to `process.env.X`, `globalThis.X`, `window.X` or `Date.now` with no restore of the same target.
- Playwright: `browser.newContext()`, `browser.newPage()`, `chromium.launch()` / `firefox.launch()` / `webkit.launch()` or `request.newContext()` inside a test or `beforeAll` with no matching `.close()` / `.dispose()`. Built-in fixtures (`page`, `context`, `request`) are fine.
- Playwright API data (info, confidence low): a test calls `request.post` or `request.put` and there is no `request.delete` in the test or an after hook.

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
afterEach(() => { vi.useRealTimers(); });
it('uses the fixed date', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01'));
  expect(formatToday()).toBe('Jan 1, 2026');
});
```

### 9.14 QCR-X001 `parse-error` (info) and QCR-X002 `suppression-without-reason` (info)

A file that cannot be parsed, or that has no recognisable tests, gets one X001 finding and is skipped. It never crashes the run. X002 is described in 9.16.

### 9.15 Rule summary (use this table in the README and docs/rules.md)

| Id | Name | Default | Also in qa-core-verify |
| --- | --- | --- | --- |
| QCR-A001 | no-assertion | error | QCV-W001 |
| QCR-A002 | trivial-assertion | error | QCV-W004 |
| QCR-A003 | cannot-fail-assertion | error | QCV-W002, QCV-W003 |
| QCR-A004 | conditional-assertion | warn | QCV-W007 |
| QCR-W001 | hard-wait | warn | QCV-W010 |
| QCR-S001 | brittle-selector | warn | locator checks |
| QCR-E001 | swallowed-error | error | QCV-W008 |
| QCR-F001 | focused-test | error | QCV-W009 |
| QCR-F002 | skipped-test | warn | QCV-W009 |
| QCR-D001 | duplicate-test | warn | none |
| QCR-N001 | missing-negative-case | info | none |
| QCR-M001 | over-mocking | error / warn | none |
| QCR-P001 | snapshot-only | warn / info | none |
| QCR-C001 | missing-cleanup | warn | none |
| QCR-X001 | parse-error | info | QCV-W000 (similar) |
| QCR-X002 | suppression-without-reason | info | none |

Before writing `docs/rules.md`, open `https://github.com/sprintsynergyio/qa-core-verify/blob/main/docs/rules.md` and correct the last column if a `QCV-` id means something different.

### 9.16 Inline suppression

- `// qa-core-review-disable-next-line QCR-W001 -- reason` disables the listed rules (comma separated) on the next line.
- `// qa-core-review-disable QCR-S001 -- reason` before the first statement of a file disables those rules for the whole file.
- A reason after `--` is required. A suppression with no reason is ignored and produces `QCR-X002`.
- Suppressed findings get `suppressed: true`, are counted in `summary.suppressed`, appear only in JSON output, and never affect the exit code.

---

## 10. CLI

### 10.1 Commands

```
qa-core-review review [paths...] [flags]      # default command; `qa-core-review [paths...]` is the same
qa-core-review ui [paths...] [flags]          # review, then open the local review page
qa-core-review init [--claude] [--cursor] [--codex] [--config] [--force]
qa-core-review rules                          # list rules, default severity, one-line description
qa-core-review explain <ruleId>               # print the rule's doc with bad and good examples
qa-core-review hook claude-post-edit          # reads Claude Code hook JSON on stdin (Section 13.1)
qa-core-review hook claude-stop               # reads Claude Code hook JSON on stdin (Section 13.1)
qa-core-review comment --report <file>        # post or update the sticky PR comment (Section 13.3)
qa-core-review --version | -v
qa-core-review --help | -h                    # also `qa-core-review <command> --help`
```

With no paths, `review` uses config `include`. Paths can be files, folders or globs. `init` with no flag writes only `qa-core-review.config.json` (same as `--config`).

### 10.2 Flags for `review` and `ui`

| Flag | Default | Meaning |
| --- | --- | --- |
| `--diff <base>` | off | Review only tests whose lines changed in `git diff <base>...HEAD`, plus uncommitted changes and untracked test files. Findings outside changed tests are dropped, except F001, which is always reported for changed files. `--diff HEAD` means "only uncommitted changes". |
| `--staged` | off | Like `--diff`, using `git diff --cached` (for pre-commit hooks). |
| `--format <list>` | `pretty` | Comma list of `pretty,json,sarif,markdown`. |
| `--output <dir>` | `.qa-core/review` | Folder for `report.json`, `report.sarif`, `report.md`. `report.json` is always written. |
| `--stdout <format>` | none | Print `json`, `sarif` or `markdown` to stdout instead of the pretty view (for piping). |
| `--fail-on <level>` | `error` | `error`, `warn`, `info` or `never`. Exit 1 when any unsuppressed finding is at or above the level. |
| `--rules <list>` | all enabled | Only run these rule ids. |
| `--disable <list>` | none | Skip these rule ids. |
| `--framework <name>` | auto | Force `playwright`, `jest` or `vitest`. |
| `--config <file>` | auto | Config path. |
| `--root <dir>` | cwd | Project root. Report paths are relative to it. |
| `--llm <mode>` | `off` | `off`, `anthropic`, `openai` or `claude-code` (Section 14). |
| `--llm-model <id>` | config | Model id for the provider. |
| `--yes-send-code` | off | Confirms code may be sent in `anthropic`/`openai` mode in a non-interactive run. |
| `--max-findings <n>` | 200 | Stop printing after n findings in pretty output (JSON keeps all). |
| `--no-color` | auto | Also honours `NO_COLOR` and non-TTY output. |
| `--quiet` | off | Pretty output prints only the summary line. |
| `--port <n>` | random free port | `ui` only. |
| `--no-open` | off | `ui` only. Print the URL instead of opening a browser. |
| `--gate` | off | `ui` only. Block until the user clicks Finish, print the feedback prompt to stdout, exit 0 (approved) or 1 (changes requested). |

Use `node:util` `parseArgs` with `strict: true`. An unknown flag exits 2 with a one-line error and "Run qa-core-review --help".

### 10.3 Exit codes

| Code | Meaning |
| --- | --- |
| 0 | No unsuppressed finding at or above `--fail-on` (or gate approved). |
| 1 | Findings at or above `--fail-on` (or gate: changes requested). |
| 2 | Usage or config error: bad flag, invalid config, path not found, not a git repo or bad ref with `--diff`. |
| 3 | Internal error. Print "Internal error, please open an issue at https://github.com/sprintsynergyio/qa-core-review/issues", plus the stack when `QA_CORE_REVIEW_DEBUG=1`. |

A parse error in one test file is not exit 2. It is a `QCR-X001` finding.

### 10.4 Pretty output (exact layout)

```text
qa-core-review 0.1.0 · 3 files · 9 tests · static rules

fail  tests/cart.spec.ts:12  adds item to cart
  QCR-W001  warn   14:3  Hard wait of 3000 ms.
    Evidence: await page.waitForTimeout(3000)
    Fix: Wait for a condition instead, for example await expect(badge).toHaveText('1').
  QCR-A003  error  15:3  Locator objects are always truthy, so this check cannot fail.
    Evidence: expect(page.locator('#checkout')).toBeTruthy()
    Fix: Use await expect(locator).toBeVisible().

review  tests/login.spec.ts:4  user can log in
  QCR-S001  warn   7:9  Selector depends on layout: div:nth-child(2).
    Evidence: page.locator('#root > div:nth-child(2) > button')
    Fix: Prefer getByRole, getByLabel or getByTestId.

pass  tests/inventory.spec.ts:3  sorts by price

Summary: 5 pass, 2 review, 2 fail. 3 errors, 4 warnings, 1 info. 0 suppressed.
Reports: .qa-core/review/report.json
Next: run `npx qa-core-review ui` to approve or reject each test.
```

Order: fail tests, then review, then pass, each sorted by file and line. File-level findings (no test) print under a `file  <path>` heading. Verdict words are colored (fail red, review yellow, pass green) only when color is on. Use `/` in all printed paths on every OS. If the terminal does not support UTF-8 (`process.platform === 'win32'` and no `WT_SESSION`), print `-` instead of `·`.

### 10.5 SARIF

SARIF 2.1.0, one `run`, `tool.driver.name = "qa-core-review"`, `tool.driver.version`, `informationUri` = repo URL, one `rules[]` entry per rule run with `id`, `name`, `shortDescription`, `fullDescription`, `helpUri` (docs anchor) and `defaultConfiguration.level` (`error` -> `error`, `warn` -> `warning`, `info` -> `note`). Each result has `ruleId`, `ruleIndex`, `level`, `message.text` (message plus fix), one `physicalLocation` with `artifactLocation.uri` relative to the root and `uriBaseId: "%SRCROOT%"`, a `region`, and `partialFingerprints["qaCoreReview/v1"] = Finding.id`. Suppressed findings are left out. Tests validate output against the official SARIF 2.1.0 JSON schema, committed at `tests/schemas/sarif-2.1.0.json` with its source URL in `tests/schemas/README.md`.

### 10.6 Markdown

Used for the PR comment and `report.md`. It:
1. Starts with the marker line `<!-- qa-core-review -->`.
2. Has a heading `## Test review` and a one-line verdict ("2 tests need changes, 2 need review, 5 pass." or "All 9 tests pass review.").
3. Has a table of fail and review tests: verdict, `file:line`, test title, rule ids.
4. Has a collapsed `<details>` per fail or review test with each finding: rule id, line, message, evidence in inline code, fix.
5. Is at most 60,000 characters. If longer, keep the table, drop the details, and add "Full report in the job artifact `.qa-core/review/report.json`."
6. Ends with: "Reviewed by [qa-core-review](https://github.com/sprintsynergyio/qa-core-review), an open-source tool by SprintSynergy."

Escape `|`, `<` and backticks in user code shown inside the table.

---

## 11. Config

### 11.1 Discovery

First match wins, searched from `--root` upward to the git root: `qa-core-review.config.json`, `.qa-core-review.json`, or a `"qa-core-review"` key in `package.json`. JSON only in v1, so loading config never runs code. Validate with `schemas/config.schema.json`. On error, exit 2 and print the file, the JSON pointer and the message.

### 11.2 Schema with defaults

```json
{
  "$schema": "https://raw.githubusercontent.com/sprintsynergyio/qa-core-review/main/schemas/config.schema.json",
  "include": [
    "**/*.{spec,test}.{ts,tsx,js,jsx,mjs,cjs,mts,cts}",
    "**/{tests,test,e2e,__tests__}/**/*.{ts,tsx,js,jsx,mjs,cjs,mts,cts}"
  ],
  "exclude": ["**/node_modules/**", "**/dist/**", "**/build/**", "**/coverage/**", "**/.qa-core/**", "**/*.d.ts"],
  "framework": "auto",
  "failOn": "error",
  "testIdAttribute": "data-testid",
  "assertionHelpers": [],
  "rules": {
    "QCR-W001": { "severity": "warn", "maxMs": 0 },
    "QCR-S001": { "severity": "warn", "allowPatterns": [] },
    "QCR-M001": { "subjectMap": {} },
    "QCR-C001": { "restoreMocksConfigured": false },
    "QCR-N001": { "severity": "info" }
  },
  "llm": {
    "mode": "off",
    "model": null,
    "includeSubject": false,
    "allowErrors": false,
    "maxFilesPerRun": 20,
    "maxCharsPerFile": 40000,
    "redact": true,
    "timeoutMs": 60000
  },
  "claude": { "stopGate": "report" },
  "ui": { "port": 0, "open": true },
  "output": { "dir": ".qa-core/review", "formats": ["pretty"] }
}
```

- Each `rules` entry accepts `"off"`, a severity string (`"error" | "warn" | "info"`), or an object with optional `severity` plus rule-specific options. Unknown rule ids print a warning, not an error.
- `additionalProperties: false` everywhere else.
- `claude.stopGate` is `"off" | "report" | "ui"` (Section 13.1).
- CLI flags override config values.
- API keys are never read from config, only from environment variables (Section 14).
- `docs/config.md` documents every key with its default.

---

## 12. Local review UI

### 12.1 Server

- `qa-core-review ui` runs the review, then starts `node:http` bound to `127.0.0.1` only (never `0.0.0.0`), on `--port` or a random free port.
- Generate a random 32-byte hex token per run. The URL is `http://127.0.0.1:<port>/?t=<token>`. The page reads the token from the URL and sends it as header `X-QCR-Token` on every API call. API requests without the right token get 403. Reject requests whose `Host` header is not `127.0.0.1:<port>` or `localhost:<port>` (DNS rebinding guard).
- Open the browser with `open` (macOS), `cmd /c start "" <url>` (Windows) or `xdg-open` (Linux), using `spawn` with an argument array. If that fails, print the URL.
- Serve `ui/index.html`, `ui/app.js` and `ui/styles.css` from the installed package. No CDN, no external fonts, no network requests from the page. Send `Content-Security-Policy: default-src 'self'` and `X-Content-Type-Options: nosniff`.
- Shut down after Finish, on Ctrl+C, or after 2 hours with no requests.

### 12.2 API

| Method | Path | Body and result |
| --- | --- | --- |
| GET | `/api/report` | `Report` plus `sources: Record<file, string>` for files in the report only |
| GET | `/api/session` | `ReviewSession` |
| PUT | `/api/session/tests/:testId` | `{ decision?, comment? }` |
| PUT | `/api/session/findings/:findingId` | `{ testId, dismissed?, comment? }` |
| PUT | `/api/session/general` | `{ comment }` |
| GET | `/api/prompt` | current feedback prompt preview as text |
| POST | `/api/finish` | `{}` -> `{ outcome, prompt, path }` |

Write `session.json` on every change, so a page refresh keeps state. If a session file exists for an earlier run, restore decisions by `testId` and `findingId` and drop ids that no longer exist. Limit request bodies to 1 MB and return 400 on invalid JSON.

### 12.3 Screens

1. **Header and sidebar.** Header: tool name, counts (fail, review, pass), progress "4 of 9 tests decided", buttons **Approve all passing** and **Finish**. Sidebar: tests grouped by file, each with a verdict badge (text plus color), a decision icon (pending, approved, rejected), and filter chips: All, Fail, Review, Pass, Undecided.
2. **Test view (main panel).** Full title and `file:line`. The test's source with line numbers in monospace, with simple highlighting for keywords, strings and comments (a small tokenizer, no library). Each finding is an inline annotation box under its line: severity badge, rule id (link to docs), message, evidence, fix, a collapsible good example, a **Dismiss** toggle ("not a problem here") and a comment box. Below the code: a test comment box and three buttons: **Approve** (key A), **Reject** (key R), **Comment only** (key C, keeps decision pending but includes the comment). Keys J and K move to the next and previous test, `/` focuses the comment box.
3. **Finish dialog.** Shows the outcome, the generated prompt in a read-only textarea, a **Copy prompt** button, and the saved path `.qa-core/review/feedback.md`.

**Outcome rule:** "changes requested" if any test is rejected, or any test that is not approved still has an error finding that is not dismissed. Otherwise "approved".

Accessibility: real `<button>` elements, visible focus ring, color never the only signal. Light and dark theme via `prefers-color-scheme`. Works in current Chrome, Firefox, Safari and Edge.

### 12.4 Feedback prompt (exact template, `src/ui/feedback.ts`)

```markdown
# Test review feedback from qa-core-review

Outcome: CHANGES REQUESTED
Reviewed: 9 tests in 3 files. Approved 5, rejected 2, comment only 2.

Please fix the rejected tests below. Keep approved tests unchanged. Do not delete a test to make it pass, and do not weaken an assertion. After the fix, every test must still be able to fail when the feature is broken.

## Rejected

### tests/cart.spec.ts:12 "adds item to cart"
Reviewer comment: Use the cart badge test id.
- QCR-W001 (line 14): Hard wait of 3000 ms. Fix: wait for a condition instead, for example `await expect(badge).toHaveText('1')`.
- QCR-A003 (line 15): Locator objects are always truthy, so this check cannot fail. Fix: use `await expect(locator).toBeVisible()`.

## Comments (change only if you agree)

### tests/login.spec.ts:4 "user can log in"
- QCR-S001 (line 7): Selector depends on layout. Reviewer comment: fine for now, this page has no test ids.

## General
<general comment, or this section is left out when empty>

When done, run `npx qa-core-review --diff HEAD` and make sure it reports no errors.
```

With outcome approved, the first line after the heading is `Outcome: APPROVED` and only the Comments and General sections appear. Dismissed findings are left out. Approved tests appear only in the count. Write the prompt to `.qa-core/review/feedback.md` and return it from `/api/finish`.

---

## 13. Integrations

### 13.1 Claude Code

Before building this, read the current Claude Code hooks docs (`https://docs.claude.com/en/docs/claude-code/hooks`) and slash command docs. If the hook input or output format differs from this section, follow the docs and note the difference in the PR description.

**a) PostToolUse hook: fast feedback after each edit.** `qa-core-review hook claude-post-edit`:
1. Read JSON from stdin. Take `tool_input.file_path` (from `Write`, `Edit` or `MultiEdit`) and `cwd`.
2. If the file does not match config `include` or matches `exclude`, exit 0 with no output.
3. Review only that file, static rules only, fail on error.
4. No error findings: exit 0, no output.
5. Error findings: print a plain-text report to **stderr** (at most 40 lines: rule id, line, message, fix) ending with "Fix these test problems before you continue. Do not delete tests or weaken assertions to silence them." and exit **2**, which Claude Code feeds back to Claude.
6. Must finish in under 2 seconds for a 1,000-line file.
7. Any internal error: print one line to stderr and exit 0, so a tool bug never blocks the user's agent.

**b) Stop hook: review gate when Claude finishes.** `qa-core-review hook claude-stop`:
1. Read JSON from stdin. If `stop_hook_active` is true, exit 0 (prevents loops).
2. If `claude.stopGate` is `"off"`, exit 0.
3. Review changed test files (`--diff HEAD` plus untracked). If no test files changed, exit 0.
4. `"report"` (default): if error findings exist, print `{"decision":"block","reason":"<feedback prompt built from the findings>"}` to stdout and exit 0, so Claude continues and fixes them. Otherwise exit 0 with no output.
5. `"ui"`: start the UI in gate mode and wait. On "changes requested", print `{"decision":"block","reason":"<feedback prompt>"}`. On "approved", exit 0 with no output. Document that this mode needs the hook `timeout` set to 3600.

**c) `qa-core-review init --claude`.** Merges this into `.claude/settings.json` in the project. Create the file if it is missing, never remove existing hooks, do not add an entry whose command already exists, write with 2-space indent, and print what changed:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [{ "type": "command", "command": "npx --no-install qa-core-review hook claude-post-edit", "timeout": 30 }]
      }
    ],
    "Stop": [
      {
        "hooks": [{ "type": "command", "command": "npx --no-install qa-core-review hook claude-stop", "timeout": 120 }]
      }
    ]
  }
}
```

It also writes `.claude/commands/qa-review.md` from `templates/claude/commands/qa-review.md`:

```markdown
---
description: Review the tests you just wrote with qa-core-review and fix what it finds
---
1. Run `npx qa-core-review --diff HEAD --stdout markdown`.
2. Fix every error and warning in the test code. Do not delete tests or weaken assertions to silence a finding. If a finding is wrong, add `// qa-core-review-disable-next-line <id> -- <reason>` and tell me why.
3. If $ARGUMENTS contains "deep", run `npx qa-core-review --diff HEAD --llm claude-code`, read `.qa-core/review/llm-prompt.md`, and do the review it describes yourself.
4. If $ARGUMENTS contains "ui", run `npx qa-core-review ui --diff HEAD --gate`, wait for it to finish, and apply the feedback it prints.
5. Repeat step 1 until there are no errors, then summarize what you changed.
```

And it copies `skill/SKILL.md` to `.claude/skills/qa-core-review/SKILL.md`. Write the skill in the style of `qa-core-heal/skill/SKILL.md`: front matter with `name` and a `description` that says when to trigger (after writing or editing tests, "review my tests", "are these tests any good"), core rules (never delete or weaken tests to pass review, never suppress without a reason, the user decides in the UI), and a numbered workflow.

`--force` overwrites only files this tool created (`qa-review.md`, the skill); it never rewrites other hooks.

### 13.2 Cursor and Codex

- `init --cursor` writes `.cursor/rules/qa-core-review.mdc`, a rule for globs `**/*.{spec,test}.*` that tells the agent to run `npx qa-core-review --diff HEAD` after writing tests and fix errors without deleting tests or weakening assertions. Check Cursor's current docs: if project hooks (`.cursor/hooks.json` with after-file-edit and stop events) are supported, also add hook entries that call the same commands, and document both.
- `init --codex` appends `templates/codex/AGENTS.snippet.md` to `AGENTS.md` (create the file if missing; skip if the marker `<!-- qa-core-review -->` is already there). If Codex hooks are available at build time, document the optional hook config; otherwise the AGENTS.md instruction is the integration.
- `docs/integrations.md` gives numbered steps for Claude Code, Cursor, Codex, a git pre-commit hook (`npx qa-core-review --staged`) and plain CI, with the date the agent docs were last checked.

### 13.3 GitHub Action and qa-core-prcheck

`action.yml` is a composite action. Follow `qa-core-prcheck/action.yml`: inputs reach scripts only through `env:` and are used as quoted shell variables, never as `${{ }}` expressions inside `run:`.

Inputs: `base-ref` (default empty, meaning `origin/` plus `GITHUB_BASE_REF`), `paths` (default empty, meaning config include), `fail-on` (default `error`), `comment` (default `true`), `github-token` (default `${{ github.token }}`), `comment-author` (default `github-actions[bot]`), `sarif` (default `false`), `version` (npm version to run, default the version matching the action tag).

Steps:
1. Run `npx --yes qa-core-review@"$VERSION" review --diff "$BASE_REF" --format json,sarif,markdown`, keeping its exit code.
2. Append `report.md` to `$GITHUB_STEP_SUMMARY`.
3. If `comment` is true, run `qa-core-review comment --report .qa-core/review/report.json`. It finds the comment by the marker and `comment-author`, updates it, or creates one. It skips fork PRs with a notice. A 403 becomes a warning, not a failure. Use `GITHUB_API_URL`, `GITHUB_REPOSITORY` and the PR number from `GITHUB_EVENT_PATH`.
4. If `sarif` is true, upload `report.sarif` with `github/codeql-action/upload-sarif` (needs `security-events: write`; document it).
5. Upload `.qa-core/review/` as an artifact.
6. Exit with the exit code from step 1.

Example workflow for users (README and `docs/github-action.md`):

```yaml
name: Test review
on: pull_request
permissions:
  contents: read
  pull-requests: write
jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - uses: sprintsynergyio/qa-core-review@v0.1.0
        with:
          fail-on: error
```

Use the action major versions current at build time, matching `qa-core-prcheck`.

**qa-core-prcheck.** Do not change the prcheck repo from this repo. Here, document two options in `docs/github-action.md` under "Use with qa-core-prcheck":
- **Option A (works now):** run both actions in the same job. Each keeps its own sticky comment.
- **Option B (proposal for a later prcheck PR, written in `docs/prcheck-integration.md`):** prcheck gets an input `review: true` that runs `npx qa-core-review --diff "$BASE" --stdout markdown --fail-on never` and puts the output under a "Test quality" heading in its summary. The contract prcheck can rely on: the markdown starts with `<!-- qa-core-review -->` and stays under 60,000 characters, and `report.json` follows `schemas/report.schema.json` with `schemaVersion: 1`.

---

## 14. LLM deep review (optional)

### 14.1 Modes

| Mode | What happens | Key |
| --- | --- | --- |
| `off` (default) | Static rules only. No network calls at all. | none |
| `anthropic` | Sends the reviewed test files to the Anthropic Messages API (`POST https://api.anthropic.com/v1/messages`) with `fetch`. | `ANTHROPIC_API_KEY` |
| `openai` | Sends them to the OpenAI Chat Completions API (`POST https://api.openai.com/v1/chat/completions`) with a JSON response format. | `OPENAI_API_KEY` |
| `claude-code` | No network call. Writes `.qa-core/review/llm-prompt.md` with the same prompt (all files in one document) so the running Claude Code session does the deep review itself, through the slash command. | none |

Models: keep one `DEFAULT_MODELS` constant in `src/llm/index.ts`. At build time, check each provider's current model list and set a current mid-priced model. Users override with `--llm-model` or `llm.model`. Support `ANTHROPIC_BASE_URL` and `OPENAI_BASE_URL` for proxies. No provider SDKs; plain `fetch`.

### 14.2 Privacy rules (also in `docs/privacy.md` and the README)

1. In `off` and `claude-code` modes the tool makes zero network requests. A test replaces `globalThis.fetch` with a function that throws and runs a full review in both modes.
2. In `anthropic` or `openai` mode, before sending, print which files and how many characters will be sent and to which host. In an interactive terminal, ask "Send N files to <host>? (y/N)". In a non-interactive run, require `--yes-send-code` or env `QA_CORE_REVIEW_SEND_CODE=1`; otherwise exit 2 with a clear message.
3. Send only the test files under review, plus the subject module from 9.11 when `llm.includeSubject` is true. Never send `.env` files, config files, or files outside the root.
4. Redaction (`llm.redact`, on by default): before sending, replace with `"<redacted>"` the values of string literals assigned to names matching `/(pass(word)?|secret|token|api[_-]?key|auth|bearer|cookie|session)/i`, strings that look like JWTs, AWS keys (`AKIA[0-9A-Z]{16}`), `sk-`, `ghp_`, `github_pat_` and `xox[bp]-` tokens, and email addresses. Line numbers must not change.
5. API keys come only from environment variables, are never logged, never written to any report, and are masked in error messages.
6. Files over `llm.maxCharsPerFile` are skipped with an info finding. At most `llm.maxFilesPerRun` files per run.

### 14.3 Prompt design (`src/llm/prompt.ts`)

System prompt:
```
You are a senior QA engineer reviewing automated tests before merge. Your job is to find tests that would stay green when the feature they claim to test is broken, and important cases that are missing. You only review; you never rewrite whole files.
Rules:
- Report only problems you can point to with a line number in the given file.
- Do not repeat the static findings listed below. Add new ones, or say you disagree with one.
- Prefer a few high-confidence findings over many weak ones. At most 10 per file.
- For missing cases, name the exact scenario (input and expected result), not a category.
- Reply with JSON only, matching the schema. No text outside the JSON.
```

User message, one per file:
```
Framework: <playwright|jest|vitest>
File: <relative path>
Static findings already reported:
<ruleId line message, one per line, or "none">
Subject module (only if included): <path>
<numbered subject code>
Test file with line numbers:
1: <line>
2: <line>
...
JSON schema for your reply:
<contents of schemas/llm-output.schema.json>
```

`schemas/llm-output.schema.json`:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["findings", "missingCases", "disagreements"],
  "properties": {
    "findings": {
      "type": "array", "maxItems": 10,
      "items": {
        "type": "object", "additionalProperties": false,
        "required": ["line", "category", "severity", "message", "fix"],
        "properties": {
          "line": { "type": "integer", "minimum": 1 },
          "category": { "enum": ["weak-assertion", "cannot-fail", "wrong-target", "over-mocking", "flaky-timing", "brittle-selector", "missing-cleanup", "other"] },
          "severity": { "enum": ["error", "warn", "info"] },
          "message": { "type": "string", "maxLength": 300 },
          "fix": { "type": "string", "maxLength": 300 }
        }
      }
    },
    "missingCases": {
      "type": "array", "maxItems": 10,
      "items": {
        "type": "object", "additionalProperties": false,
        "required": ["describe", "scenario", "expected"],
        "properties": {
          "describe": { "type": "string" },
          "scenario": { "type": "string", "maxLength": 200 },
          "expected": { "type": "string", "maxLength": 200 }
        }
      }
    },
    "disagreements": {
      "type": "array",
      "items": {
        "type": "object", "additionalProperties": false,
        "required": ["ruleId", "line", "reason"],
        "properties": {
          "ruleId": { "type": "string" },
          "line": { "type": "integer", "minimum": 1 },
          "reason": { "type": "string", "maxLength": 300 }
        }
      }
    }
  }
}
```

**Mapping:** each LLM finding becomes a `Finding` with `source: "llm"`, `ruleId: "QCR-L001"`, `ruleName: "llm-finding/<category>"`, `confidence: "medium"`, attached to the test that contains the line. Missing cases become `QCR-L002` (`llm-missing-case`, info) at the matching describe line, or line 1. Disagreements are shown in the UI and JSON but never remove a static finding. LLM findings are capped at `warn` unless `llm.allowErrors` is true, so the exit code stays deterministic by default. A finding whose line is outside the file is dropped.

**Robustness:** validate the reply with ajv. On invalid JSON, retry once with "Your last reply was not valid JSON for the schema. Reply with JSON only." On a second failure, a timeout (`llm.timeoutMs`) or a network or HTTP error, add one info finding `QCR-L000 llm-unavailable` with the reason and continue. The LLM never fails the run. Tests use a fake `fetch` with recorded replies in `tests/fixtures/llm/`. CI makes no real API calls.

---

## 15. Testing plan

1. **Unit tests** (`tests/*.test.mjs`, `node:test`, against the built `dist/`): parser and framework detection, every rule (through the fixture helper), suppression, fingerprint stability (edit above a test, the id stays the same), config loading and errors, glob helper, diff line-range parsing (feed recorded `git diff -U0` output), each reporter, SARIF and report schema validation, CLI exit codes (spawn `node dist/cli.js`), UI server API (port 0, with and without token, bad Host), feedback prompt (golden file), Claude hook handlers (pipe recorded hook JSON into the command, check exit code, stdout and stderr), `init` merge logic, LLM mapping and redaction with a fake `fetch`, GitHub comment logic against a fake API server on localhost.
2. **Rule fixtures:** `fixtures/rules/<id>/bad` and `good`, at least 3 each, Playwright plus Jest or Vitest. Good fixtures must give zero findings from every rule.
3. **Git tests:** `tests/diff.test.mjs` makes a temp repo with `git init`, sets `user.name` and `user.email` locally inside that temp repo only, commits, edits, and checks `--diff` and `--staged`. If git is missing, skip with a clear message.
4. **Evals:** `evals/corpus/` holds at least 40 realistic AI-style test files written for this repo (generic apps only) with expected findings in `evals/labels.json`. `npm run eval` prints precision and recall per rule and fails if any error-severity rule has precision below 0.95 or recall below 0.85.
5. **Coverage:** `npm run coverage` runs `c8 --check-coverage --lines 90 --functions 90 --branches 85` around the test command, with `sourceMap: true` in `tsconfig.build.json` so coverage maps to `src/`. CI fails below the thresholds.
6. **UI smoke test:** start the server, fetch `/` and `/api/report` with the token, send decisions, call `/api/finish`, compare the prompt with a golden file. No browser in CI. Before release, check the page by hand in Chrome and Firefox and take the README screenshots.
7. **Pack smoke:** `scripts/pack-smoke.mjs` runs `npm pack`, installs the tarball in a temp folder, runs `npx qa-core-review --version` and a review of a copied fixture, and checks that `ui/`, `schemas/`, `skill/` and `templates/` are in the package.
8. **Cross-OS CI** (`.github/workflows/ci.yml`): matrix `os: [ubuntu-latest, windows-latest, macos-latest]` and `node: [22, 24]`, `fail-fast: false`, `permissions: contents: read`. Steps: checkout, setup-node with npm cache, `npm ci`, `npm run typecheck`, `npm run lint`, `npm run coverage`, `npm run eval`, `npm run pack:smoke`. Windows rules: use `path` functions and convert to `/` for reports, quote globs in npm scripts so Node expands them, and use `spawn` with `shell: false` (on Windows, run `npx`/`npm` as `npm.cmd` or through `process.execPath` with the CLI file).
9. **Lint:** `npm run lint` runs `tsc --noEmit` plus `scripts/check-text.mjs`, which fails on tabs in source, trailing spaces, CRLF line endings, and any word listed in `scripts/forbidden-words.txt` (one word per line, starts empty, Muhammad fills it in; the file is not in the npm package). No ESLint in v1.

---

## 16. Milestones

### 16.1 Before Milestone 0 (Muhammad does this once)

1. Create the empty repo `sprintsynergyio/qa-core-review` on GitHub (private until launch is fine), with "Add a README" ticked so `main` exists. Do not add a license there; Milestone 0 adds it.
2. Clone it locally, put `SPEC.md` and `CLAUDE.md` in the root (they are committed in Milestone 0), and start Claude Code in that folder.
3. Make sure `gh auth status` shows the `sardar-usman` account and `git config user.email` in this repo is `usman@sprintsynergy.com` (Claude Code sets the repo-local name and email in Milestone 0 if they are not set).

### 16.2 How to work through the milestones

- Build them in order. One milestone = one branch `feat/<name>` (names below) = one pull request to `main`.
- Start each branch from the latest `main` (`git switch main && git pull && git switch -c feat/<name>`).
- Each PR must have tests, a green `npm test`, `npm run lint` and `npm run coverage` locally, an updated `CHANGELOG.md` "Unreleased" section, and a PR description with every acceptance criterion as a checkbox plus how it was checked.
- Push the branch, open the PR with `gh pr create --base main`, then stop and wait for Muhammad to say "next". Do not start the next milestone before that. Fix review comments on the same branch.
- Never merge, tag or publish.

### Milestone 0: Repo scaffolding and CI (`feat/scaffold`)
Work: `package.json` (name `qa-core-review`, version `0.0.0`, `description`, `keywords`, `type: module`, `engines`, `bin`, `main`, `types`, `files` = `dist`, `ui`, `schemas`, `skill`, `templates`, `README.md`, `CHANGELOG.md`, `LICENSE`; author, contributors, homepage, bugs and repository like `qa-core-verify` with `sprintsynergyio` URLs; `publishConfig.access: public`; scripts `build`, `typecheck`, `lint`, `test`, `coverage`, `eval`, `pack:smoke`, `prepack`), `tsconfig.json`, `tsconfig.build.json`, `.nvmrc`, `.gitignore` (`node_modules`, `dist`, `coverage`, `.qa-core`, `*.tgz`, `.env*`), `.gitattributes`, MIT `LICENSE` ("Copyright (c) 2026 SprintSynergy"), stub `src/cli.ts` with `--version` and `--help`, `src/version.ts` (reads the version from `package.json`), `tests/cli.test.mjs`, `scripts/check-text.mjs`, `scripts/pack-smoke.mjs`, an `evals/run.mjs` placeholder that prints "no evals yet" and exits 0, `.github/workflows/ci.yml` (15.8), PR template, `CHANGELOG.md`, README stub (one-line description, "Status: in development"), and commit `SPEC.md` and `CLAUDE.md`.
Acceptance:
- [ ] `npm ci && npm run build && npm test && npm run lint && npm run coverage && npm run pack:smoke` pass locally.
- [ ] `node dist/cli.js --version` prints `0.0.0`; `--help` prints usage; an unknown flag exits 2.
- [ ] CI is green on ubuntu, windows and macos with Node 22 and 24.
- [ ] No secrets, no client names; every commit authored by `SprintSynergy <usman@sprintsynergy.com>`.

### Milestone 1: Parser and test discovery (`feat/parser`)
Work: `src/parse/*`, `src/discover/files.ts`, `src/util/glob.ts`, framework detection, `TestUnit` extraction (titles, modifiers, locations, `.each` tables, nested describes, template literal titles). Fixture project `fixtures/projects/basic` (Playwright, Jest, Vitest, JS and TS, one broken file).
Acceptance:
- [ ] Every test in the fixture project is extracted with the right `fullTitle`, modifiers and 1-based lines.
- [ ] Framework detection is right for each fixture; unknown framework handled.
- [ ] A file with a syntax error gives `QCR-X001` and the run continues.
- [ ] Glob helper tests cover `**`, `*`, `?`, `{a,b}` and Windows-style input paths.

### Milestone 2: Engine, data model, config, and `review` with pretty and JSON output (`feat/engine-cli`)
Work: `src/rules/types.ts`, rule registry, `src/engine/*` (run, fingerprint, verdict), `src/config/*`, `schemas/config.schema.json`, `schemas/report.schema.json`, the `review` command with the 10.2 flags except `--diff`, `--staged`, `--llm*` and the `ui` flags, `pretty` and `json` reporters, exit codes, `rules` and `explain` commands, `init --config`.
Acceptance:
- [ ] `node dist/cli.js review fixtures/projects/basic` prints the 10.4 layout and writes `.qa-core/review/report.json`, which validates against the schema.
- [ ] Exit codes 0, 1, 2 and 3 each covered by a test.
- [ ] An invalid config exits 2 and prints the JSON pointer.
- [ ] `--fail-on`, `--rules`, `--disable`, `--quiet`, `--no-color` and `NO_COLOR` covered by tests.

### Milestone 3: Assertion rules A001 to A004 (`feat/rules-assertions`)
Work: rules 9.1 to 9.4, `tests/helpers/fixtures.mjs`, fixtures, `docs/rules.md` sections.
Acceptance:
- [ ] Every `// expect:` marker in the bad fixtures matched exactly; zero findings on all good fixtures.
- [ ] `assertionHelpers` config and same-file helper detection tested.
- [ ] `docs/rules.md` has the bad and good example for each rule.

### Milestone 4: Hard waits and brittle selectors W001, S001 (`feat/rules-waits-selectors`)
Acceptance:
- [ ] Every sub-case of 9.5 and 9.6 has a bad fixture; fake timers, role and test id locators are not flagged.
- [ ] `maxMs`, `allowPatterns` and `testIdAttribute` options tested.
- [ ] Fixture markers and good-set checks pass; `docs/rules.md` updated.

### Milestone 5: Swallowed errors, focused and skipped tests E001, F001, F002 (`feat/rules-errors-focus`)
Acceptance:
- [ ] try/catch with and without rethrow, `.catch(() => {})`, and `expect.soft` (not flagged) tested.
- [ ] `test.skip(condition, reason)` not flagged; `fit`, `xit`, `test.fixme` flagged.
- [ ] Fixture markers and good-set checks pass; `docs/rules.md` updated.

### Milestone 6: Duplicates, snapshot-only and cleanup D001, P001, C001 (`feat/rules-dup-snapshot-cleanup`)
Acceptance:
- [ ] Duplicates found within a file and across two files, with the first copy named in the evidence; loop and `.each` tests not flagged.
- [ ] Snapshot-only is warn for Jest/Vitest and info for Playwright screenshots.
- [ ] Every cleanup sub-case has a bad fixture and a fixed good twin.

### Milestone 7: Over-mocking and missing negative cases M001, N001 (`feat/rules-mocking-edge`)
Acceptance:
- [ ] Subject detection works for `./x`, `../src/x` and `subjectMap`; `importActual`/`requireActual` passthrough not flagged.
- [ ] N001 fires once per happy-path-only group, never on a group with an error case, and gives 2 to 3 suggestions.
- [ ] Fixture markers and good-set checks pass; `docs/rules.md` complete for all rules, including the verify mapping column.

### Milestone 8: Inline suppression and diff mode (`feat/suppress-diff`)
Work: 9.16, `--diff`, `--staged`, `src/discover/diff.ts`, `src/util/git.ts`.
Acceptance:
- [ ] Next-line and whole-file suppression with a reason works; without a reason gives `QCR-X002`; suppressed findings never change the exit code.
- [ ] Temp-repo test: only tests whose lines changed are reported; untracked test files are included; F001 is always reported in changed files.
- [ ] Not a git repo, or a bad base ref, exits 2 with a clear message.

### Milestone 9: SARIF and Markdown reports (`feat/sarif-markdown`)
Acceptance:
- [ ] SARIF validates against the 2.1.0 schema; levels and fingerprints mapped as in 10.5.
- [ ] Markdown matches a golden file, starts with the marker, escapes table text, and truncates over 60,000 characters as specified.
- [ ] `--format` and `--stdout` combinations tested.

### Milestone 10: Eval corpus and example project (`feat/evals`)
Work: `evals/corpus` (40+ files), `evals/labels.json`, `evals/run.mjs`, `example-project/saucedemo` (AI-style Playwright specs with known problems, including `ai-written.spec.ts` for the demo) and `example-project/unit` (a small `cart.ts` with Vitest and Jest tests).
Acceptance:
- [ ] `npm run eval` prints per-rule precision and recall and meets the 15.4 thresholds; the CI eval step now runs it.
- [ ] `node dist/cli.js example-project` reports at least one finding for every static rule.
- [ ] Coverage still at or above the 15.5 thresholds.

### Milestone 11: Local review UI (`feat/review-ui`)
Work: `src/ui/server.ts`, `src/ui/session.ts`, `ui/*`, the `ui` command and its flags, screens 12.3, security rules 12.1.
Acceptance:
- [ ] Server binds to 127.0.0.1 only; missing token gives 403; wrong Host header is rejected (tests).
- [ ] Decisions and comments persist in `session.json` and survive a restart.
- [ ] The page makes no external requests (CSP header test, and a test that `ui/` files contain no `http://` or `https://` URLs except docs links).
- [ ] Manual check notes (browser and OS) and two screenshots in the PR description.

### Milestone 12: Feedback prompt and gate mode (`feat/feedback-gate`)
Acceptance:
- [ ] The prompt matches the 12.4 template (golden file tests for approved and changes-requested) and is saved to `.qa-core/review/feedback.md`.
- [ ] `ui --gate` exits 0 on approved and 1 on changes requested and prints the prompt to stdout (tested by driving the API).
- [ ] The outcome rule in 12.3 is tested for each case.

### Milestone 13: Claude Code integration (`feat/claude-code`)
Work: `hook claude-post-edit`, `hook claude-stop`, `init --claude`, `templates/claude/commands/qa-review.md`, `skill/SKILL.md`, the `claude.stopGate` config key, the Claude Code section of `docs/integrations.md`.
Acceptance:
- [ ] Hook tests with recorded stdin JSON: non-test file exits 0 silently; clean test file exits 0; bad file exits 2 with the stderr report; `stop_hook_active: true` exits 0; Stop with errors prints valid `{"decision":"block",...}` JSON; internal errors exit 0.
- [ ] The post-edit hook finishes under 2 seconds on a 1,000-line file (timed test with a CI margin).
- [ ] `init --claude` keeps existing settings, adds no duplicates on a second run, and `--force` overwrites only this tool's own files.
- [ ] The PR describes a manual check in a real Claude Code session: what Claude did after the hook fired.

### Milestone 14: Cursor and Codex setup (`feat/cursor-codex`)
Acceptance:
- [ ] `init --cursor` and `init --codex` write the files in 13.2 and do nothing new on a second run.
- [ ] `docs/integrations.md` has numbered steps for Claude Code, Cursor, Codex, pre-commit and CI, with the date the agent docs were checked.

### Milestone 15: LLM deep review (`feat/llm`)
Work: Section 14 in full.
Acceptance:
- [ ] Zero network calls in `off` and `claude-code` modes (fetch-throws test).
- [ ] A non-interactive run without `--yes-send-code` exits 2; the consent question appears in an interactive run.
- [ ] Redaction test: secrets replaced, line count unchanged; keys never appear in output or reports.
- [ ] Recorded replies for both providers map to `QCR-L001` and `QCR-L002`; invalid JSON is retried once, then `QCR-L000`; the run never fails because of the LLM.
- [ ] `claude-code` mode writes `.qa-core/review/llm-prompt.md`.

### Milestone 16: GitHub Action and PR comment (`feat/github-action`)
Work: `action.yml`, the `comment` command, `src/integrations/github.ts`, `.github/workflows/self-review.yml` (runs the action from the PR's own checkout on this repo, Linux, using `node dist/cli.js` instead of npm), `docs/github-action.md`, `docs/prcheck-integration.md`.
Acceptance:
- [ ] `comment` creates a comment, then updates the same one (tested against a fake GitHub API on localhost); fork PRs are skipped; a 403 gives a warning and exit 0.
- [ ] Inputs reach `run:` only through `env:` (a test reads `action.yml` and fails on `${{` inside any `run:` block).
- [ ] The self-review workflow posts a sticky comment on this milestone's own PR.

### Milestone 17: README, docs and demo GIF (`feat/readme-demo`)
Work: README per Section 17, `scripts/record-demo.mjs` and `docs/demo.tape`, all `docs/*` complete, screenshots in `docs/images/`.
Acceptance:
- [ ] Every command in the README was run and its output copied with the capture date.
- [ ] `docs/images/demo.gif` is under 5 MB and under 35 seconds, or the PR says Muhammad will record it and lists the exact steps.
- [ ] A small script checks that all relative links in README and docs resolve.

### Milestone 18: Release prep for 0.1.0 (`feat/release-0.1.0`)
Work: version `0.1.0`, `CHANGELOG.md` entry, `docs/release-acceptance.md` (the Section 18 checklist with results), final pack smoke, `npm publish --dry-run` output in the PR.
Acceptance:
- [ ] `npm publish --dry-run` lists only the intended files; package size noted in the PR.
- [ ] Install from the packed tarball works on all three OSes in CI.
- [ ] Nothing is published or tagged. The PR description ends with the exact release steps for Muhammad from Section 18.

---

## 17. README outline

Follow the style of the `qa-core-prcheck` and `qa-core-verify` READMEs: plain English, short sections, real copied output with the capture date.

1. `# qa-core-review` and one line: "Review AI-written tests before merge. Finds tests that stay green while checking nothing, and sends your feedback back to the agent."
2. Badges: npm version, CI, MIT license.
3. Demo GIF (`docs/images/demo.gif`).
4. "Works with Claude Code, Cursor and Codex. Playwright, Jest and Vitest. No LLM or API key needed."
5. Quick start: `npm i -D qa-core-review`, `npx qa-core-review`, `npx qa-core-review ui`.
6. Example output (copied, dated).
7. What it checks: the 9.15 table, linking to `docs/rules.md`.
8. The review page: screenshot, and how approve, reject, comment and the feedback prompt work.
9. Use with Claude Code (`npx qa-core-review init --claude` and what the hooks do), Cursor and Codex.
10. GitHub Action (the 13.3 YAML) and SARIF.
11. Config (short example, link to `docs/config.md`).
12. Optional LLM deep review and privacy (link to `docs/privacy.md`).
13. Exit codes.
14. How it fits with qa-core-verify, qa-core-prcheck, qa-core-heal, qa-core-flaky and playwright-migrate (links under `github.com/sprintsynergyio`).
15. Roadmap (Section 19).
16. Contributing, License (MIT), and "Built by SprintSynergy" with a link to https://sprintsynergy.com.

### Demo GIF steps

1. Use `example-project/saucedemo/tests/ai-written.spec.ts`, which has a hard wait, a truthy-locator check, an nth-child selector and a `test.only`.
2. Terminal 100x28, font size 16, dark theme. Record the terminal with `vhs` from `docs/demo.tape` (or asciinema plus agg). Record the browser part with a screen recorder at 1280x800.
3. Scenes, about 30 seconds: (1) the AI-written test, 4 s; (2) `npx qa-core-review example-project/saucedemo`, 6 s; (3) `npx qa-core-review ui`, the browser opens, reject the bad test with a comment, 12 s; (4) Finish dialog and Copy prompt, 4 s; (5) paste into Claude Code, it fixes the test, a re-run shows all pass, 4 s.
4. Export the GIF under 5 MB (`gifsicle -O3 --lossy=80`), plus an MP4 for social posts. Use real recordings only, no generated images.

---

## 18. Release and launch checklist (Muhammad does every irreversible step)

Release, after Milestone 18 is merged:
1. Muhammad checks out `main` and runs `npm ci && npm test && npm run pack:smoke`.
2. Muhammad tags `v0.1.0`, pushes the tag, and creates the GitHub Release with the CHANGELOG text.
3. Muhammad runs `npm publish` (or a release workflow if `NPM_TOKEN` is set as a repo secret; never commit a token).
4. Verify `npx qa-core-review@0.1.0 --version` in a clean folder on Linux, Windows and macOS.
5. Make the repo public if it is still private.

Repo setup:
- Description: "Review AI-written tests before merge. Flags tests that stay green while checking nothing. Works with Claude Code, Cursor and Codex."
- Topics (max 20): `testing`, `test-automation`, `qa`, `playwright`, `jest`, `vitest`, `code-review`, `ai-agents`, `claude-code`, `cursor`, `codex`, `static-analysis`, `test-quality`, `sarif`, `github-actions`, `cli`, `typescript`, `developer-tools`.
- Homepage: the npm page. Social preview: a real screenshot of the review page.

Launch, same day (the team writes the posts; Amna posts on social media):
- Hacker News: "Show HN: qa-core-review, review AI-written tests before merge", with a short first comment (the problem, how it works, no LLM needed).
- Reddit: r/QualityAssurance, r/softwaretesting, r/Playwright, r/ClaudeAI. Read each subreddit's self-promotion rules first.
- LinkedIn company page post with the GIF; X post with the MP4.
- Add the tool to the open-source section of the SprintSynergy website (goes live only after Muhammad approves).
- Cross-link from the qa-core-verify and qa-core-prcheck READMEs, in separate PRs in those repos.

---

## 19. Roadmap (after v0.1.0)

- pytest rules (Python AST through a small Python helper or tree-sitter) and Selenium Java and Python rules.
- Cypress and Mocha.
- A `--baseline` file to accept existing findings and fail only on new ones.
- Fix suggestions as code patches in the review page.
- Read a `qa-core-verify` report and show runtime proof next to static findings.
- A requirements-to-test-cases gap view (spec in, missing cases out).

## 20. Definition of done for v0.1.0

Milestones 0 to 18 merged, CI green on three OSes, coverage at or above the thresholds, eval thresholds met, README output copied from real runs, no secrets or client names in the repo, and the Section 18 release steps ready for Muhammad.
