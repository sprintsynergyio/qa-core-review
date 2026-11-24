# qa-core-review: Build Spec (v2, multi-language)

> A "Plannotator for tests", for any project. `qa-core-review` reviews test code, especially tests written by AI coding agents, before it is merged. It works on any language and test framework: static rules for supported languages, and an LLM review for everything else. It flags tests that look green but check nothing, shows them in a local review page where a person approves, comments or rejects, and sends that feedback back to the agent as a ready-to-paste prompt.

This file is the full spec. `CLAUDE.md` holds the short standing rules. Read both before you write any code. Build the milestones in Section 18 in order, one milestone per branch and per pull request. `SPEC.v1.md` is the earlier JS/TS-only spec, kept for reference only. Where the two differ, this file wins.

---

## 1. Facts you must not change

| Item | Value |
| --- | --- |
| Product name | `qa-core-review` |
| GitHub repo | `github.com/sprintsynergyio/qa-core-review` |
| npm package | `qa-core-review` (unscoped, like `qa-core-heal`, `qa-core-flaky` and `qa-core-verify`). This is the primary distribution. |
| CLI command | `qa-core-review` |
| Other distributions | Standalone binaries on GitHub Releases, Docker image `ghcr.io/sprintsynergyio/qa-core-review`, a pre-commit hook, CI templates (Section 15) |
| License | MIT, copyright "SprintSynergy" |
| Commit author | `SprintSynergy <usman@sprintsynergy.com>` |
| Default branch | `main`. Never push to it. Every change goes through a pull request. |
| Implementation language | TypeScript, compiled with `tsc` to `dist/`. The tool itself is always TypeScript on Node, whatever language it reviews. |
| Node | 22.6 or later (`engines.node: ">=22.6"`, `.nvmrc` contains `22`) |
| Module type | ESM (`"type": "module"`) |
| Parser | `web-tree-sitter` (WASM) with vendored grammar `.wasm` files (Section 7.2). No native parser builds. |
| Test runner | Node's built-in `node:test`, test files `tests/**/*.test.mjs` (the org convention; do not add vitest, jest or mocha as the runner) |
| Report folder | `.qa-core/review/` in the user's project (next to `.qa-core/verify/`) |
| Config file | `qa-core-review.config.json`, `.yaml` or `.yml` (Section 12) |
| Rule id prefix | `QCR-`. Existing ids (A001 to C001, X001, X002, L000 to L002) never change meaning. |

Do not mention any competition or event in code, docs or commits. Do not use any client or company names in code, fixtures, docs or examples. Use generic names (`shop`, `cart`, `login`) or the public practice site SauceDemo (`https://www.saucedemo.com`), which the other repos already use. For API examples use a generic `https://api.example.test` host.

---

## 2. The problem

AI coding agents (Claude Code, Cursor, Codex) now write a large share of test code, in every language. Those tests often pass while proving nothing:

| Problem | JS/TS | Python | Java |
| --- | --- | --- | --- |
| No real check | `expect(true).toBe(true)` | `assert True` | `assertTrue(true);` |
| Check that cannot fail | `expect(page.locator('#btn')).toBeTruthy()` | `assert (total, 42)` (a tuple is always true) | `assertNotNull(driver.findElement(By.id("btn")));` |
| Fixed sleep | `await page.waitForTimeout(3000)` | `time.sleep(3)` | `Thread.sleep(3000);` |
| Layout selector | `div:nth-child(3) > span.css-1x2y3z` | `By.XPATH, "/html/body/div[2]/span"` | `By.xpath("//div[3]/button[2]")` |
| Hidden failure | `try { expect(...) } catch {}` | `except AssertionError: pass` | `catch (AssertionError e) {}` |
| Focused or skipped test | `test.only`, `it.skip` | `@pytest.mark.skip` | `@Disabled`, `@Ignore` |
| Testing the mock | `vi.mock('./cart')` in `cart.test.ts` | `@patch("shop.cart.get_total")` in `test_cart.py` | `@Mock Cart cart;` in `CartTest` |
| Only happy paths | no error case | no `pytest.raises` | no `assertThrows` |

Reviewers do not have time to read every AI-written test line by line, and linters check style, not whether a test can go red. Teams end up with a green suite they cannot trust. This is true for a Java Selenium suite, a pytest API suite, a Go service and a Robot Framework suite just as much as for Playwright.

## 3. Users

1. **Developers using AI agents** who want a quick gate after the agent writes tests, before they commit, in whatever language the project uses.
2. **QA engineers and SDETs** reviewing test pull requests, often across several languages in one company.
3. **Engineering leads** who want one PR check that blocks hollow tests in every repo, including non-JavaScript repos that do not want Node in their build (they use the binary or Docker image).

## 4. Goals

### 4.1 v0.1.0

1. **Works on any project.** `npx qa-core-review` (or the binary, or Docker) in any repo detects the languages and test frameworks present and reviews them. It never needs Python, Java or any other toolchain to be installed.
2. **Pluggable adapters.** Each language/framework adapter turns test files into one shared normalized test model (Section 8). Rules run on that model, so most rules are written once and work in every language.
3. **Tier 1 static review** (no LLM, no key, no network, same input gives same output): JS/TS (Playwright, Cypress, Jest, Vitest, Mocha, WebdriverIO), Python (pytest, unittest, Playwright for Python, Selenium), Java (JUnit 4, JUnit 5, TestNG, Selenium, RestAssured).
4. **Tier 3 for everything else.** Any test file in a language without a static adapter is still listed, and gets an LLM review when LLM mode is on, through the generic adapter (Section 9.5).
5. The rule set in Section 10, each rule with fixtures in every Tier 1 language where it applies.
6. CLI with `pretty`, `json`, `sarif`, `markdown` and `junit` output, stable exit codes, a JSON or YAML config file, and a `--diff` mode that reviews only changed tests.
7. A local review page on `127.0.0.1` where each test is shown with inline findings and the user can approve, comment or reject. The result is exported as a prompt for the AI agent.
8. Claude Code integration (hooks, `/qa-review` command, `init`), plus written setup for Cursor and Codex. Works for test files in any language.
9. An optional, language-agnostic LLM deep review (Anthropic or OpenAI with the user's own key, or Claude Code itself with no key). Off by default.
10. Distribution: npm (primary), standalone binaries, Docker image, pre-commit hook, and CI templates for GitHub Actions, GitLab CI, Azure DevOps, Jenkins and Bitbucket Pipelines. A GitHub Action with a sticky PR comment and SARIF upload.
11. 90% or higher line coverage, CI green on Linux, Windows and macOS with Node 22 and 24.

### 4.2 v0.2.0

Tier 2 static adapters: C#/.NET (NUnit, xUnit, MSTest, Playwright for .NET), Go (`testing`, testify), Ruby (RSpec, Capybara), Kotlin (JUnit 5, Kotest), PHP (PHPUnit), Robot Framework, Gherkin/Cucumber feature files with their step definitions, k6 and JMeter performance scripts, and Postman/Newman collections. Until v0.2.0 these languages are covered by Tier 3.

## 5. Non-goals

- Running the tests. That is what `qa-core-verify` (runtime checks) and `qa-core-prcheck` do. `qa-core-review` only reads code.
- Running the user's toolchain (Python, JDK, .NET SDK, Go) or their build. Parsing is done in-process with WASM grammars.
- Type checking or cross-file type resolution. Adapters are syntactic, plus small, explicit heuristics (same-file helpers, a project helper index, the subject module from the test file name).
- Auto-fixing code. It suggests fixes and writes a prompt; the agent or the person makes the change.
- A hosted service, accounts, or telemetry. Nothing is sent anywhere unless LLM mode is turned on.
- An IDE extension (roadmap).

## 6. How it relates to the other SprintSynergy agents

| Tool | What it does | Relationship |
| --- | --- | --- |
| `qa-core-verify` | Audits a Playwright suite and, with runtime checks, proves tests go red when the feature breaks | Complementary. `review` is the fast, static, human-in-the-loop gate while code is being written, for any language and framework. `verify` is the deeper runtime proof for Playwright suites. Where a rule overlaps, `docs/rules.md` lists the matching `QCV-` id ("Also in qa-core-verify" column) so the two tools read the same. Do not add `qa-core-verify` as a dependency. |
| `qa-core-prcheck` | Picks and runs the tests a PR can affect, posts a sticky comment | `review --diff` output is designed to be embedded in the prcheck summary (Section 14.3). |
| `qa-core-heal` | Repairs broken Playwright locators | The `QCR-S001` brittle selector message points to `qa-core-heal` for Playwright locator repair. |
| `qa-core-flaky` | Triages flaky tests | The `QCR-W001` hard wait message mentions it as a next step for timing problems. |
| `playwright-migrate` | Migrates Selenium and Cypress suites to Playwright | When a Selenium or Cypress file has many S001 and W001 findings, the docs mention it as an option. Never in rule messages. |

Match these repos' conventions: `package.json` shape (author `SprintSynergy`, homepage and bugs URLs under `github.com/sprintsynergyio/...`), `tsconfig.build.json`, a `schemas/` folder with JSON Schemas, `skill/SKILL.md`, `evals/`, `scripts/pack-smoke.mjs`, `CHANGELOG.md`, and a README that shows real, copied CLI output with the date it was captured. Some older `package.json` files in the org still point at an old GitHub org name. Always use `sprintsynergyio`.

---

## 7. Architecture

### 7.1 Pipeline

```
paths / --diff base / pre-commit file list
   -> detect projects (Section 7.4): languages, runners, libraries per folder
   -> discover files (adapter default globs + config include/exclude, or git diff)
   -> pick an adapter per file (by extension, project, config override); none -> generic adapter
   -> adapter.parse: web-tree-sitter parse with the language grammar (lazy-loaded)
   -> adapter.normalize: syntax tree -> NFile (normalized test model, Section 8.1)
   -> run universal rules + the adapter's framework rules on each NTest and NFile -> Finding[]
      (a rule runs only when the adapter declares the capabilities it needs)
   -> apply inline and config suppressions and severity overrides
   -> (optional) LLM deep review: normalized model + raw numbered source -> Finding[] with source "llm"
   -> filter to changed tests when --diff
   -> Report -> reporters (pretty | json | sarif | markdown | junit) and/or review UI
   -> exit code
```

Rules never look at syntax trees. They only read the normalized model. This is what makes them language-agnostic. Anything language-specific (what an assertion looks like, what a sleep looks like) lives in the adapter's normalizer and its vocabulary tables (Section 9).

### 7.2 Parsing approach: tree-sitter through WASM

**Choice:** `web-tree-sitter` (the official WASM build of tree-sitter) plus one vendored `.wasm` grammar per language, queried with tree-sitter query files (`.scm`) per adapter.

**Why:**
- One parser API for every language. Mature grammars exist for all Tier 1 and Tier 2 languages (JavaScript, TypeScript, TSX, Python, Java, C#, Go, Ruby, Kotlin, PHP, XML for JMeter).
- WASM means no native addon and no `node-gyp`. It installs and runs the same on Windows, macOS and Linux, inside `npx`, inside a Node SEA binary and inside Docker.
- Error tolerant: a file with a syntax error still gives a tree with `ERROR` nodes, so we can review most of a half-written file and report `QCR-X001` only when it is badly broken.
- Fast enough for the 2-second post-edit hook (parse of a 1,000-line file is a few milliseconds; grammar load is lazy and cached per process).
- Exact 1-based line and column positions for findings, SARIF and the UI.

**How:**
- `src/parse/treesitter.ts` initializes `web-tree-sitter` once, loads a grammar the first time a file of that language is seen, and caches it.
- Grammars live in `grammars/*.wasm` with `grammars/manifest.json` listing for each: language, grammar repo URL, git commit or npm version, license, ABI version, and sha256. `scripts/build-grammars.mjs` rebuilds them with the tree-sitter CLI pinned to the version matching `web-tree-sitter`. At build time, check which `web-tree-sitter` version is current and which grammar ABI it accepts; pin both and record them in the manifest. A test checks every sha256 and that each grammar loads and parses a tiny sample on all three OSes.
- Queries live in `src/adapters/<adapter>/queries/*.scm`. Normalizers combine query captures with small tree walks.
- All asset paths (grammars, `ui/`, `schemas/`, `templates/`) go through `src/assets.ts`, which reads from the package folder normally and from `node:sea` assets inside the standalone binary (Section 15.2).

**Fallback (in this order):**
1. If a grammar is missing, fails to load, or the tree has `ERROR` nodes covering more than 30% of the file, the adapter uses its **lexical scanner**: a comment- and string-aware tokenizer plus line patterns from the adapter vocabulary. It extracts tests, assertions, sleeps and skip/focus markers only, sets `NFile.parseStatus = 'partial'`, declares a reduced capability set (so only A001, A002, W001, F001, F002 run), and lowers finding confidence to `low`.
2. If that also fails, the file gets `QCR-X001` and is handed to the generic adapter (LLM-only when LLM mode is on).

**Considered and rejected:** the TypeScript compiler API (JS/TS only; v1 used it, but two parsers would double the rule work), native tree-sitter bindings or `@ast-grep/napi` (native builds and prebuilt binaries per OS, which break `npx` on some Windows machines and complicate the SEA binary), and calling each language's own parser through a subprocess (needs Python, a JDK, etc. installed). `typescript` is no longer a runtime dependency.

### 7.3 Adapter interface

Adapters live in `src/adapters/<id>/` and are registered in `src/adapters/index.ts`. The interface, in `src/adapters/types.ts`:

```ts
export type Tier = 1 | 2 | 3;

export type Capability =
  | 'tests' | 'suites' | 'hooks' | 'modifiers' | 'parameterized'
  | 'assertions' | 'assertion-operands' | 'waits' | 'selectors'
  | 'try-blocks' | 'mocks' | 'subject' | 'network' | 'data' | 'resources'
  | 'body-hash' | 'helpers' | 'reachability';

export interface FrameworkDescriptor {
  id: FrameworkId;                    // 'playwright', 'pytest', 'junit5', ...
  role: 'runner' | 'library';         // pytest is a runner; selenium is a library
  displayName: string;
  projectMarkers: ProjectMarker[];    // dependency names in manifests (Section 7.4)
  fileMarkers: string[];              // import or annotation patterns that prove use in a file
}

export interface ProjectProbe {       // read-only view of one folder, no code execution
  dir: string;                        // root-relative, '/' separators
  hasFile(name: string): boolean;
  readText(name: string, maxBytes?: number): string | null;
  list(globPattern: string, limit: number): string[];
}

export interface DetectedProject {
  dir: string;
  adapterId: string;
  languages: LanguageId[];
  frameworks: FrameworkId[];          // runners and libraries found in manifests
  evidence: string[];                 // e.g. 'pom.xml: org.junit.jupiter:junit-jupiter'
}

export interface SourceFile {
  path: string;                       // root-relative, '/' separators
  absPath: string;
  text: string;                       // LF-normalized for positions; original kept for hashing
  language: LanguageId;
  project: DetectedProject | null;
}

export interface AdapterContext {
  config: ResolvedConfig;
  helperIndex: HelperIndex;           // assertion helpers found in support files (Section 8.1)
  parser: TreeSitterService;
}

export interface LanguageAdapter {
  id: string;                         // 'js', 'python', 'java', 'generic', ...
  tier: Tier;
  languages: LanguageId[];
  extensions: string[];               // ['.py']
  grammars: string[];                 // grammar ids from grammars/manifest.json
  frameworks: FrameworkDescriptor[];
  defaultInclude: string[];           // globs for test files
  defaultExclude: string[];
  commentSyntax: { line: string[]; block?: [string, string][] };  // for suppressions and fixture markers
  capabilities: Capability[];         // what normalize() fills in reliably

  detectProject(probe: ProjectProbe): DetectedProject | null;
  classifyFile(file: SourceFile): 'test' | 'support' | 'ignore';
  detectFrameworks(file: SourceFile, tree: SyntaxTree | null): { runner: FrameworkId; libraries: FrameworkId[]; confidence: 'high' | 'medium' | 'low' };
  parse(file: SourceFile, ctx: AdapterContext): Promise<ParsedFile>;   // tree or lexical tokens
  normalize(parsed: ParsedFile, ctx: AdapterContext): NFile;
  collectHelpers?(parsed: ParsedFile): HelperDef[];                     // for the helper index
  rules?: Rule[];                     // framework-specific rules owned by this adapter
}
```

Rules declare what they need:

```ts
export interface Rule {
  id: string;                         // 'QCR-A001'
  name: string;                       // 'no-assertion'
  defaultSeverity: Severity;
  scope: 'universal' | 'framework';
  appliesTo?: { languages?: LanguageId[]; frameworks?: FrameworkId[] };
  requires: Capability[];
  description: string;
  check(ctx: RuleContext): FindingDraft[];   // ctx: { file: NFile, test?: NTest, all: NFile[], config, options }
}
```

The engine runs a rule on a file only if the file's adapter declares every capability in `requires` and `appliesTo` matches. Otherwise the rule is listed in `FileResult.rulesSkipped` with the reason, so a missing capability never turns into a false "no assertion" finding.

Adding a language later means: add a grammar, write an adapter folder (detector, queries, vocabulary, normalizer), add fixtures and golden models, and register it. No rule code changes for universal rules.

### 7.4 Project detection and monorepos

`src/detect/` walks the tree from `--root` (using `git ls-files --cached --others --exclude-standard` when inside a git repo, else a directory walk with the default excludes), and asks every adapter's `detectProject` about each folder that holds a manifest. Detection only reads files. It never runs a build tool or a package manager.

| Marker | Adapter | What it tells us |
| --- | --- | --- |
| `package.json` (dependencies and devDependencies) | js | `@playwright/test`, `cypress`, `jest`, `vitest`, `mocha`, `webdriverio` / `@wdio/*`; `k6` imports in scripts (Tier 2 perf) |
| `tsconfig.json`, `jsconfig.json`, `playwright.config.*`, `cypress.config.*`, `jest.config.*`, `vitest.config.*`, `.mocharc*`, `wdio.conf.*` | js | the runner, even without dependencies (for example a global install) |
| `pyproject.toml`, `requirements*.txt`, `setup.cfg`, `setup.py`, `Pipfile`, `poetry.lock`, `tox.ini`, `pytest.ini`, `conftest.py` | python | `pytest`, `pytest-playwright` / `playwright`, `selenium`, `requests`; unittest is assumed when no runner is found |
| `pom.xml`, `build.gradle`, `build.gradle.kts`, `settings.gradle*` | java (and kotlin in v0.2) | `junit` 4, `junit-jupiter`, `testng`, `selenium-java`, `rest-assured`, `com.microsoft.playwright`, `cucumber-java`, `kotest` |
| `*.csproj`, `*.sln`, `Directory.Packages.props` | dotnet (v0.2) | `NUnit`, `xunit`, `MSTest.TestFramework`, `Microsoft.Playwright.*`, `Selenium.WebDriver` |
| `go.mod` | go (v0.2) | `github.com/stretchr/testify` |
| `Gemfile`, `*.gemspec`, `.rspec` | ruby (v0.2) | `rspec`, `capybara` |
| `composer.json`, `phpunit.xml*` | php (v0.2) | `phpunit/phpunit` |
| `*.robot`, `robot.toml` | robot (v0.2) | Robot Framework, `SeleniumLibrary`, `Browser` |
| `*.feature` | gherkin (v0.2) | Cucumber, plus the step definition language from the nearest project |
| `*.jmx`, `*.postman_collection.json` | perf, postman (v0.2) | JMeter, Postman/Newman |

Monorepo rules:
- A folder can match several adapters (a Java service with Playwright TS e2e tests in `e2e/`). Each file belongs to the nearest project above it for its own language.
- Framework detection per file combines the project's manifest frameworks with the file's own markers (imports, annotations). File markers win when they disagree.
- `qa-core-review detect` prints the detected projects, their frameworks and evidence, and the counts of test files per adapter, so users can see what will be reviewed. `--format json` gives the same as data.
- Config `projects` entries (Section 12) override detection for a folder: force a language, a runner, extra libraries, or extra include globs.
- Tier 2 and other files with no static adapter are still discovered by the generic adapter's naming patterns and listed in the report as `llm-only`.

### 7.5 Coverage tiers

| Tier | Ships in | Languages and frameworks | Review type |
| --- | --- | --- | --- |
| 1 | v0.1.0 | JS/TS: Playwright, Cypress, Jest, Vitest, Mocha, WebdriverIO. Python: pytest, unittest, Playwright for Python, Selenium. Java: JUnit 4, JUnit 5, TestNG, Selenium, RestAssured | Full static rules + optional LLM |
| 2 | v0.2.0 | C#/.NET: NUnit, xUnit, MSTest, Playwright for .NET. Go: `testing`, testify. Ruby: RSpec, Capybara. Robot Framework. Gherkin/Cucumber feature files plus step definitions. k6 and JMeter. Postman/Newman collections. Kotlin. PHP: PHPUnit | Full static rules + optional LLM |
| 3 | v0.1.0 | Anything else (Scala, Swift, Rust, Dart, Elixir, C++, shell test suites, Tier 2 before v0.2.0, and so on) through the generic adapter: file glob plus language hint | Listed in the report; LLM-only review when LLM mode is on; optional user-supplied line patterns for a few low-confidence static checks (Section 9.5) |

The README and `docs/languages.md` show this table, plus a per-rule support matrix generated from the adapters' capability lists (`scripts/gen-support-matrix.mjs`, checked in CI so it never goes stale).

### 7.6 Dependencies

Runtime:
- `web-tree-sitter` (WASM parser runtime, no native code).
- `yaml` (YAML config parsing; pure JS, no dependencies; parse only, never with custom tags that run code).

Everything else uses Node built-ins: `node:http` for the UI server, `node:child_process` for git, `node:crypto` for hashes, global `fetch` for LLM and GitHub calls, `node:util` `parseArgs` for flags, `node:sea` for binary assets. Glob matching: a small glob-to-RegExp helper in `src/util/glob.ts` (support `**`, `*`, `?`, `{a,b}`), because `fs.glob` is not stable on Node 22.6. Gherkin, Robot, Postman JSON and the generic lexical scanner are small hand-written parsers. No UI framework: the review page is plain HTML, CSS and vanilla JS in `ui/`.

Dev: `typescript`, `@types/node`, `c8` (coverage), `ajv` and `ajv-formats` (schema tests), `esbuild` (bundle for the SEA binary), `postject` (inject the SEA blob), `tree-sitter-cli` (only used by `scripts/build-grammars.mjs`, run by hand, never in `npm ci` lifecycle scripts).

Grammar `.wasm` files are vendored in `grammars/` (built from the upstream grammar repos, MIT licensed; their licenses are listed in `grammars/LICENSES.md`). If a needed grammar is not MIT, Apache-2.0 or BSD, stop and ask.

### 7.7 Folder structure

```
qa-core-review/
  .github/
    workflows/ci.yml             # typecheck, lint, coverage, eval, pack smoke, binary smoke on 3 OSes
    workflows/self-review.yml    # runs the action on this repo's own PRs (Linux)
    workflows/release.yml        # on tag only (Muhammad tags): binaries, Docker image, npm publish
    PULL_REQUEST_TEMPLATE.md
  action.yml                     # composite GitHub Action
  .pre-commit-hooks.yaml         # for the pre-commit framework
  Dockerfile  .dockerignore
  src/
    cli.ts  index.ts  version.ts  assets.ts
    config/     load.ts  defaults.ts  yaml.ts
    detect/     projects.ts  probe.ts
    discover/   files.ts  diff.ts
    parse/      treesitter.ts  lexical.ts  positions.ts
    model/      types.ts  build.ts  hash.ts  helpers-index.ts   # normalized model (Section 8.1)
    adapters/
      types.ts  index.ts
      js/        adapter.ts  detect.ts  vocab.ts  normalize.ts  queries/*.scm  rules/
      python/    adapter.ts  detect.ts  vocab.ts  normalize.ts  queries/*.scm  rules/
      java/      adapter.ts  detect.ts  vocab.ts  normalize.ts  queries/*.scm  rules/
      generic/   adapter.ts  patterns.ts
      dotnet/ go/ ruby/ kotlin/ php/ robot/ gherkin/ perf/ postman/    # v0.2
    rules/
      index.ts  types.ts  selectors.ts     # selectors.ts: shared selector classifier for S001
      qcr-a001-no-assertion.ts  qcr-a002-trivial-assertion.ts  qcr-a003-cannot-fail.ts
      qcr-a004-conditional-assertion.ts  qcr-w001-hard-wait.ts  qcr-s001-brittle-selector.ts
      qcr-e001-swallowed-error.ts  qcr-f001-focused-test.ts  qcr-f002-skipped-test.ts
      qcr-d001-duplicate-test.ts  qcr-n001-missing-negative-case.ts  qcr-m001-over-mocking.ts
      qcr-p001-snapshot-only.ts  qcr-c001-missing-cleanup.ts  qcr-x003-no-static-adapter.ts
    engine/     run.ts  suppress.ts  fingerprint.ts  verdict.ts  capabilities.ts
    report/     pretty.ts  json.ts  sarif.ts  markdown.ts  junit.ts
    ui/         server.ts  session.ts  feedback.ts
    llm/        index.ts  prompt.ts  anthropic.ts  openai.ts  parse.ts  redact.ts
    integrations/ claude.ts  cursor.ts  codex.ts  github.ts  ci-templates.ts  precommit.ts
    util/       glob.ts  git.ts  paths.ts  hash.ts  term.ts
  grammars/     *.wasm  manifest.json  LICENSES.md
  ui/           index.html  app.js  styles.css  highlight.js   # small per-language tokenizer
  schemas/      config.schema.json  report.schema.json  model.schema.json  llm-output.schema.json
  skill/        SKILL.md
  templates/
    claude/commands/qa-review.md
    cursor/rules/qa-core-review.mdc
    codex/AGENTS.snippet.md
    ci/github-actions.yml  gitlab-ci.yml  azure-pipelines.yml  Jenkinsfile  bitbucket-pipelines.yml
    precommit/pre-commit-config.snippet.yaml  husky-pre-commit  lefthook.snippet.yml
  docs/         rules.md  languages.md  adapters.md  config.md  integrations.md  ci.md  binary.md
                docker.md  llm.md  github-action.md  privacy.md  prcheck-integration.md
  tests/        *.test.mjs  adapters/*.test.mjs  helpers/  fixtures/llm/  schemas/
  fixtures/
    rules/<rule-id>/<language>-<framework>/bad/*     # files with expect markers
    rules/<rule-id>/<language>-<framework>/good/*
    adapters/<adapter>/<framework>/*.<ext> + *.model.json   # golden normalized models
    projects/                    # small multi-file and monorepo projects for detect/discover/diff/e2e
  evals/        corpus/<language>/<framework>/*  labels.json  run.mjs
  example-project/
    saucedemo-ts/                # AI-style Playwright TS specs for the demo
    unit-ts/                     # small cart.ts with Vitest and Jest tests
    python/                      # pytest + Playwright for Python + Selenium samples
    java/                        # JUnit 5 + Selenium + RestAssured samples (Maven layout, never built)
  scripts/      pack-smoke.mjs  check-text.mjs  record-demo.mjs  build-grammars.mjs
                build-sea.mjs  binary-smoke.mjs  gen-support-matrix.mjs
  CHANGELOG.md  LICENSE  README.md  CLAUDE.md  SPEC.md  SPEC.v1.md
  package.json  tsconfig.json  tsconfig.build.json  .nvmrc  .gitignore  .gitattributes
```

`.gitattributes` must set `* text=auto eol=lf` so fixture line numbers match on Windows, and `*.wasm binary`.

---

## 8. Data model

### 8.1 Normalized test model

Define these in `src/model/types.ts`, export them from `src/index.ts`, and mirror them in `schemas/model.schema.json` (JSON Schema draft 2020-12). Adapter golden tests (`fixtures/adapters/**/*.model.json`) are validated against this schema. `qa-core-review review --dump-model` writes `.qa-core/review/model.json` for debugging.

```ts
export type LanguageId =
  | 'javascript' | 'typescript' | 'python' | 'java'                         // Tier 1
  | 'csharp' | 'go' | 'ruby' | 'kotlin' | 'php'                             // Tier 2
  | 'robot' | 'gherkin' | 'jmeter' | 'postman'                              // Tier 2
  | 'generic';                                                              // Tier 3 (hint kept in NFile.languageHint)

export type FrameworkId =
  | 'playwright' | 'cypress' | 'jest' | 'vitest' | 'mocha' | 'webdriverio' | 'node-test'
  | 'pytest' | 'unittest' | 'playwright-python' | 'selenium'
  | 'junit4' | 'junit5' | 'testng' | 'restassured' | 'playwright-java'
  | 'nunit' | 'xunit' | 'mstest' | 'playwright-dotnet'
  | 'go-testing' | 'testify' | 'rspec' | 'capybara' | 'kotest' | 'phpunit'
  | 'robot' | 'cucumber' | 'k6' | 'jmeter' | 'postman'
  | 'unknown';

export type Modifier = 'only' | 'skip' | 'todo' | 'fixme' | 'fail' | 'xfail' | 'concurrent' | 'serial';

export interface Span { startLine: number; startColumn: number; endLine: number; endColumn: number }  // 1-based

export interface NExpr {
  text: string;                 // source text, max 200 chars
  normalized: string;           // whitespace collapsed, comments removed
  kind: 'literal' | 'identifier' | 'member' | 'call' | 'collection' | 'other';
  literal?: { type: 'bool' | 'number' | 'string' | 'null' | 'empty-collection'; value: string };
  isLocator: boolean;           // a UI element handle or locator (Playwright Locator, Selenium WebElement, Cypress chain)
  isCount: boolean;             // a length, size, count of something
  isMock: boolean;              // refers to a mock or spy
}

export type AssertionKind =
  | 'equality' | 'truthiness' | 'nullness' | 'comparison' | 'contains' | 'type'
  | 'throws' | 'status' | 'snapshot' | 'visual' | 'mock-call' | 'ui-state' | 'count'
  | 'fail-call' | 'other';

export interface NAssertion {
  span: Span;
  text: string;                 // evidence, max 200 chars
  kind: AssertionKind;
  library: string;              // 'expect', 'node-assert', 'chai', 'pytest-assert', 'unittest', 'junit', 'assertj',
                                // 'hamcrest', 'testng', 'restassured', 'cypress-should', 'playwright', ...
  actual: NExpr | null;
  expected: NExpr | null;
  matcher: string | null;       // 'toBe', 'assertEquals', 'is_visible', ...
  negated: boolean;
  soft: boolean;                // expect.soft, SoftAssertions, pytest-check
  complete: boolean;            // false when the assertion is started but never finished (expect(x) with no matcher, AssertJ assertThat(x) with no method)
  awaited: 'yes' | 'no' | 'not-needed';    // async assertions only
  guarded: boolean;             // inside if / switch / ternary / short-circuit / loop / callback within the test body
  reachable: boolean;           // false after an unconditional return / throw / fail in the same block
  viaHelper: string | null;     // helper name when counted through a helper call
  statusCodes?: number[];       // for 'status' assertions
  operator?: '>' | '>=' | '<' | '<=';      // set for comparison matchers: toBeGreaterThan is '>', assertGreaterEqual is '>='
}

export interface NWait {
  span: Span; text: string;
  kind: 'fixed-sleep' | 'condition' | 'fake-timer' | 'implicit-wait-config' | 'pacing';   // 'pacing' = load-test think time
  ms: number | null;            // when a literal
}

export interface NSelector {
  span: Span; text: string;
  api: string;                  // 'locator', 'By.xpath', 'cy.get', 'find_element', ...
  strategy: 'css' | 'xpath' | 'role' | 'test-id' | 'label' | 'text' | 'id' | 'name' | 'class' | 'link-text' | 'other';
  value: string | null;         // the literal selector, when a literal
  positional?: { kind: 'nth' | 'first' | 'last'; index: number | null; baseStrategy: NSelector['strategy'] };
}

export interface NTryBlock {
  span: Span;
  kind: 'try-catch' | 'promise-catch' | 'rescue' | 'recover' | 'expected-exception-block';
  assertionsInside: number;     // assertions in the protected part, one helper deep
  catches: string[];            // caught types: 'AssertionError', 'Throwable', '*' for a bare catch / except
  catchesAssertionFailures: boolean;   // computed by the adapter from `catches` and the language's exception tree
  handlerRethrows: boolean;
  handlerFails: boolean;        // calls fail(), pytest.fail, Assert.Fail, expect.fail ...
  handlerAsserts: boolean;
}

export interface NMock {
  span: Span; text: string;
  kind: 'module' | 'function' | 'object' | 'class' | 'network' | 'global';
  target: string;               // module path, qualified name or URL pattern
  targetsSubject: boolean | null;   // null when the adapter cannot tell
  passthrough: boolean;         // importActual / requireActual / wraps= / spy() that keeps real behavior
  stubbedReturn: boolean;       // mockReturnValue, return_value=, when().thenReturn()
  fulfillsAllNetwork: boolean;  // page.route('**/*') + fulfill, cy.intercept('*'), ...
}

export interface NResource {
  span: Span; text: string;
  kind: 'browser' | 'context' | 'page' | 'driver' | 'api-context' | 'fake-timers' | 'spy' | 'env'
      | 'global' | 'patch' | 'file' | 'connection' | 'server';
  acquiredIn: 'test' | 'hook' | 'file';
  released: boolean;            // released in the same test, a matching after hook, a fixture teardown, try-with-resources, `with`, defer, using
  autoManaged: boolean;         // framework fixtures (page, context, tmp_path, monkeypatch, @TempDir ...)
}

export interface NDataOp { span: Span; text: string; op: 'create' | 'update' | 'delete' | 'read'; via: 'http' | 'db' | 'fs' | 'other' }

export interface NStep { span: Span; text: string; kind: 'navigate' | 'action' | 'request' | 'call' | 'other' }

export interface NHook {
  span: Span;
  kind: 'beforeAll' | 'beforeEach' | 'afterEach' | 'afterAll' | 'fixture-teardown';
  scope: 'file' | 'suite' | 'global';
  releases: string[];           // normalized targets released here ('driver', 'mocks', 'timers', 'env:API_URL', ...)
  assertions: NAssertion[];
  waits: NWait[];               // sleeps and waits inside the hook (W001 reads them)
  selectors: NSelector[];       // selectors used in the hook (S001 reads them)
}

export interface NTest {
  id: string;                   // sha1(file + '\0' + fullTitle + '\0' + occurrenceIndex), first 12 hex chars
  title: string;
  fullTitle: string;            // 'Suite > Nested > test'
  suitePath: string[];
  kind: 'test' | 'scenario' | 'request' | 'load-scenario' | 'keyword-test';
  span: Span;                   // whole declaration incl. decorators / annotations
  bodySpan: Span;
  modifiers: Modifier[];
  skip: { unconditional: boolean; conditional: boolean; reason: string | null } | null;
  parameterized: { source: 'each' | 'parametrize' | 'ParameterizedTest' | 'DataProvider' | 'loop' | 'examples' | 'table'; cases: number | null } | null;
  assertions: NAssertion[];
  assertionGuards: { expectedCount: boolean; hasAssertions: boolean };   // expect.assertions(n), expect.hasAssertions()
  expectsException: boolean;    // @Test(expected=...), assertThrows, pytest.raises, toThrow, ExpectedException rule
  waits: NWait[];
  selectors: NSelector[];
  tryBlocks: NTryBlock[];
  mocks: NMock[];
  resources: NResource[];
  data: NDataOp[];
  steps: NStep[];
  statementCount: number;
  bodyHash: string | null;      // sha1 of the body token stream with comments and whitespace removed
  linkedSteps?: Array<{ file: string; span: Span }>;   // Gherkin: matched step definitions (v0.2)
}

export interface NSuite { title: string; span: Span; modifiers: Modifier[]; hooks: NHook[]; testIds: string[]; suites: NSuite[] }

export interface NFile {
  path: string;                 // root-relative, '/' separators
  language: LanguageId;
  languageHint: string | null;  // generic adapter only, e.g. 'scala'
  adapter: string;
  tier: 1 | 2 | 3;
  runner: FrameworkId;
  libraries: FrameworkId[];
  role: 'test' | 'support';
  parseStatus: 'ok' | 'partial' | 'failed' | 'llm-only';
  capabilities: Capability[];
  suites: NSuite[];
  tests: NTest[];
  fileHooks: NHook[];
  fileMocks: NMock[];
  fileResources: NResource[];
  imports: Array<{ span: Span; source: string; names: string[]; typeOnly: boolean; framework: boolean }>;
  subject: { module: string; via: 'filename' | 'subjectMap' | 'class-under-test' } | null;
  suppressions: Array<{ span: Span; scope: 'next-line' | 'file'; rules: string[]; reason: string | null }>;
}
```

**Helper index.** `src/model/helpers-index.ts` collects functions and methods that contain an assertion (one level deep) from every discovered file in the same project, including support files (page objects, `conftest.py`, base test classes). A call to such a helper counts as an assertion with `viaHelper` set. Parse results are cached in `.qa-core/review/cache/` by content sha1 so `--diff` and the post-edit hook stay fast. Config `assertionHelpers` adds names by hand.

**Rules of normalization (every adapter):**
- Positions are 1-based lines and columns on the LF-normalized text.
- `text` and evidence fields are trimmed to 200 characters.
- When the adapter cannot decide a boolean (for example `targetsSubject`), it uses `null` or leaves the capability out. Never guess `true`.
- Tests generated by `each` / `parametrize` / data providers are one `NTest` with `parameterized` set.

### 8.2 Findings and report

Define these in `src/rules/types.ts`, export them from `src/index.ts`, and mirror them in `schemas/report.schema.json`. `tests/schema.test.mjs` validates real reports against the schema with ajv.

```ts
export type Severity = 'error' | 'warn' | 'info';
export type Source = 'static' | 'llm';
export type Verdict = 'pass' | 'review' | 'fail';            // per test
export type Decision = 'pending' | 'approved' | 'rejected';  // set in the UI

export interface Location { file: string; startLine: number; startColumn: number; endLine: number; endColumn: number }

export interface Finding {
  id: string;            // fingerprint, see 8.3
  ruleId: string;        // 'QCR-A001'
  ruleName: string;      // 'no-assertion'
  severity: Severity;
  source: Source;
  message: string;       // one sentence, plain English, what is wrong
  evidence: string;      // the exact code or fact that triggered it, max 200 chars
  fix: string;           // one or two sentences, what to do instead, in the file's own language and framework
  goodExample?: string;  // short code snippet in the file's language
  location: Location;
  testId: string | null; // NTest.id, null for file-level findings
  confidence: 'high' | 'medium' | 'low';
  suppressed: boolean;
  docsUrl: string;       // https://github.com/sprintsynergyio/qa-core-review/blob/main/docs/rules.md#qcr-a001
}

export interface TestResult {
  id: string; title: string; fullTitle: string;
  location: Location; bodyLocation: Location;
  modifiers: Modifier[];
  assertionCount: number;
  verdict: Verdict;      // 'fail' if any error, 'review' if any warn, else 'pass'; info does not lower it
  findingIds: string[];
}

export interface FileResult {
  file: string;
  language: LanguageId;
  languageHint: string | null;
  adapter: string;
  tier: 1 | 2 | 3;
  runner: FrameworkId;
  libraries: FrameworkId[];
  parseStatus: 'ok' | 'partial' | 'failed' | 'llm-only';
  rulesSkipped: Array<{ ruleId: string; reason: string }>;
  tests: TestResult[];
}

export interface Report {
  schemaVersion: 2;
  tool: { name: 'qa-core-review'; version: string };
  createdAt: string;     // ISO 8601 UTC
  root: string;          // absolute path, display only
  mode: { diffBase: string | null; llm: 'off' | 'anthropic' | 'openai' | 'claude-code' };
  projects: Array<{ dir: string; adapter: string; frameworks: FrameworkId[] }>;
  rulesRun: string[];
  files: FileResult[];
  findings: Finding[];   // sorted by file, then startLine, then ruleId
  summary: {
    files: number; tests: number;
    pass: number; review: number; fail: number;
    errors: number; warnings: number; infos: number;
    suppressed: number;
    byLanguage: Record<string, { files: number; tests: number; errors: number; warnings: number }>;
    llmOnlyFiles: number;
  };
}
```

`schemaVersion` is 2 because v1 had a different `FileResult`. The prcheck contract (Section 14.3) refers to version 2.

### 8.3 Fingerprint

`Finding.id = sha1(ruleId + '\0' + file + '\0' + (testFullTitle ?? '') + '\0' + normalizedEvidence)`, first 16 hex chars. `normalizedEvidence` collapses whitespace. It must not include line numbers, so a decision made in the UI survives unrelated edits above the test.

### 8.4 Review session (UI)

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

## 9. Adapters

Each adapter has a `vocab.ts` with the tables below as data (not scattered string checks), so they can be read, tested and extended. Each adapter also documents itself in `docs/adapters.md`.

### 9.1 JS/TS adapter (`js`, Tier 1)

- **Grammars:** `javascript`, `typescript`, `tsx`. Extensions `.js .jsx .mjs .cjs .ts .tsx .mts .cts`.
- **Default include:** `**/*.{spec,test,cy}.{ts,tsx,js,jsx,mjs,cjs,mts,cts}`, `**/{tests,test,e2e,__tests__,cypress/e2e,specs}/**/*.{ts,tsx,js,jsx,mjs,cjs,mts,cts}`. Exclude `**/*.d.ts`.
- **Runners:** `playwright` (`@playwright/test` import), `cypress` (`cy.` usage, `cypress` folder or config), `jest`, `vitest` (`vitest` import or config), `mocha` (`.mocharc*`, `mocha` dependency, no jest/vitest), `webdriverio` (`@wdio/*`, `browser.$`, `$()` with `wdio.conf.*`), `node-test` (`node:test` import, a free bonus since it is the same syntax).
- **Tests and suites:** `test(...)`, `it(...)`, `specify(...)`, `describe(...)`, `context(...)`, `suite(...)`, `test.describe(...)`, modifiers `.only .skip .fixme .todo .fail .concurrent .each(...)(...)`, `test.describe.serial/parallel`, Jest aliases `fit fdescribe xit xtest xdescribe`. The test function is the last function-like argument. Template literal titles keep `${...}` as written.
- **Hooks:** `beforeAll beforeEach afterEach afterAll before after` (Mocha), `test.beforeEach` etc.
- **Assertions:** a call chain rooted at `expect(...)` (incl. `expect.soft`, `expect.poll`, `.not`, `.resolves`, `.rejects`), `assert(...)`, `assert.*(...)` (node and chai), Chai `expect`/`should` chains, Cypress `.should(...)` and `.and(...)`, plus `cy.contains('text')` when it is the last command of a test (kind `ui-state`, because it fails when the text is missing; `cy.get(...)` alone does not count), WebdriverIO `expect(...)` with `expect-webdriverio` matchers, `expect.assertions(n)` and `expect.hasAssertions()` (guards), plus helpers.
- **Playwright web-first matchers** (kind `ui-state`, must be awaited): `toBeVisible toBeHidden toHaveText toContainText toHaveValue toHaveValues toHaveURL toHaveTitle toHaveCount toBeEnabled toBeDisabled toBeChecked toHaveAttribute toHaveClass toHaveCSS toHaveScreenshot toBeAttached toBeEditable toBeFocused toBeEmpty toHaveId toHaveJSProperty toHaveAccessibleName toHaveAccessibleDescription toHaveRole toBeInViewport toBeOK toMatchAriaSnapshot`.
- **Locators (`isLocator`):** `locator getByRole getByTestId getByText getByLabel getByPlaceholder getByAltText getByTitle frameLocator first last nth filter` on `page`, a frame or a locator; `cy.get`, `cy.find`, `cy.contains`; WebdriverIO `$`, `$$`, `browser.$`; or a variable assigned from one.
- **Waits:** fixed: `page.waitForTimeout(n)`, `frame.waitForTimeout(n)`, `await new Promise(r => setTimeout(r, n))`, awaited `sleep|delay|wait|pause(n)`, `browser.pause(n)`, `cy.wait(<number>)`. Not fixed: `cy.wait('@alias')`, `waitForResponse`, `waitForURL`, `waitForSelector`, `browser.waitUntil`. Fake timers: `vi.advanceTimersByTime`, `jest.advanceTimersByTime`, `vi.runAllTimers`, `cy.clock`/`cy.tick`.
- **Selectors:** string arguments of `locator()`, `page.$()`, `page.$$()`, `$eval`, `$$eval`, `waitForSelector()`, `click(selector)`, `fill(selector, ...)`, `frameLocator()`, `querySelector(All)`, `cy.get()`, WebdriverIO `$()`/`$$()`.
- **Mocks:** `vi.mock`, `jest.mock`, `jest.unstable_mockModule` (module; passthrough when the factory spreads `vi.importActual`/`jest.requireActual`), `vi.spyOn`/`jest.spyOn`/`sinon.stub` (function; `stubbedReturn` with `mockReturnValue`, `mockImplementation`, `mockResolvedValue`, `returns`), `page.route`/`context.route` with `route.fulfill` and a `**/*` pattern, `cy.intercept('*' | '**', ...)` with a static reply (network, `fulfillsAllNetwork`).
- **Subject:** the import whose path ends with the test file's base name (`cart.test.ts` -> `./cart`, `../src/cart`, `@/cart`), or `rules.QCR-M001.subjectMap`.
- **Resources:** spies (released by `mockRestore`, `restoreAllMocks` in a hook, or `restoreMocksConfigured`), fake timers (`useRealTimers`), `vi.stubGlobal`/`vi.stubEnv` (`unstubAll*`), assignments to `process.env.X`, `globalThis.X`, `window.X`, `Date.now`, `browser.newContext()`, `browser.newPage()`, `chromium|firefox|webkit.launch()`, `request.newContext()` (`.close()`/`.dispose()`); built-in fixtures `page`, `context`, `request` are `autoManaged`.
- **Data ops:** Playwright `request.post|put|patch|delete`, `fetch(..., { method })`, `cy.request`.
- **Snapshots:** `toMatchSnapshot toMatchInlineSnapshot toMatchFileSnapshot toThrowErrorMatchingSnapshot toThrowErrorMatchingInlineSnapshot toMatchAriaSnapshot` (snapshot), `toHaveScreenshot`, `cy.matchImageSnapshot` (visual).
- **Body hash:** the token stream of the body from the tree, with comments dropped and whitespace ignored.
- **Suppression comments:** `//` and `/* */`.

### 9.2 Python adapter (`python`, Tier 1)

- **Grammar:** `python`. Extension `.py`.
- **Default include:** `**/test_*.py`, `**/*_test.py`, `**/tests/**/*.py`, `**/test/**/*.py`. `conftest.py` and other files without tests are `support` files (helpers and fixtures are indexed, no findings).
- **Runners:** `pytest` (default when any `pytest` marker or `conftest.py` exists, or the file uses `pytest.` / plain `assert` in `test_` functions), `unittest` (`unittest.TestCase` subclass). Libraries: `playwright-python` (`playwright.sync_api` / `async_api`, `pytest-playwright` `page` fixture), `selenium` (`from selenium`), `requests`/`httpx` (for status assertions).
- **Tests:** functions named `test*` at module level or in a class named `Test*` (pytest); methods `test*` in a `unittest.TestCase` subclass. Suites are classes. Docstrings are not statements for `statementCount`.
- **Hooks:** `setup_method teardown_method setup_class teardown_class setup_module teardown_module`, `setUp tearDown setUpClass tearDownClass`, `@pytest.fixture` functions: code after `yield` is a `fixture-teardown` hook; `request.addfinalizer` and `self.addCleanup` count as releases.
- **Modifiers:** `@pytest.mark.skip(reason=)` (unconditional), `@pytest.mark.skipif(cond, reason=)` (conditional), `pytest.skip()` inside the body (unconditional unless inside an `if`), `@pytest.mark.xfail` (`xfail`), `@unittest.skip`, `@unittest.skipIf/skipUnless` (conditional), `@unittest.expectedFailure` (`xfail`). There is no focus modifier, so F001 does not apply.
- **Parameterized:** `@pytest.mark.parametrize`, `subTest` loops, `pytest-cases`.
- **Assertions:** the `assert` statement (kind from the expression: `==` equality, `is None` nullness, `in` contains, comparisons, bare name truthiness), `self.assert*` methods of unittest (`assertEqual assertTrue assertFalse assertIn assertIsNone assertIsNotNone assertRaises assertAlmostEqual assertCountEqual assertRegex ...`), `pytest.raises`/`pytest.warns` (throws), Playwright `expect(locator).to_be_visible()` etc. (ui-state; in the async API it must be awaited), mock checks `assert_called*`, `assert_awaited*`, `assert_not_called` (mock-call), `pytest-check` `check.*` (soft), syrupy `assert x == snapshot` (snapshot), `assert_that` (PyHamcrest, assertpy), `self.fail`/`pytest.fail` (fail-call).
- **Locators:** `page.locator`, `page.get_by_*`, `.nth .first .last`; Selenium `driver.find_element(s)(By.X, ...)`, `find_element_by_*` (old API).
- **Waits:** fixed: `time.sleep(n)` (seconds, convert to ms), `asyncio.sleep(n)` in a test, `page.wait_for_timeout(n)`. Implicit wait config: `driver.implicitly_wait(n)`. Condition waits: `WebDriverWait(...).until(...)`, `page.wait_for_*` except timeout. Fake time: `freezegun`, `time_machine` (not waits).
- **Selectors:** string arguments of `page.locator`, `query_selector(_all)`, `wait_for_selector`, `click(selector)`, Selenium `By.XPATH`, `By.CSS_SELECTOR`, `By.CLASS_NAME`, `By.ID`, `By.NAME`, `By.LINK_TEXT` (strategy from the `By` constant).
- **Mocks:** `@patch("x.y")`, `patch.object`, `mocker.patch` (pytest-mock), `MagicMock(return_value=...)`, `monkeypatch.setattr` (function or object; `stubbedReturn` with `return_value=` or a lambda), `responses`/`respx`/`requests_mock`/`page.route("**/*", ...)` with a static body (network). `wraps=` means passthrough.
- **Subject:** `test_cart.py` -> a module `cart` (`from shop.cart import ...`, `import shop.cart`), or `subjectMap`. `@patch("shop.cart.get_total")` targets the subject when it patches a name defined in the subject module rather than something the subject imports.
- **Resources:** `webdriver.Chrome()/Firefox()/Edge()/Remote()` (released by `.quit()`), `sync_playwright().start()`, `browser.new_context()`, `browser.new_page()` (released by `.close()`), `patch(...).start()` (`.stop()` or `patch.stopall`), `os.environ[...] = ` (released by restoring, or use `monkeypatch.setenv` which is `autoManaged`), opened files and connections not in a `with` block. Fixtures `page`, `context`, `browser`, `tmp_path`, `monkeypatch`, `mocker`, `capsys` are `autoManaged`.
- **Try blocks:** `try/except` and `contextlib.suppress(...)`. `catchesAssertionFailures` is true for bare `except:`, `except BaseException`, `except Exception`, `except AssertionError`, and tuples containing them (AssertionError is an `Exception` subclass in Python).
- **Body hash:** token stream without comments and docstrings.
- **Suppression comments:** `#`.

### 9.3 Java adapter (`java`, Tier 1)

- **Grammar:** `java`. Extension `.java`.
- **Default include:** `**/src/test/java/**/*.java`, `**/*Test.java`, `**/*Tests.java`, `**/*IT.java`, `**/Test*.java`. Files under `src/test` without test methods (page objects, base classes, utilities) are `support` files.
- **Runners:** `junit5` (`org.junit.jupiter`), `junit4` (`org.junit.Test`), `testng` (`org.testng`). Libraries: `selenium` (`org.openqa.selenium`), `restassured` (`io.restassured`), `playwright-java` (`com.microsoft.playwright`), AssertJ, Hamcrest, Mockito, cucumber-java (step definitions; linked in v0.2).
- **Tests:** methods annotated `@Test`, `@ParameterizedTest`, `@RepeatedTest`, `@TestFactory`, `@TestTemplate` (JUnit 5), `@Test` (JUnit 4, TestNG). Suites are classes, `@Nested` inner classes are nested suites. `@DisplayName` gives the title when present.
- **Hooks:** `@BeforeEach @AfterEach @BeforeAll @AfterAll` (JUnit 5), `@Before @After @BeforeClass @AfterClass` (JUnit 4), `@BeforeMethod @AfterMethod @BeforeClass @AfterClass @BeforeSuite @AfterSuite @BeforeTest @AfterTest` (TestNG). Base class hooks in support files are found through the helper index by class name (`extends BaseTest`).
- **Modifiers:** `@Disabled`, `@Ignore`, `@Test(enabled = false)` (unconditional skip, reason from the annotation value or `description`), `@DisabledOnOs`, `@EnabledIf*`, `@DisabledIf*`, `Assumptions.assumeTrue(...)` / `Assume.assumeTrue(...)` (conditional skip). No focus modifier in Java, so F001 does not apply.
- **Parameterized:** `@ParameterizedTest` with `@ValueSource`, `@CsvSource`, `@MethodSource`; TestNG `@DataProvider`; JUnit 4 `@RunWith(Parameterized.class)`.
- **Assertions:** JUnit `Assert.*`, `Assertions.*` (`assertEquals assertTrue assertFalse assertNull assertNotNull assertSame assertThrows assertAll assertTimeout fail ...`), static imports of the same; TestNG `Assert.*` (note: TestNG `assertEquals(actual, expected)` has the opposite order to JUnit; operands are still `actual`/`expected` by position per library); AssertJ `assertThat(x).<method>()` (incomplete when no method is chained), `SoftAssertions` (soft; incomplete without `assertAll()` or `@ExtendWith(SoftAssertionsExtension.class)`); Hamcrest `assertThat(x, matcher)`; RestAssured `.then().statusCode(n)`, `.body(...)`, `.assertThat()` chains (status, equality, contains); Playwright `assertThat(locator).isVisible()` (ui-state); Mockito `verify(...)` (mock-call); `@Test(expected = X.class)`, `@Test(expectedExceptions = ...)` and `ExpectedException` rule (expectsException).
- **Locators:** Selenium `driver.findElement(s)(By.x(...))`, `@FindBy(...)` fields, `WebElement` variables; Playwright `page.locator`, `page.getBy*`.
- **Waits:** fixed: `Thread.sleep(n)`, `TimeUnit.X.sleep(n)` (convert), `page.waitForTimeout(n)`, `Uninterruptibles.sleepUninterruptibly`. Implicit wait config: `manage().timeouts().implicitlyWait(...)`. Condition: `WebDriverWait`/`FluentWait` `.until(...)`, Awaitility `await().until(...)`.
- **Selectors:** `By.xpath`, `By.cssSelector`, `By.className`, `By.id`, `By.name`, `By.linkText`, `By.tagName`, `@FindBy(xpath = ...)` etc., Playwright `page.locator(...)`.
- **Mocks:** Mockito `@Mock`, `mock(X.class)`, `@Spy`/`spy(x)` (passthrough unless stubbed), `when(...).thenReturn/thenAnswer`, `doReturn(...).when(...)` (stubbedReturn), `@InjectMocks` (the real subject, not a mock), WireMock `stubFor(any(anyUrl()))` with a static body (network).
- **Subject:** the class under test from the test class name (`CartTest`, `CartTests`, `CartIT`, `TestCart` -> `Cart`), or `@InjectMocks` field type, or `subjectMap`. A `@Mock Cart cart` / `mock(Cart.class)` in `CartTest` that is stubbed and then asserted on targets the subject.
- **Resources:** `new ChromeDriver()`, `new FirefoxDriver()`, `new RemoteWebDriver(...)`, `WebDriverManager...create()` (released by `quit()`), Playwright `Playwright.create()`, `browser.newContext()`, `newPage()` (`close()`), `System.setProperty` (restore with `clearProperty`), `Mockito.mockStatic` (released by `close()` or try-with-resources). try-with-resources always counts as released.
- **Try blocks:** `try/catch`. `catchesAssertionFailures` is true for `catch (Throwable ...)`, `catch (Error ...)`, `catch (AssertionError ...)`, `catch (AssertionFailedError ...)` and multi-catch containing them. `catch (Exception e)` does **not** catch assertion failures in Java (they are `Error`s), so it is not reported by E001.
- **Body hash:** token stream without comments.
- **Suppression comments:** `//` and `/* */`. Annotation `@SuppressWarnings("qa-core-review:QCR-W001")` is not supported; use comments.

### 9.4 Tier 2 adapters (v0.2.0)

Each Tier 2 adapter follows the same interface, vocabulary-table approach, fixtures and golden models as Tier 1. Starting points:

| Adapter | Files and runners | Key vocabulary notes |
| --- | --- | --- |
| `dotnet` (C#) | `*Tests.cs`, `*Test.cs`, `**/*.Tests/**/*.cs`; NUnit `[Test] [TestCase] [TestFixture]`, xUnit `[Fact] [Theory]`, MSTest `[TestMethod] [TestClass]`, Playwright .NET `PageTest` base classes | `Assert.*`, `Assert.That`, FluentAssertions `.Should()`, `Expect(locator).ToBeVisibleAsync()` must be awaited; `Thread.Sleep`, `Task.Delay`; `[Ignore]`, `[Fact(Skip = "...")]`; `[Explicit]` treated as skip; `catch (Exception)` does catch NUnit `AssertionException` (it derives from `Exception`), so E001 applies; Moq `Setup().Returns()`, NSubstitute `Returns`. Focus: NUnit `[Explicit]`/`[Category("only")]` are not focus; F001 does not apply. |
| `go` | `*_test.go`; `func TestX(t *testing.T)`, `t.Run` subtests, testify `assert`/`require`, `suite.Suite` | Assertions: `t.Error*`, `t.Fatal*` inside a condition count as the assertion (kind `fail-call`; the `if` is the check, so A004 must treat `if got != want { t.Errorf(...) }` as a guard pattern, not a conditional assertion); `time.Sleep`; `t.Skip`; `t.Cleanup` and `defer` release resources. |
| `ruby` | `*_spec.rb`, `spec/**/*.rb`; RSpec `describe/context/it`, Capybara | `expect(x).to`, `should`; `fit fdescribe focus: true` (F001), `xit skip pending` (F002); `sleep n`; Capybara `find(:xpath, ...)`, `all(...)[n]`; `allow(...).to receive().and_return` (stubbedReturn); `rescue` blocks. |
| `kotlin` | `src/test/kotlin/**/*.kt`; JUnit 5, Kotest specs | Java vocabulary plus Kotest `shouldBe`, `shouldThrow`, `xtest`/`ftest` focus/skip prefixes (`f` prefix is focus in Kotest), `delay()` in coroutines, MockK `every { } returns`. |
| `php` | `tests/**/*Test.php`; PHPUnit `test*` methods, `#[Test]`, `@test` | `$this->assert*`, `$this->expectException`; `sleep`, `usleep`; `markTestSkipped`; `createMock` + `willReturn`. |
| `robot` | `*.robot` (line-based parser, no grammar) | Test cases section; assertions are keywords starting with `Should`, `Element Should`, `Page Should`, `Wait Until ... Contains`, `Get Text` + `Should Be Equal`; `Sleep` is a fixed wait; `[Tags] robot:skip` and `Skip` keyword; XPath and CSS locators in `xpath=`/`css=` arguments; user keywords in resource files are helpers. |
| `gherkin` | `*.feature` (line-based parser) plus step definitions parsed by the JS, Python, Java, Ruby or C# adapter | Each scenario is an `NTest` (kind `scenario`); its assertions are those of the step definitions its steps match (Cucumber expressions and regex). Scenario outlines are parameterized (`examples`). `@skip`/`@ignore`/`@wip` tags are skip modifiers; `@only`/`@focus` are focus. Framework rule `QCR-G001 unmatched-step` (warn): a step with no matching step definition in the project. |
| `perf` | k6 scripts (JS adapter grammar, `import http from 'k6/http'`), JMeter `*.jmx` (XML grammar) | A k6 default function or scenario is a `load-scenario` test; `check()` is an assertion; `sleep()` is `pacing`, not a hard wait, so W001 does not fire for k6. JMeter thread groups are tests; Response/JSON/Duration Assertions are assertions; Constant Timers are `pacing`. Framework rule `QCR-K001 perf-no-thresholds` (warn): a load script with no thresholds (k6 `options.thresholds`) and no duration or error-rate assertion. |
| `postman` | `*.postman_collection.json` (JSON, scripts in `event[].script.exec` parsed with the JS grammar and line-mapped back to the JSON) | Each request with a test script is a `request` test; `pm.test` blocks with `pm.expect` / `pm.response.to.have.status` are assertions; a request with no test script gets A001. Suppression is config-only (JSON has no comments). |

### 9.5 Generic adapter (`generic`, Tier 3)

The fallback that makes every project reviewable.

- **Which files:** any file matched by a config `generic` entry, plus files matching common test naming patterns in a language no other adapter handles: `**/*{Test,Tests,Spec,_test,_spec,.test,.spec}.*`, `**/test_*.*`, `**/{test,tests,spec,specs}/**/*.*`, filtered to text files under 1 MB with a known source extension (`.scala .swift .rs .dart .ex .exs .cpp .cc .c .m .lua .r .jl .clj .sh .bats .ps1` and Tier 2 extensions before v0.2.0). The language hint comes from the extension table in `src/adapters/generic/languages.ts` or the config entry.
- **Static part:** none by default. Each file gets one info finding `QCR-X003 no-static-adapter`: "No static rules for <language> yet. Run with --llm to review this file." (shown once per language in pretty output, every file in JSON). The file appears in the report with `parseStatus: 'llm-only'`.
- **Optional user patterns:** a `generic` config entry can give regexes (`testPattern`, `assertionPattern`, `sleepPattern`, `skipPattern`, `focusPattern`). With these, the lexical scanner splits the file into tests (from a test match to the next one at the same or lower indent, or a matching closing brace) and enables A001, W001, F001 and F002 with `confidence: low`. Document this with a Scala and a Rust example in `docs/languages.md`.
- **LLM part:** in LLM mode, these files are sent with the language hint and the raw numbered source; the model also returns the test boundaries it sees (Section 16.3), which become `NTest` entries so the UI can show them one by one.

---

## 10. Rules

### 10.0 Rule contract and fixtures

Every rule:

- Lives in its own file `src/rules/qcr-xxxx-<name>.ts` (universal) or `src/adapters/<id>/rules/qcr-xxxx-<name>.ts` (framework-specific), and exports the `Rule` object from Section 7.3.
- Reads only the normalized model (Section 8.1). It never imports tree-sitter or an adapter.
- Builds `fix` and `goodExample` from a per-language message table (`src/rules/fix-text.ts`), so a Python finding suggests Python code and a Java finding suggests Java code. The text in this section is the JS/TS version; write equivalents for Python and Java from the examples given.
- Has at least 3 bad and 3 good fixtures **per Tier 1 language where it applies** (and per framework family where the vocabulary differs, for example Playwright TS and Cypress for S001, pytest and unittest for A002, JUnit 5 and TestNG for F002). Path: `fixtures/rules/<id>/<language>-<framework>/{bad,good}/`.
- Is documented in `docs/rules.md` with an anchor, the bad and good examples for each Tier 1 language, the support matrix row, and how to disable it.
- Must not fire on any file in any `fixtures/rules/*/*/good/` folder.

**Fixture convention:** each bad fixture marks every expected finding with a trailing comment in the file's own comment syntax, on the line where the finding starts: `// expect: QCR-A002` (JS/TS, Java, C#, Go, Kotlin, PHP), `# expect: QCR-A002` (Python, Ruby, Robot, Gherkin, YAML). Several ids are comma separated. Formats with no comments (Postman JSON, JMeter XML when a comment would change the structure) use a sidecar `<file>.expect.json`: `[{ "ruleId": "QCR-A001", "line": 12 }]`. A shared helper `tests/helpers/fixtures.mjs` runs the engine on every fixture and asserts that the set of `(ruleId, line)` pairs equals the set of markers. Good fixtures have no markers, so they must produce no findings from any rule.

### 10.1 Rule map: normalized model, scope and language support

Rule ids are stable from v1. "Universal" means the rule logic is written once on the model and works for every adapter that declares the capabilities. "Framework" means it only makes sense for some frameworks; the logic is still on the model where possible, and adapters provide the facts.

| Id | Name | Scope | Model facts used (`requires`) | JS/TS | Python | Java | Tier 2 notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| QCR-A001 | no-assertion | universal | `tests`, `assertions`, `helpers` | yes | yes | yes | all; Go `t.Error*`, Robot `Should*`, k6 `check`, Postman `pm.expect` count |
| QCR-A002 | trivial-assertion | universal | `assertions`, `assertion-operands` | yes | yes | yes | all with operand capture |
| QCR-A003 | cannot-fail-assertion | universal core + framework sub-cases | `assertions`, `assertion-operands`, `reachability` | yes | yes | yes | .NET unawaited `Expect(...)`, Ruby `expect(x)` without `.to` |
| QCR-A004 | conditional-assertion | universal | `assertions` (`guarded`) | yes | yes | yes | Go `if got != want { t.Errorf }` is not conditional |
| QCR-W001 | hard-wait | universal | `waits` | yes | yes | yes | all; k6/JMeter `pacing` excluded |
| QCR-S001 | brittle-selector | framework (UI: Playwright, Cypress, WebdriverIO, Selenium, Capybara, Robot SeleniumLibrary/Browser) | `selectors` | yes | yes | yes | .NET, Ruby, Robot, Kotlin |
| QCR-E001 | swallowed-error | universal | `try-blocks` | yes | yes | yes | Ruby `rescue`, C# `catch`, Kotlin `runCatching` |
| QCR-F001 | focused-test | framework (runners that have focus) | `modifiers` | yes | n/a (no focus in pytest/unittest) | n/a (no focus in JUnit/TestNG) | RSpec, Kotest, Gherkin `@only` |
| QCR-F002 | skipped-test | universal | `modifiers` | yes | yes | yes | all |
| QCR-D001 | duplicate-test | universal | `body-hash` | yes | yes | yes | all |
| QCR-N001 | missing-negative-case | universal | `tests`, `suites`, `assertions` | yes | yes | yes | all |
| QCR-M001 | over-mocking | universal core + framework subject detection | `mocks`, `subject`, `assertions` | yes | yes | yes | .NET Moq/NSubstitute, Ruby rspec-mocks, Kotlin MockK, PHP |
| QCR-P001 | snapshot-only | universal | `assertions` (`snapshot`, `visual`) | yes | yes (syrupy, snapshottest) | yes (ApprovalTests, Selfie) | .NET Verify, Ruby rspec-snapshot |
| QCR-C001 | missing-cleanup | universal | `resources`, `hooks` | yes | yes | yes | Go `t.Cleanup`/`defer`, C# `using`/`IDisposable` |
| QCR-X001 | parse-error | universal | none | yes | yes | yes | all |
| QCR-X002 | suppression-without-reason | universal | none | yes | yes | yes | all with comments |
| QCR-X003 | no-static-adapter | generic adapter (new) | none | n/a | n/a | n/a | every Tier 3 file |
| QCR-G001 | unmatched-step | framework, gherkin (new, v0.2) | `linkedSteps` | n/a | n/a | n/a | Gherkin |
| QCR-K001 | perf-no-thresholds | framework, perf (new, v0.2) | `assertions` | n/a | n/a | n/a | k6, JMeter |
| QCR-L000 to L002 | llm-unavailable, llm-finding, llm-missing-case | LLM | none | yes | yes | yes | all, plus Tier 3 |

New framework-specific rules take the next free number in their category letter (A assertions, W waits, S selectors, E errors, F focus/skip, D duplicates, N negative cases, M mocks, P snapshots, C cleanup, G Gherkin, K performance, X tool). An id is never reused or renumbered.

### 10.2 QCR-A001 `no-assertion` (error)

**Detects:** a test with zero assertions, after counting helpers one level deep and the helper index. Skipped, `todo` and `fixme` tests are ignored. Tests that declare an expected exception (`expectsException`) count as having an assertion.

**On the model:** `test.assertions.length === 0 && !test.expectsException && test.statementCount >= 1`. Report at the test title.

Bad (TS):
```ts
test('user can log in', async ({ page }) => {
  await page.goto('https://www.saucedemo.com');
  await page.getByPlaceholder('Username').fill('standard_user');
  await page.getByPlaceholder('Password').fill('secret_sauce');
  await page.getByRole('button', { name: 'Login' }).click();
});
```
Good (TS):
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
Bad (Python, Selenium):
```python
def test_user_can_log_in(driver):
    driver.get("https://www.saucedemo.com")
    driver.find_element(By.ID, "user-name").send_keys("standard_user")
    driver.find_element(By.ID, "password").send_keys("secret_sauce")
    driver.find_element(By.ID, "login-button").click()
```
Good (Python, Selenium):
```python
def test_user_can_log_in(driver):
    driver.get("https://www.saucedemo.com")
    driver.find_element(By.ID, "user-name").send_keys("standard_user")
    driver.find_element(By.ID, "password").send_keys("secret_sauce")
    driver.find_element(By.ID, "login-button").click()
    WebDriverWait(driver, 10).until(EC.url_contains("inventory.html"))
    assert driver.find_element(By.CLASS_NAME, "title").text == "Products"
```
Bad (Java, RestAssured):
```java
@Test
void createsOrder() {
    given().body(order).post("/orders");
}
```
Good (Java, RestAssured):
```java
@Test
void createsOrder() {
    given().body(order).post("/orders")
        .then().statusCode(201).body("status", equalTo("NEW"));
}
```
Fix text: "Add an assertion that checks the result of the action, for example the URL, a visible element or the response body."

### 10.3 QCR-A002 `trivial-assertion` (error)

**Detects:** assertions whose result is fixed by the code itself.

**On the model:** an assertion where:
- `actual.kind === 'literal'` and `kind` is `equality`, `truthiness` or `nullness` (`expect(true).toBe(true)`, `assert True`, `assertTrue(true)`, `assertThat(1).isEqualTo(1)`); or
- `actual.normalized === expected.normalized` (`expect(a).toBe(a)`, `assert x == x`, `assertEquals(total, total)`); or
- a bare literal truthiness check (`assert(true)`, `assert.ok(1)`, `self.assertTrue(1)`).

Bad / good:
```ts
it('adds items to the cart', () => { addToCart(cart, item); expect(true).toBe(true); });          // bad
it('adds items to the cart', () => { addToCart(cart, item); expect(cart.items).toContainEqual(item); }); // good
```
```python
def test_adds_items_to_cart(cart, item):
    cart.add(item)
    assert True                      # bad
    assert item in cart.items        # good
```
```java
@Test void addsItemsToCart() {
    cart.add(item);
    assertEquals(cart.size(), cart.size());   // bad
    assertEquals(1, cart.size());             // good
}
```

### 10.4 QCR-A003 `cannot-fail-assertion` (error)

**Detects:** assertions that look real but cannot go red. Each sub-case uses this rule id with its own message. Universal sub-cases run for every adapter with the capabilities; framework sub-cases depend on adapter facts.

Universal:
1. **Incomplete assertion** (`complete === false`): `expect(x)` with no matcher call, a matcher accessed but not called (`expect(x).toBeTruthy;`), AssertJ `assertThat(x);` with nothing chained, Ruby `expect(x)` without `.to`.
2. **Always-true count check:** `actual.isCount` with "at least 0" (`toBeGreaterThanOrEqual(0)`, `not.toBeLessThan(0)`, `assert len(rows) >= 0`, `assertTrue(list.size() >= 0)`, `assertThat(n).isGreaterThanOrEqualTo(0)`).
3. **Unreachable** (`reachable === false`): an assertion after an unconditional `return`, `throw`, `raise` or `fail(...)` in the same block.
4. **Unawaited async assertion** (`awaited === 'no'`): Playwright web-first matchers or `expect.poll` in JS/TS, Jest/Vitest `.resolves`/`.rejects`, Playwright async Python `expect(...)` without `await`, .NET `Expect(...).ToBeVisibleAsync()` without `await` (v0.2).

Framework sub-cases (adapters set the facts):
5. **Locator truthiness:** `actual.isLocator` with a truthiness or nullness check. A locator or element handle object always exists. JS: `expect(page.locator('#x')).toBeTruthy()`. Python: `assert page.locator("#x")`. Java Selenium: `assertNotNull(driver.findElement(By.id("x")))`, which cannot fail because `findElement` throws before the check when the element is missing.
6. **Python tuple assert:** `assert (x, "message")` is always true (Python itself warns). The adapter reports it as an assertion with `actual.kind === 'collection'` and a non-empty literal, which this sub-case flags.
7. **Python two-argument `assertTrue`:** `self.assertTrue(a, b)` where the second argument is not a string message. It checks only `a`; the author meant `assertEqual`.
8. **Python mock pseudo-assertion:** `mock.called_once_with(...)`, `mock.assert_called_once` without `()`, or any `assert_*`-looking attribute on a mock that is not a real Mock assertion method. Python returns a new Mock, which is truthy.

Bad / good:
```ts
test('checkout button is shown', async ({ page }) => {
  await page.goto('/cart.html');
  expect(page.locator('#checkout')).toBeTruthy();                        // bad: locator always exists
  expect(page.getByRole('button', { name: 'Checkout' })).toBeVisible(); // bad: not awaited
  await expect(page.getByRole('button', { name: 'Checkout' })).toBeVisible(); // good
});
```
```python
def test_total(cart):
    assert (cart.total(), 42)                 # bad: a tuple is always true
    payment.called_once_with(42)              # bad: not a real mock assertion
    assert cart.total() == 42                 # good
    payment.assert_called_once_with(42)       # good
```
```java
@Test void checkoutButtonIsShown() {
    driver.get(BASE_URL + "/cart.html");
    assertNotNull(driver.findElement(By.id("checkout")));               // bad: findElement already throws
    assertTrue(driver.findElement(By.id("checkout")).isDisplayed());    // good
}
```

### 10.5 QCR-A004 `conditional-assertion` (warn)

**Detects:** every assertion of a test is guarded (inside an `if`, `switch`, ternary, short-circuit, loop body or callback such as `.forEach`, a list comprehension, a Java stream lambda), so the test can pass with zero checks.

**On the model:** all `assertions` have `guarded === true`. Not reported when the test has `assertionGuards.expectedCount` or `hasAssertions`, or at least one unguarded assertion (for example a length check before the loop). Adapters must not mark as guarded the idiomatic "the condition is the check" pattern: Go `if got != want { t.Errorf(...) }`, Python `if x != y: pytest.fail(...)`, Java `if (!ok) fail(...)`: there the `fail-call` assertion is the check, and its condition compares real values.

```ts
test('error shows for locked user', async ({ page }) => {
  const error = page.getByTestId('error');
  if (await error.isVisible()) {                                // bad
    await expect(error).toContainText('locked out');
  }
});
// good: await expect(page.getByTestId('error')).toContainText('locked out');
```
```python
def test_all_prices_positive(api):
    for item in api.get("/items").json():          # bad: zero items means zero checks
        assert item["price"] > 0
# good: items = api.get("/items").json(); assert len(items) > 0; then the loop
```
```java
@Test void showsErrorForLockedUser() {
    WebElement error = driver.findElement(By.cssSelector("[data-test=error]"));
    if (error.isDisplayed()) {                     // bad
        assertTrue(error.getText().contains("locked out"));
    }
}
```

### 10.6 QCR-W001 `hard-wait` (warn)

**Detects:** fixed sleeps (`NWait.kind === 'fixed-sleep'`) inside tests and hooks. Not reported: `condition`, `fake-timer`, `pacing` (k6/JMeter), and waits at or below `rules.QCR-W001.maxMs` (default 0). `implicit-wait-config` is reported as info only when it is over 5000 ms, with a message about mixing implicit and explicit waits. The message includes the milliseconds when they are a literal (Python seconds are converted).

```ts
await page.getByRole('button', { name: 'Add to cart' }).click();
await page.waitForTimeout(3000);                                         // bad
await expect(page.getByTestId('shopping-cart-badge')).toHaveText('1');  // good
```
```python
driver.find_element(By.ID, "add-to-cart-sauce-labs-backpack").click()
time.sleep(3)                                                            # bad
WebDriverWait(driver, 10).until(EC.text_to_be_present_in_element((By.CLASS_NAME, "shopping_cart_badge"), "1"))  # good
```
```java
driver.findElement(By.id("add-to-cart-sauce-labs-backpack")).click();
Thread.sleep(3000);                                                      // bad
new WebDriverWait(driver, Duration.ofSeconds(10))
    .until(ExpectedConditions.textToBe(By.className("shopping_cart_badge"), "1"));  // good
```
Fix text: "Wait for a condition instead: a web-first assertion, an explicit wait (WebDriverWait, waitForResponse) or a polling helper. For timing failures that come and go, see qa-core-flaky."

### 10.7 QCR-S001 `brittle-selector` (warn; info for positional picks)

**Detects:** selectors that depend on layout or generated names. Applies to UI frameworks only.

**On the model:** the shared classifier `src/rules/selectors.ts` looks at each `NSelector.value` (adapters only extract; classification is written once). Flag when the selector:
- contains `:nth-child(`, `:nth-of-type(`, `:nth-last-child(` or Playwright `>> nth=`;
- is XPath (strategy `xpath`, or starts with `/`, `//`, `(//` or `xpath=`) and either starts with `/html`, has 4 or more steps, or uses a positional index like `[3]`;
- has a class or id matching a generated pattern: `css-[a-z0-9]{4,}`, `sc-[a-zA-Z]{5,}`, `jss\d+`, `makeStyles-`, `_[a-zA-Z0-9]{5}_\d*` (CSS modules hash), `ng-tns-c\d+`, `ember\d+`, or a token of 6+ characters mixing letters with 3+ digits (this also applies to `By.className`/`By.CLASS_NAME` and `By.id` values);
- chains 4 or more CSS combinators (`>`, space, `+`, `~`).
Also flag as info: `positional` with `nth` and a literal index above 0, and `first`/`last` when `baseStrategy` is not `role`, `test-id` or `label`; Selenium `findElements(...).get(n)` / `find_elements(...)[n]` with a literal `n > 0`.
Options: `rules.QCR-S001.allowPatterns` (array of regex strings) and top-level `testIdAttribute` (default `data-testid`; `[data-testid=...]`, `[data-test=...]` and `[data-qa=...]` are never flagged).

```ts
await page.locator('#root > div > div:nth-child(2) > div.css-1q2w3e4 > button').click();  // bad
await page.getByRole('button', { name: 'Add to cart' }).click();                           // good
```
```python
driver.find_element(By.XPATH, "/html/body/div[1]/div/div[2]/button[3]").click()          # bad
driver.find_element(By.CSS_SELECTOR, "[data-test='add-to-cart-sauce-labs-backpack']").click()  # good
```
```java
driver.findElement(By.xpath("//div[3]/div[2]/button[2]")).click();                        // bad
driver.findElement(By.cssSelector("[data-test='add-to-cart-sauce-labs-backpack']")).click(); // good
```
Fix text: "Prefer role, label or test id selectors. For Playwright suites, qa-core-heal can repair many broken locators at once."

### 10.8 QCR-E001 `swallowed-error` (error)

**Detects:** assertion failures that are caught and ignored.

**On the model:** an `NTryBlock` with `assertionsInside > 0`, `catchesAssertionFailures === true`, and a handler that does not rethrow, fail or assert. `try/finally` without a catch is fine. `promise-catch` blocks (`.catch(() => {})`, `.catch(() => undefined)`, `.catch(() => null)`, `.catch(console.log)`, `.catch(console.error)`, `.catch(noop)`) attached to an assertion promise, or to a Playwright action in a test whose only assertions are in that chain, count. Soft assertions (`expect.soft`, AssertJ `SoftAssertions`, `pytest-check`) are not reported. The adapter decides `catchesAssertionFailures` from the language's exception tree (Section 9): Python `except Exception` swallows assertions, Java `catch (Exception e)` does not.

```ts
test('order total is correct', async ({ page }) => {
  try {
    await expect(page.getByTestId('total')).toHaveText('$32.39');
  } catch (e) {
    console.log('total did not match', e);       // bad
  }
});
```
```python
def test_order_total(page):
    try:
        expect(page.get_by_test_id("total")).to_have_text("$32.39")
    except Exception as e:                       # bad: AssertionError is an Exception
        print("total did not match", e)
```
```java
@Test void orderTotalIsCorrect() {
    try {
        assertEquals("$32.39", driver.findElement(By.cssSelector("[data-test=total-label]")).getText());
    } catch (AssertionError e) {                 // bad
        System.out.println("total did not match");
    }
}
```
Good in every language: the assertion without the try block.

### 10.9 QCR-F001 `focused-test` (error) and QCR-F002 `skipped-test` (warn)

**On the model:** F001: `modifiers` contains `only`. F002: `skip` is set with `unconditional === true`, or `modifiers` contains `todo` or `fixme`. A conditional skip with a reason (`skip.conditional && skip.reason`) is not reported. `xfail` is info, with the message "Expected failure: make sure this is tracked." The F002 message includes the reason when one is given.

| Language | F001 (focus) | F002 (skip, reported) | Not reported |
| --- | --- | --- | --- |
| JS/TS | `test.only`, `it.only`, `describe.only`, `test.describe.only`, `fit`, `fdescribe`, Cypress and Mocha `.only` | `test.skip`, `it.skip`, `describe.skip`, `xit`, `xtest`, `xdescribe`, `test.fixme`, bare `test.skip()` in a body | `test.skip(cond, 'reason')` |
| Python | n/a | `@pytest.mark.skip`, `@unittest.skip`, unconditional `pytest.skip()` in a body | `@pytest.mark.skipif(cond, reason="...")`, `@unittest.skipIf(cond, "...")` |
| Java | n/a | `@Disabled`, `@Ignore`, `@Test(enabled = false)` | `@DisabledOnOs(...)`, `@EnabledIfEnvironmentVariable(...)`, `assumeTrue(...)` |

```ts
test.only('adds item to cart', async ({ page }) => { /* ... */ });   // F001
it.skip('rejects an empty password', () => { /* ... */ });          // F002
test.skip(process.platform === 'win32', 'File picker is not supported on Windows CI');  // fine
```
```python
@pytest.mark.skip                                                    # F002
def test_rejects_empty_password(page): ...
@pytest.mark.skipif(sys.platform == "win32", reason="File picker is not supported on Windows CI")  # fine
def test_upload(page): ...
```
```java
@Disabled                                                            // F002
@Test void rejectsEmptyPassword() { }
@DisabledOnOs(value = OS.WINDOWS, disabledReason = "File picker is not supported on Windows CI")  // fine
@Test void uploadsFile() { }
```

### 10.10 QCR-D001 `duplicate-test` (warn)

**Detects:** copied tests.

**On the model:** two or more tests with the same `bodyHash` (same file or across reviewed files of the same language) are duplicates: report every copy after the first, with `evidence` naming the first copy's file and line. Also report two tests with the same `fullTitle` in the same file. Bodies with fewer than 2 statements are ignored. Parameterized tests are one test, not duplicates.

```ts
test('login works', async ({ page }) => { await login(page); await expect(page).toHaveURL(/inventory/); });
test('login works for standard user', async ({ page }) => { await login(page); await expect(page).toHaveURL(/inventory/); }); // bad
// good: for (const user of [...]) { test(`login works for ${user}`, ...) }
```
```python
# good: @pytest.mark.parametrize("user", ["standard_user", "performance_glitch_user"])
```
```java
// good: @ParameterizedTest @ValueSource(strings = {"standard_user", "performance_glitch_user"})
```

### 10.11 QCR-N001 `missing-negative-case` (info, confidence low)

**Detects:** a suite (or file, when there is no suite) where every test is a happy path. Heuristic only; LLM mode adds specific missing cases.

**On the model:** group tests by their innermost suite, or by file. Report once per group, at the suite title, when the group has 2 or more tests and none of them:
- has a title matching `/(invalid|error|fail|reject|wrong|empty|missing|denied|unauthori[sz]ed|forbidden|expired|locked|limit|max|min|zero|negative|boundary|overflow|timeout|not.?found|404|401|403|500|edge|null|undefined|none|nil)/i` (applied after splitting snake_case and camelCase titles into words);
- has `expectsException` or an assertion of kind `throws`;
- has a `status` assertion with a code of 400 or more;
- asserts on text containing `error`, `invalid` or `required`.
The message suggests two or three negative cases built from the group title (group "checkout" gives "checkout with an empty cart" and "checkout with a missing postal code"; generic fallbacks: "empty input", "invalid input", "a server error").

```ts
describe('applyDiscount', () => {
  it('applies 10% off', () => { expect(applyDiscount(100, 'SAVE10')).toBe(90); });
  it('applies 20% off', () => { expect(applyDiscount(100, 'SAVE20')).toBe(80); });
});  // bad; good adds: it('rejects an unknown code', () => { expect(() => applyDiscount(100, 'NOPE')).toThrow('Invalid code'); });
```
```python
class TestApplyDiscount:
    def test_ten_percent(self): assert apply_discount(100, "SAVE10") == 90
    def test_twenty_percent(self): assert apply_discount(100, "SAVE20") == 80
# good adds: def test_rejects_unknown_code(self): with pytest.raises(ValueError, match="Invalid code"): apply_discount(100, "NOPE")
```
```java
// good adds: @Test void rejectsUnknownCode() { assertThrows(IllegalArgumentException.class, () -> discounts.apply(100, "NOPE")); }
```

### 10.12 QCR-M001 `over-mocking` (error when the subject is mocked, warn otherwise)

**Detects:** the code under test is replaced by a mock, so the test checks the mock.

**On the model:**
1. **Subject mocked (error):** an `NMock` with `targetsSubject === true` and `passthrough === false`, of kind `module`, `class` or `object`.
2. **Function under test stubbed (error):** an `NMock` of kind `function` with `stubbedReturn === true` on a target that the same test then calls and asserts on (`actual.normalized` contains the mocked target).
3. **Only mock assertions (warn):** every assertion in the test has kind `mock-call` (`toHaveBeenCalled*`, `assert_called*`, Mockito `verify`).
4. **Everything mocked (warn, file level):** every non-type, non-framework import (or every constructor dependency in Java) is mocked.
5. **Full network fake (warn):** an `NMock` with `fulfillsAllNetwork === true` in a test that then asserts on page content.

Subject detection is per adapter (Section 9). `targetsSubject === null` never triggers sub-cases 1 and 2.

```ts
import { getTotal } from './cart';
vi.mock('./cart', () => ({ getTotal: vi.fn(() => 42) }));     // bad
it('returns the total', () => { expect(getTotal([{ price: 40 }, { price: 2 }])).toBe(42); });
// good: vi.mock('./tax', () => ({ taxRate: () => 0 }));   mock the dependency, not the subject
```
```python
# test_cart.py
@patch("shop.cart.get_total", return_value=42)                 # bad
def test_returns_total(mock_total):
    assert get_total([{"price": 40}, {"price": 2}]) == 42
# good: @patch("shop.cart.tax_rate", return_value=0)
```
```java
class CartTest {
    @Mock Cart cart;                                            // bad: Cart is the class under test
    @Test void returnsTotal() {
        when(cart.total()).thenReturn(42);
        assertEquals(42, cart.total());
    }
}
// good: @Mock TaxService tax; @InjectMocks Cart cart;
```

### 10.13 QCR-P001 `snapshot-only` (warn; info for visual)

**Detects:** a test whose only assertions are snapshots, which pass on the first run and are often re-recorded without review.

**On the model:** every assertion has kind `snapshot` or `visual`. `snapshot` only gives warn. `visual` only gives info, because visual tests are a valid choice. Also flag (warn) an inline snapshot recorded empty (`toMatchInlineSnapshot()` with no argument).

```ts
it('renders the cart', () => {
  const html = renderCart([{ name: 'Backpack', price: 29.99 }]);
  expect(html).toMatchSnapshot();                 // bad alone; good adds toContain('Backpack') and toContain('$29.99')
});
```
```python
def test_renders_cart(snapshot):
    assert render_cart([{"name": "Backpack", "price": 29.99}]) == snapshot   # bad alone
```
```java
@Test void rendersCart() { Approvals.verify(renderCart(items)); }          // bad alone
```

### 10.14 QCR-C001 `missing-cleanup` (warn)

**Detects:** state a test creates and never restores, which leaks into other tests.

**On the model:** an `NResource` with `released === false` and `autoManaged === false`. Kinds and their releases come from the adapter vocabulary (Section 9). Config `rules.QCR-C001.restoreMocksConfigured: true` clears `spy` resources (for Jest/Vitest `restoreMocks` config). API data (info, confidence low): a test with a `create` `NDataOp` over HTTP and no `delete` in the test or an after hook.

```ts
it('uses the fixed date', () => {
  vi.useFakeTimers();                                  // bad without afterEach(() => vi.useRealTimers())
  vi.setSystemTime(new Date('2026-01-01'));
  expect(formatToday()).toBe('Jan 1, 2026');
});
```
```python
def test_checkout():
    driver = webdriver.Chrome()                        # bad: never quit; use a fixture with yield and driver.quit()
    driver.get("https://www.saucedemo.com")
    assert "Swag Labs" in driver.title
```
```java
@BeforeEach void setUp() { driver = new ChromeDriver(); }   // bad without @AfterEach void tearDown() { driver.quit(); }
```

### 10.15 QCR-X001 `parse-error`, QCR-X002 `suppression-without-reason`, QCR-X003 `no-static-adapter` (info)

- **X001:** a file that cannot be parsed (`parseStatus: 'failed'`), or a file classified as `test` by its name in which no tests were found. One finding per file. It never crashes the run.
- **X002:** see 10.17.
- **X003:** a file handled by the generic adapter without user patterns (Section 9.5). Never affects the exit code at the default `--fail-on error`.

### 10.16 Rule summary (use this table in the README and docs/rules.md)

| Id | Name | Default | Scope | Also in qa-core-verify |
| --- | --- | --- | --- | --- |
| QCR-A001 | no-assertion | error | universal | QCV-W001 |
| QCR-A002 | trivial-assertion | error | universal | QCV-W004 |
| QCR-A003 | cannot-fail-assertion | error | universal + framework sub-cases | QCV-W002, QCV-W003 |
| QCR-A004 | conditional-assertion | warn | universal | QCV-W007 |
| QCR-W001 | hard-wait | warn | universal | QCV-W010 |
| QCR-S001 | brittle-selector | warn | UI frameworks | locator checks |
| QCR-E001 | swallowed-error | error | universal | QCV-W008 |
| QCR-F001 | focused-test | error | runners with focus | QCV-W009 |
| QCR-F002 | skipped-test | warn | universal | QCV-W009 |
| QCR-D001 | duplicate-test | warn | universal | none |
| QCR-N001 | missing-negative-case | info | universal | none |
| QCR-M001 | over-mocking | error / warn | universal + framework subject detection | none |
| QCR-P001 | snapshot-only | warn / info | universal | none |
| QCR-C001 | missing-cleanup | warn | universal | none |
| QCR-X001 | parse-error | info | universal | QCV-W000 (similar) |
| QCR-X002 | suppression-without-reason | info | universal | none |
| QCR-X003 | no-static-adapter | info | generic adapter | none |
| QCR-G001 | unmatched-step (v0.2) | warn | Gherkin | none |
| QCR-K001 | perf-no-thresholds (v0.2) | warn | k6, JMeter | none |

Before writing `docs/rules.md`, open `https://github.com/sprintsynergyio/qa-core-verify/blob/main/docs/rules.md` and correct the last column if a `QCV-` id means something different.

### 10.17 Suppression

- Inline, in the file's line comment syntax: `// qa-core-review-disable-next-line QCR-W001 -- reason` or `# qa-core-review-disable-next-line QCR-W001 -- reason` disables the listed rules (comma separated) on the next line.
- `qa-core-review-disable QCR-S001 -- reason` in a comment before the first statement of a file disables those rules for the whole file.
- Config `suppressions` (Section 12) works for every format, including JSON and XML files: `{ "file": "glob", "rules": ["QCR-A001"], "test": "optional full title", "reason": "..." }`.
- A reason after `--` (or in `reason`) is required. A suppression with no reason is ignored and produces `QCR-X002`.
- Suppressed findings get `suppressed: true`, are counted in `summary.suppressed`, appear only in JSON output, and never affect the exit code.

---

## 11. CLI

### 11.1 Commands

```
qa-core-review review [paths...] [flags]      # default command; `qa-core-review [paths...]` is the same
qa-core-review ui [paths...] [flags]          # review, then open the local review page
qa-core-review detect [--format json]         # show detected projects, languages, frameworks, file counts
qa-core-review init [--claude] [--cursor] [--codex] [--ci <provider>] [--pre-commit] [--config [json|yaml]] [--force]
qa-core-review rules [--language <id>]        # list rules, default severity, scope, one-line description
qa-core-review explain <ruleId> [--language <id>]   # the rule's doc with bad and good examples for that language
qa-core-review adapters                       # list adapters, tier, languages, frameworks, capabilities
qa-core-review hook claude-post-edit          # reads Claude Code hook JSON on stdin (Section 14.1)
qa-core-review hook claude-stop               # reads Claude Code hook JSON on stdin (Section 14.1)
qa-core-review comment --report <file>        # post or update the sticky PR comment (Section 14.3)
qa-core-review --version | -v
qa-core-review --help | -h                    # also `qa-core-review <command> --help`
```

With no paths, `review` uses the include globs of all detected adapters (or config `include`). Paths can be files, folders or globs. A list of files (as passed by pre-commit) reviews exactly those files that match an adapter or a `generic` entry, and silently skips the rest. `init` with no flag writes only `qa-core-review.config.json` (same as `--config json`). `--ci` takes `github`, `gitlab`, `azure`, `jenkins` or `bitbucket`.

### 11.2 Flags for `review` and `ui`

| Flag | Default | Meaning |
| --- | --- | --- |
| `--diff <base>` | off | Review only tests whose lines changed in `git diff <base>...HEAD`, plus uncommitted changes and untracked test files. Findings outside changed tests are dropped, except F001, which is always reported for changed files. `--diff HEAD` means "only uncommitted changes". |
| `--staged` | off | Like `--diff`, using `git diff --cached` (for pre-commit hooks). |
| `--format <list>` | `pretty` | Comma list of `pretty,json,sarif,markdown,junit`. |
| `--output <dir>` | `.qa-core/review` | Folder for `report.json`, `report.sarif`, `report.md`, `report.junit.xml`. `report.json` is always written. |
| `--stdout <format>` | none | Print `json`, `sarif`, `markdown` or `junit` to stdout instead of the pretty view (for piping). |
| `--fail-on <level>` | `error` | `error`, `warn`, `info` or `never`. Exit 1 when any unsuppressed finding is at or above the level. |
| `--rules <list>` | all enabled | Only run these rule ids. |
| `--disable <list>` | none | Skip these rule ids. |
| `--language <list>` | auto | Only review these languages (`typescript,python,java,...`). |
| `--framework <name>` | auto | Force a runner for all reviewed files (for single-framework repos with odd layouts). |
| `--config <file>` | auto | Config path. |
| `--root <dir>` | cwd | Project root. Report paths are relative to it. |
| `--llm <mode>` | `off` | `off`, `anthropic`, `openai` or `claude-code` (Section 16). |
| `--llm-model <id>` | config | Model id for the provider. |
| `--yes-send-code` | off | Confirms code may be sent in `anthropic`/`openai` mode in a non-interactive run. |
| `--dump-model` | off | Also write `.qa-core/review/model.json` (the normalized model). |
| `--max-findings <n>` | 200 | Stop printing after n findings in pretty output (JSON keeps all). |
| `--no-color` | auto | Also honours `NO_COLOR` and non-TTY output. |
| `--quiet` | off | Pretty output prints only the summary line. |
| `--port <n>` | random free port | `ui` only. |
| `--no-open` | off | `ui` only. Print the URL instead of opening a browser. |
| `--gate` | off | `ui` only. Block until the user clicks Finish, print the feedback prompt to stdout, exit 0 (approved) or 1 (changes requested). |

Use `node:util` `parseArgs` with `strict: true`. An unknown flag exits 2 with a one-line error and "Run qa-core-review --help".

### 11.3 Exit codes

| Code | Meaning |
| --- | --- |
| 0 | No unsuppressed finding at or above `--fail-on` (or gate approved). |
| 1 | Findings at or above `--fail-on` (or gate: changes requested). |
| 2 | Usage or config error: bad flag, invalid config, path not found, not a git repo or bad ref with `--diff`. |
| 3 | Internal error. Print "Internal error, please open an issue at https://github.com/sprintsynergyio/qa-core-review/issues", plus the stack when `QA_CORE_REVIEW_DEBUG=1`. |

A parse error in one test file is not exit 2. It is a `QCR-X001` finding. A file in a language with no static adapter is not an error either; it is `QCR-X003`.

### 11.4 Pretty output (exact layout)

```text
qa-core-review 0.1.0 · 5 files · 14 tests · static rules · TypeScript, Python, Java

fail  tests/cart.spec.ts:12  adds item to cart
  QCR-W001  warn   14:3  Hard wait of 3000 ms.
    Evidence: await page.waitForTimeout(3000)
    Fix: Wait for a condition instead, for example await expect(badge).toHaveText('1').
  QCR-A003  error  15:3  Locator objects are always truthy, so this check cannot fail.
    Evidence: expect(page.locator('#checkout')).toBeTruthy()
    Fix: Use await expect(locator).toBeVisible().

fail  tests/test_checkout.py:8  test_order_total
  QCR-E001  error  12:5  This except block catches the assertion failure and hides it.
    Evidence: except Exception as e:
    Fix: Remove the try/except so the assertion can fail the test.

review  src/test/java/shop/LoginTest.java:21  LoginTest > logsIn
  QCR-S001  warn   24:29  XPath depends on layout: //div[3]/div[2]/button[2].
    Evidence: By.xpath("//div[3]/div[2]/button[2]")
    Fix: Prefer a data-test attribute or an id that does not change with layout.

pass  tests/inventory.spec.ts:3  sorts by price

file  specs/CartSpec.scala
  QCR-X003  info   1:1  No static rules for Scala yet. Run with --llm to review this file.

Summary: 10 pass, 2 review, 2 fail. 3 errors, 4 warnings, 2 info. 0 suppressed.
By language: TypeScript 9 tests, Python 3 tests, Java 2 tests, Scala 1 file (LLM only).
Reports: .qa-core/review/report.json
Next: run `npx qa-core-review ui` to approve or reject each test.
```

Order: fail tests, then review, then pass, each sorted by file and line. File-level findings (no test) print under a `file  <path>` heading. X003 prints once per language in pretty output. Verdict words are colored (fail red, review yellow, pass green) only when color is on. Use `/` in all printed paths on every OS. If the terminal does not support UTF-8 (`process.platform === 'win32'` and no `WT_SESSION`), print `-` instead of `·`. When the tool runs as the standalone binary or in Docker, the "Next:" line says `qa-core-review ui` instead of `npx qa-core-review ui`.

### 11.5 SARIF

SARIF 2.1.0, one `run`, `tool.driver.name = "qa-core-review"`, `tool.driver.version`, `informationUri` = repo URL, one `rules[]` entry per rule run with `id`, `name`, `shortDescription`, `fullDescription`, `helpUri` (docs anchor) and `defaultConfiguration.level` (`error` -> `error`, `warn` -> `warning`, `info` -> `note`). Each result has `ruleId`, `ruleIndex`, `level`, `message.text` (message plus fix), one `physicalLocation` with `artifactLocation.uri` relative to the root and `uriBaseId: "%SRCROOT%"`, a `region`, and `partialFingerprints["qaCoreReview/v1"] = Finding.id`. Suppressed findings are left out. Tests validate output against the official SARIF 2.1.0 JSON schema, committed at `tests/schemas/sarif-2.1.0.json` with its source URL in `tests/schemas/README.md`.

Each SARIF result also has `properties: { language, framework, testTitle, source }`.

### 11.6 Markdown

Used for the PR comment and `report.md`. It:
1. Starts with the marker line `<!-- qa-core-review -->`.
2. Has a heading `## Test review` and a one-line verdict ("2 tests need changes, 2 need review, 5 pass." or "All 9 tests pass review.").
3. Has a table of fail and review tests: verdict, `file:line`, language (short names: TS, JS, Py, Java, C#, Go, Rb, Kt, PHP, Robot, Gherkin, k6, JMeter, Postman, or the Tier 3 hint), test title, rule ids. A line under the table lists Tier 3 files reviewed by LLM only, or not reviewed when LLM mode is off.
4. Has a collapsed `<details>` per fail or review test with each finding: rule id, line, message, evidence in inline code, fix.
5. Is at most 60,000 characters. If longer, keep the table, drop the details, and add "Full report in the job artifact `.qa-core/review/report.json`."
6. Ends with: "Reviewed by [qa-core-review](https://github.com/sprintsynergyio/qa-core-review), an open-source tool by SprintSynergy."

Escape `|`, `<` and backticks in user code shown inside the table.

### 11.7 JUnit XML

For CI systems that show test results natively (GitLab, Azure DevOps, Jenkins, Bitbucket, CircleCI). `report.junit.xml`:
- One `<testsuites name="qa-core-review">` with `tests`, `failures`, `time="0"`.
- One `<testsuite>` per reviewed file, `name` = the file path.
- One `<testcase>` per reviewed test: `classname` = file path with `/` replaced by `.` and the extension removed, `name` = `fullTitle`, `file` = path, `line` = start line.
- Unsuppressed findings at or above `--fail-on` become one `<failure type="<ruleId>" message="<message>">` each, with evidence and fix in the text. Findings below the level go into `<system-out>`.
- File-level findings go in a `<testcase name="(file)">`. Tier 3 files with only X003 get a `<testcase name="(file)">` with `<skipped message="No static adapter"/>`.
- Escape XML properly and strip characters that are invalid in XML 1.0.
- Tests validate output against a committed JUnit XSD (`tests/schemas/junit.xsd`, source URL in `tests/schemas/README.md`) with a small structural checker (no XML dependency: parse with a minimal test-only reader).

---

## 12. Config

### 12.1 Discovery

First match wins, searched from `--root` upward to the git root: `qa-core-review.config.json`, `qa-core-review.config.yaml`, `qa-core-review.config.yml`, `.qa-core-review.json`, `.qa-core-review.yaml`, or a `"qa-core-review"` key in `package.json`. JSON and YAML only, so loading config never runs code (YAML is parsed with the `yaml` package in its default safe schema; anchors are allowed, custom tags are rejected). Validate with `schemas/config.schema.json`. On error, exit 2 and print the file, the JSON pointer and the message.

### 12.2 Schema with defaults

```json
{
  "$schema": "https://raw.githubusercontent.com/sprintsynergyio/qa-core-review/main/schemas/config.schema.json",
  "include": null,
  "exclude": ["**/node_modules/**", "**/dist/**", "**/build/**", "**/target/**", "**/out/**", "**/bin/**", "**/obj/**",
              "**/coverage/**", "**/.venv/**", "**/venv/**", "**/__pycache__/**", "**/.gradle/**", "**/vendor/**",
              "**/.qa-core/**", "**/*.d.ts"],
  "languages": "auto",
  "framework": "auto",
  "projects": [],
  "generic": [],
  "failOn": "error",
  "testIdAttribute": "data-testid",
  "assertionHelpers": [],
  "suppressions": [],
  "rules": {
    "QCR-W001": { "severity": "warn", "maxMs": 0 },
    "QCR-S001": { "severity": "warn", "allowPatterns": [] },
    "QCR-M001": { "subjectMap": {} },
    "QCR-C001": { "restoreMocksConfigured": false },
    "QCR-N001": { "severity": "info" }
  },
  "adapters": {
    "js": {}, "python": {}, "java": {}
  },
  "llm": {
    "mode": "off",
    "model": null,
    "includeSubject": false,
    "includeLlmOnlyFiles": true,
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

The same config in YAML (`qa-core-review.config.yaml`), as shown in `docs/config.md`:

```yaml
failOn: error
languages: [typescript, python, java]
projects:
  - path: services/payments
    language: java
    runner: testng
    libraries: [restassured]
generic:
  - glob: "modules/**/src/test/scala/**/*Spec.scala"
    language: scala
    framework: scalatest
    patterns:
      testPattern: '^\s*(it|test)\s*\(\s*"'
      assertionPattern: '\b(assert|should|must)\b'
      sleepPattern: 'Thread\.sleep\('
suppressions:
  - file: "legacy/**/*.py"
    rules: [QCR-W001]
    reason: Legacy suite, tracked for rewrite
rules:
  QCR-S001: { allowPatterns: ["^#app-root"] }
```

- `include`: `null` means "the default include globs of every detected adapter". An array replaces them all.
- `languages`: `"auto"` or a list of `LanguageId`. Files in other languages are not reviewed.
- `projects[]`: `{ path, language?, runner?, libraries?, include?, exclude? }`. Overrides detection for files under `path`.
- `generic[]`: `{ glob, language, framework?, patterns? }` for Tier 3 (Section 9.5). `patterns` keys: `testPattern`, `assertionPattern`, `sleepPattern`, `skipPattern`, `focusPattern` (regex strings, validated at load time).
- `suppressions[]`: `{ file, rules, test?, reason }` (Section 10.17).
- `adapters.<id>`: adapter-specific options (for example `adapters.java.testSourceDirs`, `adapters.python.extraTestPrefixes`). Each adapter documents its options; unknown keys are an error.
- Each `rules` entry accepts `"off"`, a severity string (`"error" | "warn" | "info"`), or an object with optional `severity`, `languages` (limit the rule to some languages) plus rule-specific options. Unknown rule ids print a warning, not an error.
- `additionalProperties: false` everywhere else.
- `claude.stopGate` is `"off" | "report" | "ui"` (Section 14.1).
- CLI flags override config values.
- API keys are never read from config, only from environment variables (Section 16).
- `docs/config.md` documents every key with its default, in JSON and YAML.

---

## 13. Local review UI

### 13.1 Server

- `qa-core-review ui` runs the review, then starts `node:http` bound to `127.0.0.1` only (never `0.0.0.0`), on `--port` or a random free port.
- Generate a random 32-byte hex token per run. The URL is `http://127.0.0.1:<port>/?t=<token>`. The page reads the token from the URL and sends it as header `X-QCR-Token` on every API call. API requests without the right token get 403. Reject requests whose `Host` header is not `127.0.0.1:<port>` or `localhost:<port>` (DNS rebinding guard).
- Open the browser with `open` (macOS), `cmd /c start "" <url>` (Windows) or `xdg-open` (Linux), using `spawn` with an argument array. If that fails, print the URL.
- Serve `ui/index.html`, `ui/app.js` and `ui/styles.css` from the installed package. No CDN, no external fonts, no network requests from the page. Send `Content-Security-Policy: default-src 'self'` and `X-Content-Type-Options: nosniff`.
- Shut down after Finish, on Ctrl+C, or after 2 hours with no requests.

### 13.2 API

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

### 13.3 Screens

1. **Header and sidebar.** Header: tool name, counts (fail, review, pass), progress "4 of 9 tests decided", buttons **Approve all passing** and **Finish**. Sidebar: tests grouped by language, then file (a language filter appears when there is more than one), each with a verdict badge (text plus color), a decision icon (pending, approved, rejected), and filter chips: All, Fail, Review, Pass, Undecided.
2. **Test view (main panel).** Full title and `file:line`. The test's source with line numbers in monospace, with simple highlighting for keywords, strings and comments (a small tokenizer in `ui/highlight.js` with a keyword, comment and string table per language: JS/TS, Python, Java, C#, Go, Ruby, Kotlin, PHP, Robot, Gherkin, plus a plain fallback; no library). Each finding is an inline annotation box under its line: severity badge, rule id (link to docs), message, evidence, fix, a collapsible good example, a **Dismiss** toggle ("not a problem here") and a comment box. Below the code: a test comment box and three buttons: **Approve** (key A), **Reject** (key R), **Comment only** (key C, keeps decision pending but includes the comment). Keys J and K move to the next and previous test, `/` focuses the comment box. Files with `parseStatus: 'llm-only'` and no test boundaries are shown as one item covering the whole file.
3. **Finish dialog.** Shows the outcome, the generated prompt in a read-only textarea, a **Copy prompt** button, and the saved path `.qa-core/review/feedback.md`.

**Outcome rule:** "changes requested" if any test is rejected, or any test that is not approved still has an error finding that is not dismissed. Otherwise "approved".

Accessibility: real `<button>` elements, visible focus ring, color never the only signal. Light and dark theme via `prefers-color-scheme`. Works in current Chrome, Firefox, Safari and Edge.

### 13.4 Feedback prompt (exact template, `src/ui/feedback.ts`)

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

With outcome approved, the first line after the heading is `Outcome: APPROVED` and only the Comments and General sections appear. Dismissed findings are left out. Approved tests appear only in the count. The prompt names each file's language and framework in its heading line (for example `### tests/test_cart.py:8 "test_total" (Python, pytest)`) so the agent fixes it in the right idiom. Write the prompt to `.qa-core/review/feedback.md` and return it from `/api/finish`.

---

## 14. Integrations

### 14.1 Claude Code

Before building this, read the current Claude Code hooks docs (`https://docs.claude.com/en/docs/claude-code/hooks`) and slash command docs. If the hook input or output format differs from this section, follow the docs and note the difference in the PR description. The hooks work for test files in every supported language, because they go through the same adapters.

**a) PostToolUse hook: fast feedback after each edit.** `qa-core-review hook claude-post-edit`:
1. Read JSON from stdin. Take `tool_input.file_path` (from `Write`, `Edit` or `MultiEdit`) and `cwd`.
2. If no adapter (and no `generic` entry with patterns) claims the file, or it matches `exclude`, exit 0 with no output. Tier 3 files without patterns are skipped here (no LLM in hooks).
3. Review only that file, static rules only, fail on error. Load only that language's grammar.
4. No error findings: exit 0, no output.
5. Error findings: print a plain-text report to **stderr** (at most 40 lines: rule id, line, message, fix) ending with "Fix these test problems before you continue. Do not delete tests or weaken assertions to silence them." and exit **2**, which Claude Code feeds back to Claude.
6. Must finish in under 2 seconds for a 1,000-line file in any Tier 1 language, including grammar load (cold start).
7. Any internal error: print one line to stderr and exit 0, so a tool bug never blocks the user's agent.

**b) Stop hook: review gate when Claude finishes.** `qa-core-review hook claude-stop`:
1. Read JSON from stdin. If `stop_hook_active` is true, exit 0 (prevents loops).
2. If `claude.stopGate` is `"off"`, exit 0.
3. Review changed test files (`--diff HEAD` plus untracked) in all languages. If no test files changed, exit 0.
4. `"report"` (default): if error findings exist, print `{"decision":"block","reason":"<feedback prompt built from the findings>"}` to stdout and exit 0, so Claude continues and fixes them. Otherwise exit 0 with no output.
5. `"ui"`: start the UI in gate mode and wait. On "changes requested", print `{"decision":"block","reason":"<feedback prompt>"}`. On "approved", exit 0 with no output. Document that this mode needs the hook `timeout` set to 3600.

**c) `qa-core-review init --claude`.** Merges this into `.claude/settings.json` in the project. Create the file if it is missing, never remove existing hooks, do not add an entry whose command already exists, write with 2-space indent, and print what changed. The command is `npx --no-install qa-core-review` when the project has a `package.json` with `qa-core-review` installed, otherwise `qa-core-review` (binary on PATH); `init` detects which and says so.

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
1. Run `npx qa-core-review --diff HEAD --stdout markdown` (or `qa-core-review ...` if the binary is installed instead).
2. Fix every error and warning in the test code, in the same language and framework as the file. Do not delete tests or weaken assertions to silence a finding. If a finding is wrong, add a `qa-core-review-disable-next-line <id> -- <reason>` comment using the file's comment syntax (`//` or `#`) and tell me why.
3. If $ARGUMENTS contains "deep", run `npx qa-core-review --diff HEAD --llm claude-code`, read `.qa-core/review/llm-prompt.md`, and do the review it describes yourself. This also covers files in languages that have no static rules yet.
4. If $ARGUMENTS contains "ui", run `npx qa-core-review ui --diff HEAD --gate`, wait for it to finish, and apply the feedback it prints.
5. Repeat step 1 until there are no errors, then summarize what you changed.
```

And it copies `skill/SKILL.md` to `.claude/skills/qa-core-review/SKILL.md`. Write the skill in the style of `qa-core-heal/skill/SKILL.md`: front matter with `name` and a `description` that says when to trigger (after writing or editing tests in any language, "review my tests", "are these tests any good"), core rules (never delete or weaken tests to pass review, never suppress without a reason, the user decides in the UI, fix in the file's own language and framework idioms), and a numbered workflow.

`--force` overwrites only files this tool created (`qa-review.md`, the skill); it never rewrites other hooks.

### 14.2 Cursor and Codex

- `init --cursor` writes `.cursor/rules/qa-core-review.mdc`, a rule whose globs are the include globs of the detected adapters (for example `**/*.{spec,test}.*`, `**/test_*.py`, `**/src/test/java/**/*.java`), telling the agent to run `npx qa-core-review --diff HEAD` after writing tests and fix errors without deleting tests or weakening assertions. Check Cursor's current docs: if project hooks (`.cursor/hooks.json` with after-file-edit and stop events) are supported, also add hook entries that call the same commands, and document both.
- `init --codex` appends `templates/codex/AGENTS.snippet.md` to `AGENTS.md` (create the file if missing; skip if the marker `<!-- qa-core-review -->` is already there). If Codex hooks are available at build time, document the optional hook config; otherwise the AGENTS.md instruction is the integration.
- `docs/integrations.md` gives numbered steps for Claude Code, Cursor, Codex, git pre-commit (Section 15.4) and plain CI (Section 15.5), with the date the agent docs were last checked.

### 14.3 GitHub Action and qa-core-prcheck

`action.yml` is a composite action. Follow `qa-core-prcheck/action.yml`: inputs reach scripts only through `env:` and are used as quoted shell variables, never as `${{ }}` expressions inside `run:`. It works in repos of any language, because it sets up Node itself.

Inputs: `base-ref` (default empty, meaning `origin/` plus `GITHUB_BASE_REF`), `paths` (default empty, meaning detected include globs), `fail-on` (default `error`), `comment` (default `true`), `github-token` (default `${{ github.token }}`), `comment-author` (default `github-actions[bot]`), `sarif` (default `false`), `junit` (default `false`), `version` (npm version to run, default the version matching the action tag), `node-version` (default `22`; the action runs `actions/setup-node` only if `node --version` is missing or older than 22.6).

Steps:
1. Ensure Node (above).
2. Run `npx --yes qa-core-review@"$VERSION" review --diff "$BASE_REF" --format json,sarif,markdown,junit`, keeping its exit code.
3. Append `report.md` to `$GITHUB_STEP_SUMMARY`.
4. If `comment` is true, run `qa-core-review comment --report .qa-core/review/report.json`. It finds the comment by the marker and `comment-author`, updates it, or creates one. It skips fork PRs with a notice. A 403 becomes a warning, not a failure. Use `GITHUB_API_URL`, `GITHUB_REPOSITORY` and the PR number from `GITHUB_EVENT_PATH`.
5. If `sarif` is true, upload `report.sarif` with `github/codeql-action/upload-sarif` (needs `security-events: write`; document it).
6. Upload `.qa-core/review/` as an artifact.
7. Exit with the exit code from step 2.

Example workflow for users (README and `docs/github-action.md`), the same for a Python or Java repo:

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
      - uses: sprintsynergyio/qa-core-review@v0.1.0
        with:
          fail-on: error
```

Use the action major versions current at build time, matching `qa-core-prcheck`.

**qa-core-prcheck.** Do not change the prcheck repo from this repo. Here, document two options in `docs/github-action.md` under "Use with qa-core-prcheck":
- **Option A (works now):** run both actions in the same job. Each keeps its own sticky comment.
- **Option B (proposal for a later prcheck PR, written in `docs/prcheck-integration.md`):** prcheck gets an input `review: true` that runs `npx qa-core-review --diff "$BASE" --stdout markdown --fail-on never` and puts the output under a "Test quality" heading in its summary. The contract prcheck can rely on: the markdown starts with `<!-- qa-core-review -->` and stays under 60,000 characters, and `report.json` follows `schemas/report.schema.json` with `schemaVersion: 2`.

---

## 15. Distribution

Every channel runs the same code and gives byte-identical `report.json` (except `createdAt` and `root`) for the same input. A test in CI checks this for npm vs binary on each OS.

### 15.1 npm (primary)

`npx qa-core-review` works in any project with Node 22.6+ on the machine, even a Java or Python project with no `package.json` (npx downloads it to the cache). `npm i -D qa-core-review` pins it for JS projects. The package includes `dist`, `ui`, `schemas`, `skill`, `templates`, `grammars`, `README.md`, `CHANGELOG.md`, `LICENSE`. No `postinstall` script.

### 15.2 Standalone binary (for teams without Node)

- Built with **Node single executable applications (SEA)**: `scripts/build-sea.mjs` bundles `dist/cli.js` into one CommonJS file with `esbuild`, writes `sea-config.json` with `assets` for every file in `grammars/`, `ui/`, `schemas/`, `templates/` and `skill/`, generates the blob with `node --experimental-sea-config`, copies the Node binary, and injects the blob with `postject`. `src/assets.ts` reads assets with `require('node:sea').getAsset()` when `sea.isSea()` is true. `web-tree-sitter` loads its own runtime `.wasm` and grammars from buffers, so no file paths are needed.
- Targets: `linux-x64`, `linux-arm64`, `darwin-x64`, `darwin-arm64`, `win-x64`. Names `qa-core-review-<version>-<target>[.exe]`, plus `SHA256SUMS`. macOS binaries are ad hoc signed (`codesign --sign -`) after injection; Windows binaries are unsigned in v0.1 (documented).
- **Fallback:** if SEA asset loading of WASM fails on any target at build time, use `bun build --compile` with embedded files for that target, and note the switch in the PR. Do not ship a target that fails the binary smoke test.
- `scripts/binary-smoke.mjs` (CI, each OS, on the host target): build the binary, run `--version`, `detect` and a review of the Tier 1 example projects with no Node on `PATH` for the child process, and compare `report.json` with the npm run.
- Binaries are attached to the GitHub Release by `.github/workflows/release.yml`, which runs only on a `v*` tag pushed by Muhammad. Claude Code never creates tags or releases.
- `docs/binary.md`: download, verify the checksum, put on `PATH`, and one-line install commands for Linux/macOS (`curl` + `sha256sum -c`) and Windows (PowerShell `Invoke-WebRequest` + `Get-FileHash`). No piping a script into a shell.

### 15.3 Docker image

- `Dockerfile`: multi-stage. Build stage `node:22-bookworm-slim` runs `npm ci && npm run build && npm pack`. Runtime stage `node:22-bookworm-slim` with `git` installed (for `--diff`), installs the packed tarball globally, runs as a non-root user, `WORKDIR /src`, `ENTRYPOINT ["qa-core-review"]`, `CMD ["review"]`. Pin base images by digest at build time.
- Usage: `docker run --rm -v "$PWD:/src" ghcr.io/sprintsynergyio/qa-core-review:0.1.0 review --diff origin/main`. Document `git config --global --add safe.directory /src` handling (the entrypoint sets it for `/src` only).
- CI builds the image and runs the example-project review inside it (Linux only), but never pushes. `release.yml` pushes `ghcr.io/sprintsynergyio/qa-core-review:<version>` and `:latest` on a tag.

### 15.4 Pre-commit hook

- `.pre-commit-hooks.yaml` at the repo root, for the pre-commit framework:

```yaml
- id: qa-core-review
  name: qa-core-review (test quality)
  entry: qa-core-review review --fail-on error
  language: node
  additional_dependencies: []
  pass_filenames: true
  require_serial: true
  types: [text]
  minimum_pre_commit_version: "3.0.0"
- id: qa-core-review-docker
  name: qa-core-review (test quality, Docker)
  entry: ghcr.io/sprintsynergyio/qa-core-review:0.1.0 review --fail-on error
  language: docker_image
  pass_filenames: true
  require_serial: true
  types: [text]
```

- Check the pre-commit docs at build time for how `docker_image` hooks combine `entry` with the image `ENTRYPOINT`, and adjust the entry if needed.
- Files that no adapter claims are skipped silently, so the hook can run on all text files.
- `init --pre-commit` appends the snippet from `templates/precommit/pre-commit-config.snippet.yaml` to `.pre-commit-config.yaml` (or prints it if the file has other content it cannot merge safely). `templates/precommit/` also has a Husky script and a Lefthook snippet using `npx qa-core-review --staged`.

### 15.5 CI templates

`templates/ci/` holds ready-to-copy files, and `init --ci <provider>` writes them (never overwriting an existing file; it prints the snippet instead). Each one: fetches enough git history for `--diff`, runs the tool through npx (or the Docker image where Node is not available), writes JSON, SARIF, markdown and JUnit, publishes results natively, and fails the job on errors.

| Provider | File | How results show up |
| --- | --- | --- |
| GitHub Actions | `.github/workflows/qa-core-review.yml` | The action from 14.3: sticky comment, step summary, optional SARIF to code scanning |
| GitLab CI | `.gitlab-ci.yml` job `qa-core-review` | `artifacts:reports:junit` for the MR test widget; `report.md` as an artifact; uses `$CI_MERGE_REQUEST_DIFF_BASE_SHA` for `--diff` |
| Azure DevOps | `azure-pipelines.yml` step | `PublishTestResults@2` with JUnit; SARIF published as a `CodeAnalysisLogs` artifact for the SARIF SAST Scans Tab extension; `--diff origin/$(System.PullRequest.TargetBranch)` |
| Jenkins | `Jenkinsfile` stage | `junit` step; `recordIssues(tools: [sarif(pattern: '.qa-core/review/report.sarif')])` when Warnings NG is installed (documented as optional) |
| Bitbucket Pipelines | `bitbucket-pipelines.yml` step | JUnit in `test-results/` (auto-detected); `--diff origin/$BITBUCKET_PR_DESTINATION_BRANCH` |

Tests: each template is valid YAML (or a Groovy file that a simple check confirms contains the required steps), contains no secrets, and uses the same version placeholder that release prep updates. `docs/ci.md` explains each one with numbered steps.

---

## 16. LLM deep review (optional)

### 16.1 Modes

| Mode | What happens | Key |
| --- | --- | --- |
| `off` (default) | Static rules only. No network calls at all. | none |
| `anthropic` | Sends the reviewed test files to the Anthropic Messages API (`POST https://api.anthropic.com/v1/messages`) with `fetch`. | `ANTHROPIC_API_KEY` |
| `openai` | Sends them to the OpenAI Chat Completions API (`POST https://api.openai.com/v1/chat/completions`) with a JSON response format. | `OPENAI_API_KEY` |
| `claude-code` | No network call. Writes `.qa-core/review/llm-prompt.md` with the same prompt (all files in one document) so the running Claude Code session does the deep review itself, through the slash command. | none |

Models: keep one `DEFAULT_MODELS` constant in `src/llm/index.ts`. At build time, check each provider's current model list and set a current mid-priced model. Users override with `--llm-model` or `llm.model`. Support `ANTHROPIC_BASE_URL` and `OPENAI_BASE_URL` for proxies. No provider SDKs; plain `fetch`.

The LLM review is language-agnostic. It works on every Tier 1 and Tier 2 file, and it is the only review for Tier 3 files (`llm.includeLlmOnlyFiles`, default true).

### 16.2 Privacy rules (also in `docs/privacy.md` and the README)

1. In `off` and `claude-code` modes the tool makes zero network requests. A test replaces `globalThis.fetch` with a function that throws and runs a full review in both modes, over Tier 1 and Tier 3 fixtures.
2. In `anthropic` or `openai` mode, before sending, print which files and how many characters will be sent and to which host. In an interactive terminal, ask "Send N files to <host>? (y/N)". In a non-interactive run, require `--yes-send-code` or env `QA_CORE_REVIEW_SEND_CODE=1`; otherwise exit 2 with a clear message.
3. Send only the test files under review, plus the subject module when `llm.includeSubject` is true and the adapter found one. Never send `.env` files, config files, manifests, or files outside the root.
4. Redaction (`llm.redact`, on by default): before sending, replace with `"<redacted>"` the values of string literals assigned to names matching `/(pass(word)?|secret|token|api[_-]?key|auth|bearer|cookie|session)/i` (using the tree-sitter string and assignment nodes for languages with an adapter, and a cross-language regex for `name = "value"`, `name: "value"`, `name => "value"` and `"name": "value"` forms for Tier 3 files), strings that look like JWTs, AWS keys (`AKIA[0-9A-Z]{16}`), `sk-`, `ghp_`, `github_pat_` and `xox[bp]-` tokens, private key blocks, and email addresses. Line numbers must not change.
5. API keys come only from environment variables, are never logged, never written to any report, and are masked in error messages.
6. Files over `llm.maxCharsPerFile` are skipped with an info finding. At most `llm.maxFilesPerRun` files per run (Tier 1/2 files with static errors first, then Tier 3 files, then the rest).

### 16.3 Prompt design (`src/llm/prompt.ts`)

System prompt:
```
You are a senior QA engineer reviewing automated tests before merge. The tests can be in any programming language and any test framework. Your job is to find tests that would stay green when the feature they claim to test is broken, and important cases that are missing. Judge each test by the idioms of its own language and framework. You only review; you never rewrite whole files.
Rules:
- Report only problems you can point to with a line number in the given file.
- Do not repeat the static findings listed below. Add new ones, or say you disagree with one.
- Prefer a few high-confidence findings over many weak ones. At most 10 per file.
- For missing cases, name the exact scenario (input and expected result), not a category.
- Write each fix as code or advice in the file's own language and framework.
- If the normalized summary says "not available", first identify the tests in the file and return them in "tests".
- Reply with JSON only, matching the schema. No text outside the JSON.
```

User message, one per file:
```
Language: <language name, or the hint for Tier 3 files>
Framework: <runner> (libraries: <list or "none">)
File: <relative path>
Static review: <"full" | "partial (lexical fallback)" | "none (no static adapter)">
Normalized summary:
<one line per test: "L12-L30 test 'adds item to cart': 2 assertions (ui-state, equality), 1 fixed wait (3000 ms), mocks: none, skip: no", or "not available">
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

The normalized summary is built from `NTest` data only (Section 8.1), so the same prompt builder serves every adapter. Raw numbered source is always included, so the model sees the real code, not just the summary.

`schemas/llm-output.schema.json`:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["findings", "missingCases", "disagreements"],
  "properties": {
    "tests": {
      "type": "array", "maxItems": 200,
      "items": {
        "type": "object", "additionalProperties": false,
        "required": ["title", "startLine", "endLine"],
        "properties": {
          "title": { "type": "string", "maxLength": 200 },
          "startLine": { "type": "integer", "minimum": 1 },
          "endLine": { "type": "integer", "minimum": 1 }
        }
      }
    },
    "findings": {
      "type": "array", "maxItems": 10,
      "items": {
        "type": "object", "additionalProperties": false,
        "required": ["line", "category", "severity", "message", "fix"],
        "properties": {
          "line": { "type": "integer", "minimum": 1 },
          "category": { "enum": ["no-assertion", "weak-assertion", "cannot-fail", "wrong-target", "over-mocking", "flaky-timing", "brittle-selector", "swallowed-error", "missing-cleanup", "skipped-or-focused", "other"] },
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

**Mapping:** each LLM finding becomes a `Finding` with `source: "llm"`, `ruleId: "QCR-L001"`, `ruleName: "llm-finding/<category>"`, `confidence: "medium"`, attached to the test that contains the line. Missing cases become `QCR-L002` (`llm-missing-case`, info) at the matching suite line, or line 1. Disagreements are shown in the UI and JSON but never remove a static finding. For Tier 3 files, `tests` entries become `NTest` items (id from title and line as usual) so verdicts and the UI work per test; overlapping or out-of-range boundaries are dropped. LLM findings are capped at `warn` unless `llm.allowErrors` is true, so the exit code stays deterministic by default. A finding whose line is outside the file is dropped.

**Robustness:** validate the reply with ajv. On invalid JSON, retry once with "Your last reply was not valid JSON for the schema. Reply with JSON only." On a second failure, a timeout (`llm.timeoutMs`) or a network or HTTP error, add one info finding `QCR-L000 llm-unavailable` with the reason and continue. The LLM never fails the run. Tests use a fake `fetch` with recorded replies in `tests/fixtures/llm/` (including a Tier 3 Scala file and a Python file). CI makes no real API calls.

---
## 17. Testing plan

1. **Unit tests** (`tests/**/*.test.mjs`, `node:test`, against the built `dist/`): model schema, capability gating, project detection (each marker, monorepo, overrides), discovery, glob helper, tree-sitter loader (every grammar loads and its sha256 matches), lexical fallback, every rule (through the fixture helper), suppression (inline per comment syntax, and config), fingerprint stability (edit above a test, the id stays the same), config loading (JSON and YAML) and errors, diff line-range parsing (feed recorded `git diff -U0` output), each reporter, SARIF, JUnit and report schema validation, CLI exit codes (spawn `node dist/cli.js`), UI server API (port 0, with and without token, bad Host), feedback prompt (golden file), Claude hook handlers (pipe recorded hook JSON into the command, check exit code, stdout and stderr), `init` merge logic for every target, CI templates, LLM mapping and redaction with a fake `fetch`, GitHub comment logic against a fake API server on localhost.
2. **Adapter tests** (`tests/adapters/<adapter>.test.mjs`), for every adapter:
   - **Golden models:** each file in `fixtures/adapters/<adapter>/<framework>/` is normalized and compared with its `*.model.json` (validated against `schemas/model.schema.json`). `UPDATE_GOLDEN=1 npm test` rewrites goldens; the PR must show the diff and explain it.
   - **Coverage of the vocabulary:** every entry in the adapter's `vocab.ts` tables appears in at least one golden fixture (a test checks this by scanning the vocab and the fixtures).
   - **Capabilities:** the adapter declares only capabilities its goldens prove. A test fails if a declared capability is never filled in any golden.
   - **Detection:** `fixtures/projects/<adapter>-*` manifests (`pom.xml`, `pyproject.toml`, `package.json`, ...) are detected with the right frameworks and evidence.
   - **Robustness:** a syntax-error file, an empty file, a 1,000-line generated file (timing), a file with CRLF endings, a UTF-8 BOM, non-ASCII titles, and a file over 1 MB (skipped with a notice).
   - **No toolchains:** adapter tests never call `python`, `java`, `dotnet`, `go` or any other external tool. CI runners have some of them installed; the tests must pass without them (a test runs one review with `PATH` cleared for the child process).
3. **Rule fixtures:** `fixtures/rules/<id>/<language>-<framework>/{bad,good}`, at least 3 each per Tier 1 language where the rule applies (Section 10.0). Good fixtures must give zero findings from every rule.
4. **Git tests:** `tests/diff.test.mjs` makes a temp repo with `git init`, sets `user.name` and `user.email` locally inside that temp repo only, commits, edits, and checks `--diff` and `--staged` with JS, Python and Java files. If git is missing, skip with a clear message.
5. **Evals:** `evals/corpus/<language>/<framework>/` holds realistic AI-style test files written for this repo (generic apps only) with expected findings in `evals/labels.json`. Minimum counts for v0.1.0:

   | Language | Framework folders and minimum files |
   | --- | --- |
   | TypeScript/JavaScript | playwright 10, cypress 5, jest 6, vitest 6, mocha 4, webdriverio 4 (35 total) |
   | Python | pytest 8, unittest 4, playwright-python 5, selenium 5 (22 total) |
   | Java | junit5 6, junit4 3, testng 4, selenium 5, restassured 5 (23 total) |
   | Generic (Tier 3) | 3 files (Scala, Rust, Swift) that must give only X003 and no crash |

   `npm run eval` prints precision and recall per rule, per language and overall. It fails if any error-severity rule has precision below 0.95 or recall below 0.85 in any Tier 1 language where it applies, or any warn rule has precision below 0.85. v0.2.0 adds at least 8 files per Tier 2 adapter with the same thresholds.
6. **Coverage:** `npm run coverage` runs `c8 --check-coverage --lines 90 --functions 90 --branches 85` around the test command, with `sourceMap: true` in `tsconfig.build.json` so coverage maps to `src/`. CI fails below the thresholds.
7. **UI smoke test:** start the server, fetch `/` and `/api/report` with the token, send decisions, call `/api/finish`, compare the prompt with a golden file. No browser in CI. Before release, check the page by hand in Chrome and Firefox and take the README screenshots.
8. **Pack smoke:** `scripts/pack-smoke.mjs` runs `npm pack`, installs the tarball in a temp folder, runs `npx qa-core-review --version`, `detect` and a review of the copied Tier 1 example projects, and checks that `ui/`, `schemas/`, `skill/`, `templates/` and `grammars/` are in the package.
9. **Binary and Docker smoke:** Section 15.2 and 15.3.
10. **Cross-OS CI** (`.github/workflows/ci.yml`): matrix `os: [ubuntu-latest, windows-latest, macos-latest]` and `node: [22, 24]`, `fail-fast: false`, `permissions: contents: read`. Steps: checkout, setup-node with npm cache, `npm ci`, `npm run typecheck`, `npm run lint`, `npm run coverage`, `npm run eval`, `npm run pack:smoke`, and (Node 22 only) `npm run binary:smoke`. A separate Linux job builds the Docker image and runs it on the example projects. Windows rules: use `path` functions and convert to `/` for reports, quote globs in npm scripts so Node expands them, and use `spawn` with `shell: false` (on Windows, run `npx`/`npm` as `npm.cmd` or through `process.execPath` with the CLI file).
11. **Lint:** `npm run lint` runs `tsc --noEmit`, `scripts/check-text.mjs` (fails on tabs in source, trailing spaces, CRLF line endings, em dashes in docs, and any word listed in `scripts/forbidden-words.txt`, one word per line, starts empty, Muhammad fills it in; the file is not in the npm package) and `scripts/gen-support-matrix.mjs --check`. No ESLint in v0.1.

---

## 18. Milestones

### 18.1 Before Milestone 0 (Muhammad does this once)

1. Create the empty repo `sprintsynergyio/qa-core-review` on GitHub (private until launch is fine), with "Add a README" ticked so `main` exists. Do not add a license there; Milestone 0 adds it.
2. Clone it locally, put `SPEC.md`, `SPEC.v1.md` and `CLAUDE.md` in the root (they are committed in Milestone 0), and start Claude Code in that folder.
3. Make sure `gh auth status` shows the `sardar-usman` account and `git config user.email` in this repo is `usman@sprintsynergy.com` (Claude Code sets the repo-local name and email in Milestone 0 if they are not set).

### 18.2 How to work through the milestones

- Build them in order. One milestone = one branch `feat/<name>` (names below) = one pull request to `main`.
- Start each branch from the latest `main` (`git switch main && git pull && git switch -c feat/<name>`).
- Each PR must have tests, a green `npm test`, `npm run lint` and `npm run coverage` locally (plus `npm run eval`, `npm run pack:smoke` and `npm run binary:smoke` once they exist), an updated `CHANGELOG.md` "Unreleased" section, and a PR description with every acceptance criterion as a checkbox plus how it was checked.
- Push the branch, open the PR with `gh pr create --base main`, then stop and wait for Muhammad to say "next". Do not start the next milestone before that. Fix review comments on the same branch.
- Never merge, tag or publish.
- If a milestone grows past about 1,500 changed lines (excluding fixtures and goldens), stop and propose a split before continuing.

Build order and why: the model and adapter interface come first (M1) so nothing is written against one language's syntax tree. Tree-sitter (M2) and detection (M3) come next, then the JS/TS adapter (M4), so the engine and rules (M5 to M10) are built and tested end to end on the language with the most fixtures. Python (M13) and Java (M14) then prove the rules are really universal, mostly by adding vocab and fixtures. The UI, agent integrations, LLM and distribution follow, then v0.1.0 release prep. Tier 2 adapters (M27 to M34) come after v0.1.0 ships.

### Phase A: core and JS/TS

### Milestone 0: Repo scaffolding and CI (`feat/scaffold`)
Work: `package.json` (name `qa-core-review`, version `0.0.0`, `description`, `keywords`, `type: module`, `engines`, `bin`, `main`, `types`, `files` = `dist`, `ui`, `schemas`, `skill`, `templates`, `grammars`, `README.md`, `CHANGELOG.md`, `LICENSE`; author, contributors, homepage, bugs and repository like `qa-core-verify` with `sprintsynergyio` URLs; `publishConfig.access: public`; scripts `build`, `typecheck`, `lint`, `test`, `coverage`, `eval`, `pack:smoke`, `prepack`), `tsconfig.json`, `tsconfig.build.json`, `.nvmrc`, `.gitignore` (`node_modules`, `dist`, `coverage`, `.qa-core`, `*.tgz`, `.env*`, `sea-prep.blob`, `build-bin/`), `.gitattributes` (incl. `*.wasm binary`), MIT `LICENSE` ("Copyright (c) 2026 SprintSynergy"), stub `src/cli.ts` with `--version` and `--help`, `src/version.ts`, `tests/cli.test.mjs`, `scripts/check-text.mjs`, `scripts/pack-smoke.mjs`, an `evals/run.mjs` placeholder that prints "no evals yet" and exits 0, `.github/workflows/ci.yml` (17.10, without the binary and Docker jobs yet), PR template, `CHANGELOG.md`, README stub (one-line description, "Status: in development"), and commit `SPEC.md`, `SPEC.v1.md` and `CLAUDE.md`.
Acceptance:
- [ ] `npm ci && npm run build && npm test && npm run lint && npm run coverage && npm run pack:smoke` pass locally.
- [ ] `node dist/cli.js --version` prints `0.0.0`; `--help` prints usage; an unknown flag exits 2.
- [ ] CI is green on ubuntu, windows and macos with Node 22 and 24.
- [ ] No secrets, no client names; every commit authored by `SprintSynergy <usman@sprintsynergy.com>`.

### Milestone 1: Normalized model and adapter interface (`feat/model-adapters`)
Work: `src/model/types.ts`, `src/adapters/types.ts`, `src/adapters/index.ts` (registry), `src/rules/types.ts` (Rule with `requires`), `src/engine/capabilities.ts`, `schemas/model.schema.json`, `tests/helpers/golden.mjs`, and a tiny in-test "toy" adapter (a made-up line format) that proves the interface and capability gating end to end without tree-sitter.
Acceptance:
- [ ] The toy adapter produces an `NFile` that validates against `model.schema.json`.
- [ ] A rule that requires a capability the toy adapter does not declare is skipped and listed in `rulesSkipped` with a reason.
- [ ] The golden helper compares, rewrites with `UPDATE_GOLDEN=1`, and prints a readable diff.

### Milestone 2: Tree-sitter runtime and grammars (`feat/tree-sitter`)
Work: add `web-tree-sitter`, `src/parse/treesitter.ts` (lazy, cached), `src/parse/lexical.ts` (comment- and string-aware tokenizer used by the fallback), `src/parse/positions.ts`, `src/assets.ts`, `scripts/build-grammars.mjs`, vendored `grammars/{javascript,typescript,tsx,python,java}.wasm`, `grammars/manifest.json`, `grammars/LICENSES.md`, `docs/adapters.md` (parsing section).
Acceptance:
- [ ] Every grammar loads and parses a sample on all three OSes and both Node versions; sha256 values match the manifest.
- [ ] A file with a syntax error gives a tree with `ERROR` nodes and does not throw; the over-30% rule switches to the lexical fallback (tested).
- [ ] Parse of a 1,000-line TS, Python and Java file, cold start included, is under 500 ms on CI (timed test with margin).
- [ ] `npm pack` contains `grammars/` and the package size is noted in the PR.

### Milestone 3: Project detection, discovery and config (`feat/detect-discover`)
Work: `src/detect/*`, `src/discover/files.ts`, `src/util/glob.ts`, `src/config/*` (JSON and YAML, add the `yaml` dependency), `schemas/config.schema.json`, the `detect` command, `fixtures/projects/` (`js-basic`, `python-basic`, `java-basic`, `monorepo-mixed` with all three plus a Scala folder, and `override`).
Acceptance:
- [ ] `detect` on each fixture project prints the right adapters, frameworks and evidence; `--format json` validates.
- [ ] The monorepo assigns each file to the nearest project for its language; `projects` overrides win; Scala files go to `generic`.
- [ ] Glob helper tests cover `**`, `*`, `?`, `{a,b}` and Windows-style input paths.
- [ ] Invalid JSON or YAML config exits 2 with the file and JSON pointer; YAML custom tags are rejected.

### Milestone 4: JS/TS adapter (`feat/adapter-js`)
Work: `src/adapters/js/*` per Section 9.1 (Playwright, Cypress, Jest, Vitest, Mocha, WebdriverIO, node:test), queries, vocab, normalizer, helper collection, golden fixtures for each framework in `fixtures/adapters/js/`.
Acceptance:
- [ ] Every test in the JS fixtures is extracted with the right `fullTitle`, modifiers, `parameterized`, 1-based spans; `.each` tables and template literal titles handled.
- [ ] Goldens cover every vocab entry (vocab coverage test passes) for all six frameworks.
- [ ] Framework detection is right for each fixture, including a Playwright and a Jest file in the same project.

### Milestone 5: Engine, report, and `review` with pretty and JSON output (`feat/engine-cli`)
Work: rule registry, `src/engine/*` (run, fingerprint, verdict), `schemas/report.schema.json` (v2), the `review` command with the 11.2 flags except `--diff`, `--staged`, `--llm*` and the `ui` flags, `pretty` and `json` reporters, exit codes, `rules`, `explain`, `adapters` commands, `init --config`, `--dump-model`.
Acceptance:
- [ ] `node dist/cli.js review fixtures/projects/js-basic` prints the 11.4 layout and writes `report.json`, which validates against the schema.
- [ ] Exit codes 0, 1, 2 and 3 each covered by a test.
- [ ] `--fail-on`, `--rules`, `--disable`, `--language`, `--quiet`, `--no-color` and `NO_COLOR` covered by tests.

### Milestone 6: Assertion rules A001 to A004 (`feat/rules-assertions`)
Work: rules 10.2 to 10.5 (universal sub-cases, plus the JS framework sub-cases of A003), `tests/helpers/fixtures.mjs` (comment-syntax aware markers and sidecar files), `src/rules/fix-text.ts`, JS/TS fixtures, `docs/rules.md` sections.
Acceptance:
- [ ] Every `expect:` marker in the JS/TS bad fixtures matched exactly; zero findings on all good fixtures.
- [ ] `assertionHelpers` config, same-file helpers and the project helper index (a page object in a support file) tested.
- [ ] `docs/rules.md` has the bad and good examples for each rule.

### Milestone 7: Hard waits and brittle selectors W001, S001 (`feat/rules-waits-selectors`)
Acceptance:
- [ ] Every W001 and S001 sub-case has a JS/TS bad fixture (Playwright, Cypress, WebdriverIO); fake timers, `cy.wait('@alias')`, role and test id locators are not flagged.
- [ ] The shared selector classifier is unit-tested with a table of at least 40 selectors.
- [ ] `maxMs`, `allowPatterns` and `testIdAttribute` options tested.

### Milestone 8: Swallowed errors, focused and skipped tests E001, F001, F002 (`feat/rules-errors-focus`)
Acceptance:
- [ ] try/catch with and without rethrow, `.catch(() => {})`, and `expect.soft` (not flagged) tested.
- [ ] `test.skip(condition, reason)` not flagged; `fit`, `xit`, `test.fixme`, Mocha and Cypress `.only` flagged.
- [ ] Fixture markers and good-set checks pass; `docs/rules.md` updated.

### Milestone 9: Duplicates, snapshot-only and cleanup D001, P001, C001 (`feat/rules-dup-snapshot-cleanup`)
Acceptance:
- [ ] Duplicates found within a file and across two files, with the first copy named in the evidence; parameterized tests not flagged.
- [ ] Snapshot-only is warn for snapshots and info for visual checks.
- [ ] Every cleanup sub-case has a bad fixture and a fixed good twin.

### Milestone 10: Over-mocking and missing negative cases M001, N001 (`feat/rules-mocking-edge`)
Acceptance:
- [ ] Subject detection works for `./x`, `../src/x` and `subjectMap`; `importActual`/`requireActual` passthrough not flagged; `targetsSubject: null` never triggers sub-cases 1 and 2.
- [ ] N001 fires once per happy-path-only group, never on a group with an error case, and gives 2 to 3 suggestions.
- [ ] `docs/rules.md` complete for all rules, including the verify mapping column and the support matrix (`scripts/gen-support-matrix.mjs`).

### Milestone 11: Suppression and diff mode (`feat/suppress-diff`)
Work: 10.17 (inline and config), `--diff`, `--staged`, `src/discover/diff.ts`, `src/util/git.ts`.
Acceptance:
- [ ] Next-line and whole-file suppression with a reason works for `//` and `#` comment syntax and through config; without a reason gives `QCR-X002`; suppressed findings never change the exit code.
- [ ] Temp-repo test: only tests whose lines changed are reported; untracked test files are included; F001 is always reported in changed files.
- [ ] Not a git repo, or a bad base ref, exits 2 with a clear message.

### Milestone 12: SARIF, Markdown and JUnit reports (`feat/reports`)
Acceptance:
- [ ] SARIF validates against the 2.1.0 schema; levels, fingerprints and `properties` mapped as in 11.5.
- [ ] Markdown matches a golden file, starts with the marker, escapes table text, and truncates over 60,000 characters as specified.
- [ ] JUnit XML matches a golden file and passes the structural check in 11.7.
- [ ] `--format` and `--stdout` combinations tested.

### Phase B: more Tier 1 languages and Tier 3

### Milestone 13: Python adapter (`feat/adapter-python`)
Work: `src/adapters/python/*` per Section 9.2 (pytest, unittest, Playwright for Python, Selenium), goldens, Python rule fixtures for every rule that applies (A001 to A004 incl. Python sub-cases 6 to 8 of A003, W001, S001, E001, F002, D001, N001, M001, P001, C001), Python fix texts.
Acceptance:
- [ ] Goldens cover every Python vocab entry; fixtures pass for every applicable rule with no change to universal rule code (any needed change is explained in the PR).
- [ ] pytest fixtures with `yield` teardown, `conftest.py` helpers and `monkeypatch` are handled as in 9.2.
- [ ] `except Exception` around an assertion is E001; the async Playwright unawaited `expect` is A003.

### Milestone 14: Java adapter (`feat/adapter-java`)
Work: `src/adapters/java/*` per Section 9.3 (JUnit 4, JUnit 5, TestNG, Selenium, RestAssured, plus AssertJ, Hamcrest, Mockito vocab), goldens, Java rule fixtures for every applicable rule, Java fix texts.
Acceptance:
- [ ] Goldens cover every Java vocab entry, including `@Nested`, `@DisplayName`, `@ParameterizedTest`, TestNG `@DataProvider` and base-class hooks from a support file.
- [ ] `catch (Exception e)` around an assertion is not E001; `catch (AssertionError e)` and `catch (Throwable t)` are.
- [ ] `assertNotNull(driver.findElement(...))` is A003; RestAssured `.then().statusCode(...)` counts as an assertion; `@Mock` of the class under test is M001 error.

### Milestone 15: Generic adapter, Tier 3 (`feat/adapter-generic`)
Work: `src/adapters/generic/*` per Section 9.5, QCR-X003, `generic` config entries with optional patterns, `docs/languages.md` with the tier table and the Scala and Rust pattern examples.
Acceptance:
- [ ] Scala, Rust and Swift fixtures are listed as `llm-only` with one X003 each and never crash; X003 prints once per language in pretty output.
- [ ] With `patterns`, A001, W001, F001 and F002 run at `confidence: low` and match fixture markers.
- [ ] Binary files and files over 1 MB are skipped with a notice.

### Milestone 16: Eval corpus and example projects (`feat/evals`)
Work: `evals/corpus/**` (counts in 17.5), `evals/labels.json`, `evals/run.mjs` (per rule, per language), `example-project/saucedemo-ts` (incl. `ai-written.spec.ts` for the demo), `example-project/unit-ts`, `example-project/python`, `example-project/java`.
Acceptance:
- [ ] `npm run eval` prints per-rule, per-language precision and recall and meets the 17.5 thresholds; the CI eval step runs it.
- [ ] `node dist/cli.js example-project` reports at least one finding for every static rule, in each of the three Tier 1 languages where the rule applies.
- [ ] Coverage still at or above the 17.6 thresholds.

### Phase C: review UI and agent integrations

### Milestone 17: Local review UI (`feat/review-ui`)
Work: `src/ui/server.ts`, `src/ui/session.ts`, `ui/*` incl. `ui/highlight.js`, the `ui` command and its flags, screens 13.3, security rules 13.1.
Acceptance:
- [ ] Server binds to 127.0.0.1 only; missing token gives 403; wrong Host header is rejected (tests).
- [ ] Decisions and comments persist in `session.json` and survive a restart.
- [ ] The page makes no external requests (CSP header test, and a test that `ui/` files contain no `http://` or `https://` URLs except docs links).
- [ ] Highlighting works for TS, Python and Java (unit test on the tokenizer). Manual check notes (browser and OS) and two screenshots in the PR description, one with a mixed-language report.

### Milestone 18: Feedback prompt and gate mode (`feat/feedback-gate`)
Acceptance:
- [ ] The prompt matches the 13.4 template (golden files for approved and changes-requested, with files in three languages) and is saved to `.qa-core/review/feedback.md`.
- [ ] `ui --gate` exits 0 on approved and 1 on changes requested and prints the prompt to stdout (tested by driving the API).
- [ ] The outcome rule in 13.3 is tested for each case.

### Milestone 19: Claude Code integration (`feat/claude-code`)
Work: `hook claude-post-edit`, `hook claude-stop`, `init --claude`, `templates/claude/commands/qa-review.md`, `skill/SKILL.md`, the `claude.stopGate` config key, the Claude Code section of `docs/integrations.md`.
Acceptance:
- [ ] Hook tests with recorded stdin JSON: non-test file exits 0 silently; clean test file exits 0; bad TS, Python and Java files exit 2 with the stderr report; Tier 3 file exits 0 silently; `stop_hook_active: true` exits 0; Stop with errors prints valid `{"decision":"block",...}` JSON; internal errors exit 0.
- [ ] The post-edit hook finishes under 2 seconds on a 1,000-line file in each Tier 1 language, cold start (timed test with a CI margin).
- [ ] `init --claude` keeps existing settings, adds no duplicates on a second run, picks `npx --no-install` or the binary correctly, and `--force` overwrites only this tool's own files.
- [ ] The PR describes a manual check in a real Claude Code session: what Claude did after the hook fired on a Python or Java test.

### Milestone 20: Cursor and Codex setup (`feat/cursor-codex`)
Acceptance:
- [ ] `init --cursor` and `init --codex` write the files in 14.2 with globs from the detected adapters, and do nothing new on a second run.
- [ ] `docs/integrations.md` has numbered steps for Claude Code, Cursor, Codex, pre-commit and CI, with the date the agent docs were checked.

### Milestone 21: LLM deep review, language-agnostic (`feat/llm`)
Work: Section 16 in full, including Tier 3 test boundaries.
Acceptance:
- [ ] Zero network calls in `off` and `claude-code` modes (fetch-throws test) over Tier 1 and Tier 3 fixtures.
- [ ] A non-interactive run without `--yes-send-code` exits 2; the consent question appears in an interactive run.
- [ ] Redaction test for TS, Python, Java and a Tier 3 file: secrets replaced, line count unchanged; keys never appear in output or reports.
- [ ] Recorded replies for both providers map to `QCR-L001` and `QCR-L002`; a Tier 3 reply with `tests` produces per-test verdicts; invalid JSON is retried once, then `QCR-L000`; the run never fails because of the LLM.
- [ ] `claude-code` mode writes `.qa-core/review/llm-prompt.md` with the normalized summaries.

### Phase D: distribution and release

### Milestone 22: GitHub Action and PR comment (`feat/github-action`)
Work: `action.yml`, the `comment` command, `src/integrations/github.ts`, `.github/workflows/self-review.yml` (runs the action from the PR's own checkout on this repo, Linux, using `node dist/cli.js` instead of npm), `docs/github-action.md`, `docs/prcheck-integration.md`.
Acceptance:
- [ ] `comment` creates a comment, then updates the same one (tested against a fake GitHub API on localhost); fork PRs are skipped; a 403 gives a warning and exit 0.
- [ ] Inputs reach `run:` only through `env:` (a test reads `action.yml` and fails on `${{` inside any `run:` block); the Node setup step is skipped when Node 22.6+ exists.
- [ ] The self-review workflow posts a sticky comment on this milestone's own PR.

### Milestone 23: CI templates and pre-commit (`feat/ci-templates`)
Work: `templates/ci/*`, `templates/precommit/*`, `.pre-commit-hooks.yaml`, `init --ci <provider>`, `init --pre-commit`, `docs/ci.md`.
Acceptance:
- [ ] Each template is valid YAML (or passes the Jenkinsfile check), contains the steps in 15.5, and no secrets.
- [ ] `init --ci` never overwrites an existing file and prints the snippet instead; second run is a no-op.
- [ ] A test runs the `entry` of the node pre-commit hook with a list of mixed files (TS, Python, Markdown, PNG) and only the test files are reviewed.

### Milestone 24: Standalone binary and Docker image (`feat/binary-docker`)
Work: `scripts/build-sea.mjs`, `scripts/binary-smoke.mjs`, `src/assets.ts` SEA path, `Dockerfile`, `.dockerignore`, CI jobs (binary smoke on 3 OSes, Docker build and run on Linux), `.github/workflows/release.yml` (tag-only: binaries, `SHA256SUMS`, GHCR push, npm publish with `NPM_TOKEN`; it never runs on a branch), `docs/binary.md`, `docs/docker.md`.
Acceptance:
- [ ] The host-target binary runs `--version`, `detect` and a review of the example projects with no Node on `PATH`, and its `report.json` matches the npm run, on all three OSes.
- [ ] The Docker image builds, runs as non-root, reviews the mounted example projects, and `--diff` works inside it.
- [ ] `release.yml` triggers only on `v*` tags (a test reads the workflow file); nothing is published from this PR.

### Milestone 25: README, docs and demo GIF (`feat/readme-demo`)
Work: README per Section 19, `scripts/record-demo.mjs` and `docs/demo.tape`, all `docs/*` complete, screenshots in `docs/images/`.
Acceptance:
- [ ] Every command in the README was run and its output copied with the capture date, including one Python and one Java example.
- [ ] `docs/images/demo.gif` is under 5 MB and under 35 seconds, or the PR says Muhammad will record it and lists the exact steps.
- [ ] A small script checks that all relative links in README and docs resolve.

### Milestone 26: Release prep for 0.1.0 (`feat/release-0.1.0`)
Work: version `0.1.0`, `CHANGELOG.md` entry, `docs/release-acceptance.md` (the Section 20 checklist with results), final pack smoke, `npm publish --dry-run` output in the PR, version placeholders in templates and the pre-commit Docker hook updated to `0.1.0`.
Acceptance:
- [ ] `npm publish --dry-run` lists only the intended files; package size noted in the PR.
- [ ] Install from the packed tarball and the host binary work on all three OSes in CI.
- [ ] Nothing is published or tagged. The PR description ends with the exact release steps for Muhammad from Section 20.

### Phase E: Tier 2 (v0.2.0, after 0.1.0 is released)

Each Tier 2 milestone adds: the grammar (if any) to `grammars/` with manifest entries, the adapter per Section 9.4, goldens covering every vocab entry, rule fixtures for every applicable rule, at least 8 eval corpus files, fix texts, detection fixtures, and the support matrix update. Acceptance for each: goldens and fixtures pass with no change to universal rule code (or the change is explained), eval thresholds met for that adapter, the post-edit hook stays under 2 seconds, and binary size growth is noted in the PR.

### Milestone 27: C#/.NET adapter (`feat/adapter-dotnet`)
NUnit, xUnit, MSTest, Playwright for .NET; FluentAssertions, Moq, NSubstitute vocab; `catch (Exception)` swallows NUnit assertions.

### Milestone 28: Go adapter (`feat/adapter-go`)
`testing`, `t.Run`, testify `assert`/`require`/`suite`; the "condition is the check" pattern for A004; `t.Cleanup`/`defer` releases.

### Milestone 29: Ruby adapter (`feat/adapter-ruby`)
RSpec and Capybara; `fit`/`focus: true` for F001; rspec-mocks; `rescue` for E001.

### Milestone 30: Kotlin and PHP adapters (`feat/adapter-kotlin-php`)
Kotlin with JUnit 5, Kotest and MockK; PHP with PHPUnit. Shares Java vocab where possible.

### Milestone 31: Gherkin and Cucumber (`feat/adapter-gherkin`)
Line-based `.feature` parser, step-to-definition linking across the JS, Python, Java, Ruby and C# adapters (Cucumber expressions and regex), scenario outlines as parameterized tests, new rule `QCR-G001 unmatched-step`.

### Milestone 32: Robot Framework (`feat/adapter-robot`)
Line-based `.robot` parser, user keywords from resource files as helpers, SeleniumLibrary and Browser library vocab.

### Milestone 33: Performance scripts, k6 and JMeter (`feat/adapter-perf`)
k6 through the JS grammar with the `pacing` wait kind; JMeter `.jmx` through the XML grammar; new rule `QCR-K001 perf-no-thresholds`.

### Milestone 34: Postman and Newman collections (`feat/adapter-postman`)
JSON collection parsing, test scripts parsed with the JS grammar and mapped back to JSON line numbers, config-only suppression, sidecar fixture markers.

### Milestone 35: Release prep for 0.2.0 (`feat/release-0.2.0`)
Version `0.2.0`, CHANGELOG, README tier table moved to "Tier 2: supported", release acceptance doc, dry-run outputs. Nothing published or tagged.

---

## 19. README outline

Follow the style of the `qa-core-prcheck` and `qa-core-verify` READMEs: plain English, short sections, real copied output with the capture date.

1. `# qa-core-review` and one line: "Review AI-written tests before merge, in any language. Finds tests that stay green while checking nothing, and sends your feedback back to the agent."
2. Badges: npm version, CI, MIT license.
3. Demo GIF (`docs/images/demo.gif`).
4. "Works with Claude Code, Cursor and Codex. Static rules for JS/TS, Python and Java (Playwright, Cypress, Jest, Vitest, Mocha, WebdriverIO, pytest, unittest, Selenium, JUnit, TestNG, RestAssured), LLM review for any other language. No LLM or API key needed for static review."
5. Quick start: `npx qa-core-review`, `npx qa-core-review ui`; no Node? the binary or `docker run`.
6. Example output (copied, dated) from a mixed-language project.
7. Supported languages: the Section 7.5 tier table and a link to `docs/languages.md`.
8. What it checks: the 10.16 table, linking to `docs/rules.md`.
9. The review page: screenshot, and how approve, reject, comment and the feedback prompt work.
10. Use with Claude Code (`npx qa-core-review init --claude` and what the hooks do), Cursor and Codex.
11. CI: GitHub Action (the 14.3 YAML) and SARIF; GitLab, Azure DevOps, Jenkins, Bitbucket (`init --ci`); pre-commit.
12. Config (short JSON and YAML example, link to `docs/config.md`).
13. Optional LLM deep review and privacy (link to `docs/privacy.md`).
14. Exit codes.
15. How it fits with qa-core-verify, qa-core-prcheck, qa-core-heal, qa-core-flaky and playwright-migrate (links under `github.com/sprintsynergyio`).
16. Roadmap (Section 21).
17. Contributing (how to add a language adapter, link to `docs/adapters.md`), License (MIT), and "Built by SprintSynergy" with a link to https://sprintsynergy.com.

### Demo GIF steps

1. Use `example-project/saucedemo-ts/tests/ai-written.spec.ts`, which has a hard wait, a truthy-locator check, an nth-child selector and a `test.only`, plus `example-project/python/tests/test_checkout.py` with a swallowed assertion.
2. Terminal 100x28, font size 16, dark theme. Record the terminal with `vhs` from `docs/demo.tape` (or asciinema plus agg). Record the browser part with a screen recorder at 1280x800.
3. Scenes, about 30 seconds: (1) the AI-written test, 4 s; (2) `npx qa-core-review example-project`, showing TypeScript and Python findings, 6 s; (3) `npx qa-core-review ui`, the browser opens, reject the bad test with a comment, 12 s; (4) Finish dialog and Copy prompt, 4 s; (5) paste into Claude Code, it fixes the test, a re-run shows all pass, 4 s.
4. Export the GIF under 5 MB (`gifsicle -O3 --lossy=80`), plus an MP4 for social posts. Use real recordings only, no generated images.

---

## 20. Release and launch checklist (Muhammad does every irreversible step)

Release, after Milestone 26 is merged:
1. Muhammad checks out `main` and runs `npm ci && npm test && npm run pack:smoke`.
2. Muhammad tags `v0.1.0` and pushes the tag. `release.yml` builds the binaries, `SHA256SUMS` and the Docker image. If `NPM_TOKEN` is set as a repo secret it also runs `npm publish`; otherwise Muhammad runs `npm publish` by hand. Never commit a token.
3. Muhammad creates or edits the GitHub Release with the CHANGELOG text and checks that the binaries and checksums are attached.
4. Verify `npx qa-core-review@0.1.0 --version` in a clean folder on Linux, Windows and macOS; run one downloaded binary per OS; run `docker run --rm ghcr.io/sprintsynergyio/qa-core-review:0.1.0 --version`.
5. Make the GHCR package public and the repo public if they are still private.

Repo setup:
- Description: "Review AI-written tests before merge, in any language. Flags tests that stay green while checking nothing. Works with Claude Code, Cursor and Codex."
- Topics (max 20): `testing`, `test-automation`, `qa`, `code-review`, `static-analysis`, `test-quality`, `ai-agents`, `claude-code`, `cursor`, `codex`, `playwright`, `cypress`, `jest`, `pytest`, `junit`, `selenium`, `tree-sitter`, `sarif`, `github-actions`, `cli`.
- Homepage: the npm page. Social preview: a real screenshot of the review page.

Launch, same day (the team writes the posts; Amna posts on social media):
- Hacker News: "Show HN: qa-core-review, review AI-written tests before merge, in any language", with a short first comment (the problem, how it works, no LLM needed).
- Reddit: r/QualityAssurance, r/softwaretesting, r/Playwright, r/ClaudeAI, r/Python and r/java only if their rules allow tool posts. Read each subreddit's self-promotion rules first.
- LinkedIn company page post with the GIF; X post with the MP4.
- Add the tool to the open-source section of the SprintSynergy website (goes live only after Muhammad approves).
- Cross-link from the qa-core-verify and qa-core-prcheck READMEs, in separate PRs in those repos.

v0.2.0 follows the same steps after Milestone 35.

---

## 21. Roadmap (after v0.2.0)

- Static adapters for more Tier 3 languages, in order of demand: Scala (ScalaTest), Swift (XCTest), Rust, Dart (Flutter tests), Elixir (ExUnit).
- A `--baseline` file to accept existing findings and fail only on new ones.
- Fix suggestions as code patches in the review page.
- Read a `qa-core-verify` report and show runtime proof next to static findings.
- A requirements-to-test-cases gap view (spec in, missing cases out).
- `pyproject.toml` (`[tool.qa-core-review]`) config, and a CodeClimate report format for GitLab code quality.
- A VS Code extension.

## 22. Definition of done

**v0.1.0:** Milestones 0 to 26 merged, CI green on three OSes with Node 22 and 24, coverage at or above the thresholds, eval thresholds met for every Tier 1 language, binaries and Docker image pass their smoke tests, README output copied from real runs, no secrets or client names in the repo, and the Section 20 release steps ready for Muhammad.

**v0.2.0:** Milestones 27 to 35 merged with the same bar for every Tier 2 adapter.
