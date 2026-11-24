# Adapters

A language adapter turns a test file into the normalized test model. Rules read only that model, so a rule written once works for every language. This page describes how adapters are built. The sections on writing a new adapter are added as the adapters land.

## Project detection and file discovery

Run `qa-core-review detect` to see what a review would cover. It prints the projects found, their frameworks with the evidence for each, and the number of test files per adapter. `--format json` prints the same as data (`schemas/detect.schema.json`).

### The file list

Inside a git repo the file list comes from git: tracked and untracked files, without ignored files and without files deleted from disk. Outside a git repo it is a directory walk that skips the default excludes (`node_modules`, `dist`, `build`, `target` and so on) and `.git`. The config `exclude` globs are then applied in both cases.

### Projects

Every adapter is asked about every folder that holds files. An adapter answers from the manifest files in that folder. Detection only reads files. It never runs npm, pip, Maven, Gradle or any other tool.

| Adapter | A folder is a project when it has | Frameworks come from |
| --- | --- | --- |
| `js` | `package.json`, or a runner config file | `dependencies` and `devDependencies` in `package.json`; `playwright.config.*`, `cypress.config.*`, `jest.config.*`, `vitest.config.*`, `.mocharc*`, `wdio.conf.*` |
| `python` | `pyproject.toml`, `requirements*.txt`, `setup.cfg`, `setup.py`, `Pipfile`, `poetry.lock`, `tox.ini` or `pytest.ini` | dependency names in those files (not `poetry.lock`); `pytest.ini`; `conftest.py`. With no runner found, `unittest` is assumed. |
| `java` | `pom.xml`, `build.gradle` or `build.gradle.kts` | Maven and Gradle coordinates in those files, read as text |

A dependency name must match as a whole name: `@types/mocha` is not Mocha, and the JUnit 5 BOM is not JUnit 4.

Some files only hint at a project: a lone `tsconfig.json` or `jsconfig.json`, a lone `conftest.py`, a lone `settings.gradle`. Such a folder becomes a project only when the same adapter has no project above it. This keeps a `tests/conftest.py` from hiding the frameworks declared in the `pyproject.toml` one level up.

### Which project a file belongs to

A file belongs to the nearest project above it for its own adapter. A Java service with Playwright tests in an `e2e/` folder that has its own `package.json` gives two projects: the Java files go to the `pom.xml` project and the TypeScript files go to the `e2e` project. A file with no project above it is still reviewed; its frameworks then come from the file itself.

### Which files are test files

Each adapter has default include globs (for example `**/*.{spec,test,cy}.*` and `**/tests/**` for `js`, `**/test_*.py` for `python`, `**/src/test/java/**/*.java` for `java`). A config `include` list replaces the defaults of every adapter. Type declarations and runner config files are never test files.

A file in a language with no static adapter yet goes to the `generic` adapter when it has a known source extension (`.scala`, `.rs`, `.swift`, `.go`, `.rb`, `.cs` and others, see `src/adapters/generic/languages.ts`) and a common test name (`*Test.*`, `*Spec.*`, `*_test.*`, `test_*.*`, or a `test`, `tests`, `spec` or `specs` folder), or when a config `generic` entry matches it. These files are listed, and reviewed only in LLM mode.

### Config overrides

A `projects` entry in the config gives a project at its `path`, so it is the nearest project for the files below it and wins over detection:

- `runner` replaces the detected runners. `libraries` are added.
- `language` picks the adapter and limits the folder to that language: files of other languages under the path are not reviewed.
- `include` adds test file globs for the folder. `exclude` removes files. Both are relative to the root, like every other glob in the config.
- Without `language`, the entry applies to the adapter that knows its `runner` or `libraries`.

## Parsing

### One parser for every language

Files are parsed with [tree-sitter](https://tree-sitter.github.io/tree-sitter/) compiled to WebAssembly (`web-tree-sitter`), plus one grammar `.wasm` file per language in `grammars/`. Nothing is compiled when you install the tool, and no Python, JDK or other toolchain is ever run. The same files work on Linux, macOS and Windows.

The parser service is `createTreeSitterService()` in `src/parse/treesitter.ts`:

| Method | What it does |
| --- | --- |
| `parse(grammar, text)` | Parses LF-normalized text. Returns the tree, or `null` when the grammar cannot be loaded. |
| `parseForReview(grammar, text)` | Like `parse`, and also decides whether the file must go to the lexical scanner (see "Fallback order"). |
| `query(grammar, source)` | Compiles a tree-sitter query (`.scm` source) once and caches it. |
| `loadedGrammars()`, `loadError(grammar)` | What has been loaded, and why a grammar failed to load. |

The parser runtime starts on first use. A grammar is loaded the first time a file of that language is parsed, then kept for the life of the process. Reviewing one Python file loads only the Python grammar.

A tree lives in WebAssembly memory. Call `tree.delete()` when you are done with it.

### Vendored grammars

| Grammar id | Languages | Source package |
| --- | --- | --- |
| `javascript` | JavaScript and JSX | `tree-sitter-javascript` |
| `typescript` | TypeScript | `tree-sitter-typescript` |
| `tsx` | TSX | `tree-sitter-typescript` |
| `python` | Python | `tree-sitter-python` |
| `java` | Java | `tree-sitter-java` |

`grammars/manifest.json` is the source of truth. For each grammar it records the npm package and exact version, the integrity hash of the package tarball, the source repository, the license, the ABI version, the size and the sha256 of the `.wasm` file. It also records the `web-tree-sitter` version and the ABI range that version accepts. `grammars/LICENSES.md` holds the license text of every vendored grammar. Only MIT, Apache-2.0 and BSD grammars may be vendored.

The `.wasm` files are the prebuilt ones that the official grammar packages publish on npm, copied unchanged. They are not compiled in this repo, so there is no Emscripten or Docker step and no second build to trust.

`npm test` checks every file against the manifest (size, sha256, ABI) and loads and parses a sample with each grammar on every OS in CI.

To update or add a grammar, run this by hand (it needs the network; nothing in `npm ci` or `npm test` does):

1. Edit `grammars/manifest.json`: change the `version` and set `integrity` to `null`. For a new grammar, add an entry with `id`, `file`, `package`, `version`, `sourceFile` and `"integrity": null`.
2. Run `node scripts/build-grammars.mjs`. It downloads the pinned package, checks the tarball hash, checks the license and the ABI, copies the `.wasm`, and rewrites the manifest and `LICENSES.md`.
3. Run `npm test`.
4. Commit the changed files, and say in the pull request what changed and why.

When `web-tree-sitter` itself is updated, run the same script. It fails if any grammar's ABI falls outside the range the new runtime accepts.

### Fallback order

1. **The tree.** A file with a syntax error still gives a tree. The broken part becomes `ERROR` nodes and the rest of the file is reviewed as usual.
2. **The lexical scanner.** `parseForReview` returns no tree, and a reason, in two cases: the grammar is missing or cannot be loaded (`grammar-unavailable`), or `ERROR` nodes cover more than 30% of the file's text (`too-many-errors`). The adapter then uses the lexical scanner in `src/parse/lexical.ts`, marks the file as partly parsed, and declares a smaller set of capabilities, so only the rules that the scanner can support run, at low confidence.
3. **The generic adapter.** If that also fails, the file gets `QCR-X001` and is handed to the generic adapter.

One thing to know about the 30% rule: tree-sitter sometimes wraps a large region in a single `ERROR` node for a small mistake, such as a missing closing brace at the end of a class. Such a file can cross the limit and go to the scanner even though only one character is wrong.

### The lexical scanner

The scanner knows three things about a language: its line comment markers, its block comment pairs and its string delimiters. `segments(text, syntax)` splits a file into code, string and comment pieces. `scanLines(text, syntax)` gives each line in three views with identical columns:

| Field | Content |
| --- | --- |
| `text` | The line as written. |
| `code` | Comments replaced by spaces. Strings kept. |
| `codeNoStrings` | Comments and the content of strings replaced by spaces. String delimiters kept. |

Line patterns are matched against `codeNoStrings`, so `time.sleep(3)` inside a comment or a string is not reported as a sleep. Each line also lists its comments with their columns, which is how suppression comments are found.

Ready-made syntaxes exist for JavaScript and TypeScript (`JS_LEXICAL`), Python (`PYTHON_LEXICAL`) and Java (`JAVA_LEXICAL`). `lexicalSyntaxFor(commentSyntax)` builds one for any other language from its comment markers.

The scanner is simple on purpose. Two known limits: a JavaScript regex literal that contains a quote character, and a template literal with a backtick inside `${...}`, are read wrong. Findings from the scanner are always low confidence.

### Positions

- Lines and columns are 1-based.
- Text is LF-normalized before parsing (`toLf` removes a byte order mark and turns CRLF into LF), so positions are the same on every OS.
- Columns count UTF-16 code units, the unit of JavaScript strings.
- The end of a span is exclusive: `endColumn` is the column just after the last character.

`spanOfNode(node)` converts a syntax node to a span. `LineIndex` converts character offsets to lines and columns for code that works without a tree.

### Assets

Grammars, schemas and the other files that ship next to the code are read only through `src/assets.ts` (`readAsset('grammars/python.wasm')`), by name, as bytes. The parser is given bytes, never a file path. This is what lets the standalone binary carry its grammars inside the executable.

## The JS/TS adapter (`js`)

The `js` adapter reads JavaScript, TypeScript, JSX and TSX test files for Playwright, Cypress, Jest, Vitest, Mocha, WebdriverIO and node:test. It fills every capability of the model. The code is in `src/adapters/js/`:

| File | What it does |
| --- | --- |
| `vocab.ts` | Every framework name the adapter knows, as data tables. Nothing else holds a matcher or method name. |
| `detect.ts`, `frameworks.ts` | Finds projects, and decides the runner of each file. |
| `normalize.ts` | Tests, suites, hooks, modifiers, skips, `.each` tables, imports, suppression comments. |
| `assertions.ts`, `expr.ts` | What each body checks, with operands, try blocks and promise catches. |
| `body.ts` | What each body does: waits, selectors, steps, data operations, mocks, resources. |
| `helpers.ts` | Functions that contain an assertion, and the module under test. |
| `lexical.ts` | The reduced reading of a file that cannot be parsed. |

### The runner of a file

The first rule that matches wins:

1. The config names it (`framework`, or a `projects` entry).
2. The file imports the framework's module: `@playwright/test`, `vitest`, `@jest/globals`, `node:test`, `@wdio/globals`, `mocha`.
3. The file uses a global only that framework has: `cy.`, `vi.`, `jest.`. For WebdriverIO, `browser.` or `$(` count only when the project declares WebdriverIO.
4. The project has one runner with global `describe` and `it` (Jest, Mocha, WebdriverIO, Cypress), or the file is named `*.cy.*`.

A Jest file and a Playwright file in the same project each get their own runner.

### Assertions

An assertion is a chain that starts at `expect(...)` (also `expect.soft`, `expect.poll`, `expect.element`), `assert(...)` or `assert.method(...)`, a Chai `should`, a Cypress `.should('chainer')` or `.and('chainer')`, `sinon.assert`, a supertest `.expect(...)` inside a request chain (kind `status` when the first argument is a status code), or a call that fails the test (`expect.fail()`, `assert.fail()`, `fail()`, a `throw` in the test's own flow). A Cypress chain that ends with `.contains(...)` counts when it is the last command of the test.

Each assertion has:

| Field | How it is decided |
| --- | --- |
| `kind` | From the matcher name, through `MATCHER_KINDS`. A status check needs a number: `expect(res.status()).toBe(404)`. |
| `actual`, `expected` | The operands, with `isLocator`, `isCount` and `isMock`. Names are followed inside one test: after `const rows = page.locator('tr')`, `rows` is a locator. |
| `complete` | False for `expect(x);` and `expect(x).toBe;` written as a whole statement. |
| `awaited` | `no` when a Playwright web-first matcher, `expect.poll`, `.resolves`, `.rejects`, `assert.rejects` or an expect-webdriverio matcher on an element is neither awaited nor returned. |
| `guarded` | True inside an `if`, `switch`, ternary, `&&`, loop, `catch` block, or a callback that may never run. Callbacks that always run are listed in `ALWAYS_RUN_CALLBACKS` (`test.step`, a promise `then`, `waitFor`, Cypress `within`). A callback that calls the test's `done` or the `resolve` of a promise the test builds also counts as always run, because the test cannot end without it. |
| `operator` | For a comparison matcher, what the value must be next to the expected one: `>`, `>=`, `<` or `<=`, before `negated` is applied. |
| `reachable` | False after an unconditional `return`, `throw`, `break` or fail call in the same block. |
| `viaHelper` | Set when the test calls a function, a page object method or a custom Cypress command that contains an assertion. |

Helpers are counted one level deep: a helper that only calls another helper does not count. Helpers from other files come from the helper index. The review builds it from every file it discovers, plus the local files those files import, two steps deep (a spec, its fixtures file, the page objects that file imports), plus `cypress/support/commands`, `e2e` and `index` for Cypress projects. Files found this way are read for helpers only and are not reviewed. An adapter names them through its optional `supportFiles(parsed)` method. Add names by hand with `assertionHelpers` in the config.

### Waits, selectors, mocks and resources

| Fact | What counts |
| --- | --- |
| Fixed sleep | `waitForTimeout(n)`, `browser.pause(n)`, `cy.wait(n)`, awaited `sleep`, `delay`, `wait` or `pause`, awaited `setTimeout(n)` from `node:timers/promises`, and `await new Promise((r) => setTimeout(r, n))` when only the timer can end the promise. Sleeps in hooks are stored on the hook (`waits`). |
| Not a sleep | `cy.wait('@alias')`, `waitForResponse`, `waitForURL`, `waitUntil` (kind `condition`), and fake clocks such as `vi.advanceTimersByTime` (kind `fake-timer`). A promise that an event can resolve, with a timer as its time limit, is not a sleep either. |
| Implicit wait | WebdriverIO `browser.setTimeout({ implicit: n })` (kind `implicit-wait-config`). |
| Selector | The first argument of `locator`, `frameLocator`, `$`, `$$`, `waitForSelector`, `querySelector`, `cy.get`, `cy.find`, `page.click(selector)`, and the `getBy...` calls. The strategy (`css`, `xpath`, `id`, `test-id`, `role` and so on) comes from the call or from the text, through `selectorStrategy` in `src/model/selectors.ts`. `.first()`, `.last()`, `.nth(n)` and `.eq(n)` are stored as `positional` on the selector they narrow. |
| Mock | `vi.mock` and `jest.mock` (module), `vi.spyOn`, `jest.spyOn`, `sinon.stub`, `mock.method` (function), `page.route` and `cy.intercept` (network). A module mock that calls `importActual` or `requireActual` is `passthrough`. |
| Subject | The import whose last part is the test file's own name (`cart.test.ts` and `./cart`), or `rules.QCR-M001.subjectMap` in the config: `{ "tests/cart.*": "../lib/basket" }`. With no subject, `targetsSubject` is `null`. |
| Resource | Spies, fake timers, `vi.stubGlobal`, `vi.stubEnv`, a write to `process.env.X`, `globalThis.X`, `window.X` or `Date.now`, and `launch()`, `newContext()`, `newPage()`. |
| Released | By the matching call in the same test or in an `afterEach` or `afterAll` hook of the file: `mockRestore`, `restoreAllMocks`, `sinon.restore`, `useRealTimers`, `unstubAllGlobals`, `unstubAllEnvs`, `close`, `dispose`, or a second write or `delete` of the same global. Playwright fixtures and Cypress stubs and clocks clean up after themselves (`autoManaged`). |

### When a file cannot be parsed

If the grammar cannot be loaded, or `ERROR` nodes cover more than 30% of the file, the adapter reads the file by lines. It finds tests by their declaration line and their indentation, and inside each test the lines that assert and the fixed sleeps. The file gets `parseStatus: "partial"` and four capabilities: `tests`, `modifiers`, `assertions`, `waits`. Rules that need anything else are skipped for that file. If no test is found either, the file is `failed`.

### Known limits

- There is no type information. A locator kept on a page object (`cartPage.checkoutButton`) is not known to be a locator.
- `const check = expect(x); check.toBe(1);` is not read as an assertion.
- An HTTP call counts as a data operation for `request.*`, `axios.*`, `fetch` and `cy.request`. A client under another name (`api.post(...)`) is not seen.
- Hooks in the model hold assertions, releases and waits. A selector or a function mock inside a hook is not stored, so `QCR-S001` does not see a brittle selector in a `beforeEach`. Module mocks in hooks are stored as file mocks.
- An after hook releases resources for every test in the file, also when it sits in another `describe` block.
- The adapter walks the syntax tree directly and has no `.scm` query files.

### Adding to the vocabulary

Add the name to the right table in `src/adapters/js/vocab.ts`, use it once in a fixture under `fixtures/adapters/js/`, then run `UPDATE_GOLDEN=1 npm test` and check the golden diff. The vocabulary test fails when an entry appears in no fixture.
