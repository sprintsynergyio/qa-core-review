# Languages

qa-core-review reviews test files in any language. How much it can say about a file depends on the tier of its language.

## Coverage tiers

| Tier | Ships in | Languages and frameworks | Review type |
| --- | --- | --- | --- |
| 1 | v0.1.0 | JS/TS: Playwright, Cypress, Jest, Vitest, Mocha, WebdriverIO. Python: pytest, unittest, Playwright for Python, Selenium. Java: JUnit 4, JUnit 5, TestNG, Selenium, RestAssured | Full static rules + optional LLM |
| 2 | v0.2.0 | C#/.NET: NUnit, xUnit, MSTest, Playwright for .NET. Go: `testing`, testify. Ruby: RSpec, Capybara. Robot Framework. Gherkin/Cucumber feature files plus step definitions. k6 and JMeter. Postman/Newman collections. Kotlin. PHP: PHPUnit | Full static rules + optional LLM |
| 3 | v0.1.0 | Anything else (Scala, Swift, Rust, Dart, Elixir, C++, shell test suites, Tier 2 before v0.2.0, and so on) through the generic adapter: file glob plus language hint | Listed in the report; LLM-only review when LLM mode is on; optional user-supplied line patterns for a few low-confidence static checks |

Which rule runs on which Tier 1 language is in the [support matrix](rules.md#which-rules-run-on-which-language), which is made from the code. `qa-core-review adapters` prints the adapters of your build, and `qa-core-review detect` shows which files of your project go to which adapter.

## Tier 3: the generic adapter

A test file in a language with no static adapter is still found, so no test file goes unseen.

**Which files.** A file goes to the generic adapter when no other adapter knows its extension and one of these is true:

- A `generic` entry in the config matches it (any extension).
- It has a known source extension and a common test name: `*Test.*`, `*Tests.*`, `*Spec.*`, `*_test.*`, `*_spec.*`, `*.test.*`, `*.spec.*`, `test_*.*`, or any file in a `test`, `tests`, `spec` or `specs` folder.

The known extensions are `.scala .swift .rs .dart .ex .exs .cpp .cc .c .m .lua .r .jl .clj .sh .bats .ps1`, and until v0.2.0 also the Tier 2 ones: `.cs .go .rb .kt .kts .php .robot .feature .jmx .postman_collection.json`.

**What you get by default.** The file is listed in every report with `parseStatus: "llm-only"` and one info finding:

```
QCR-X003  info   1:1  No static rules for Scala yet. Run with --llm to review this file.
```

The text output prints this once per language and says how many more files there are. The JSON report has it for every file. It is info, so it never fails a run at the default `--fail-on error`. To hide it, set `"rules": { "QCR-X003": "off" }`.

**Skipped files.** A file larger than 1 MB and a file that is not text (it has a NUL character in its first 8,000 characters) are not read. Each gets a notice on stderr and is left out of the report.

## Line patterns: a few static checks for a Tier 3 language

You can teach qa-core-review enough about a language to run four rules on it. Give regular expressions in a `generic` entry of the config:

| Key | What it matches | Rule it switches on |
| --- | --- | --- |
| `testPattern` | The line that starts a test. Required. | all four |
| `assertionPattern` | A line that checks something | [QCR-A001](rules.md#qcr-a001) no-assertion |
| `sleepPattern` | A line that sleeps for a fixed time | [QCR-W001](rules.md#qcr-w001) hard-wait |
| `skipPattern` | A test that is switched off | [QCR-F002](rules.md#qcr-f002) skipped-test |
| `focusPattern` | A test that is marked to run alone | [QCR-F001](rules.md#qcr-f001) focused-test |

Every finding from these patterns has `confidence: "low"`, because nothing else is known about the code. A rule whose pattern you leave out does not run on those files, and the report says so under `rulesSkipped`. The other rules never run on a Tier 3 file. The file is then no longer `llm-only` and gets no QCR-X003.

### How the patterns are read

- Each pattern is a JavaScript regular expression, tried on **one line at a time**, with comments removed. For `assertionPattern` and `sleepPattern` the text inside string literals is blanked too, so a title such as `"should add an item"` is not taken for an assertion.
- **Where a test ends.** If the body opens with `{` on the matched line, or on a line right below it at the same indent (`fn adds() {` under `#[test]`), the test ends at the matching `}`. Otherwise the test is the lines below the match that are indented deeper, plus the line that closes them (`end`). A match inside another test is not a test of its own.
- **Assertions and sleeps** are looked for in the body, not in the line that declares the test.
- **Skip and focus** are looked for in the header of the test only: the matched line, the lines down to the opening `{`, and marker lines right above the match (lines that start with `@`, `#[` or `[`, such as `@Disabled`, `#[ignore]`, `@tag :skip` or `[Ignore]`). A skip inside the body, such as `throw XCTSkip()`, is not seen.
- **The title** of a test is the group named `title` in `testPattern`, when it has one. Without it, the title is the line that declares the test (`fn adds_an_item()`).
- **The reason of a skip** is the group named `reason` in `skipPattern`, when it has one. Without it, the finding says that no reason is given.
- Comments and strings are known for the languages in the extension list above. For any other `language` value, every line is read as code, and suppression comments are not found.

### Scala (ScalaTest)

```yaml
generic:
  - glob: "**/src/test/scala/**/*Spec.scala"
    language: scala
    framework: scalatest
    patterns:
      testPattern: '^\s*(?:it|test|ignore)\s*\(\s*"(?<title>[^"]*)"'
      assertionPattern: '\b(?:assert|assertResult|assertThrows|intercept|should|shouldBe|mustBe)\b'
      sleepPattern: 'Thread\.sleep\('
      skipPattern: '^\s*ignore\s*\('
```

With this config, the file

```scala
class CartSpec extends AnyFunSuite with Matchers {
  test("should add an item") {
    val cart = new Cart()
    cart.add("backpack", 1)
  }

  ignore("applies a coupon") {
    val cart = new Cart().withCoupon("SAVE10")
    Thread.sleep(500)
    cart.total shouldBe 26.99
  }
}
```

gets QCR-A001 on line 2 (no assertion: the word "should" in the title does not count), QCR-F002 on line 7 and QCR-W001 on line 9.

### Rust (cargo test)

```yaml
generic:
  - glob: "**/*.rs"
    language: rust
    patterns:
      testPattern: '^\s*#\[(?:tokio::)?test\b'
      assertionPattern: '\b(?:assert|assert_eq|assert_ne|panic)!'
      sleepPattern: '\bsleep\('
      skipPattern: '#\[ignore(?:\s*=\s*"(?<reason>[^"]*)")?\]'
```

The same in JSON, where each backslash is written twice:

```json
{
  "generic": [
    {
      "glob": "**/*.rs",
      "language": "rust",
      "patterns": {
        "testPattern": "^\\s*#\\[(?:tokio::)?test\\b",
        "assertionPattern": "\\b(?:assert|assert_eq|assert_ne|panic)!",
        "sleepPattern": "\\bsleep\\(",
        "skipPattern": "#\\[ignore(?:\\s*=\\s*\"(?<reason>[^\"]*)\")?\\]"
      }
    }
  ]
}
```

With this config, the file

```rust
#[test]
fn clears_the_cart() {
    let mut cart = Cart::new();
    cart.clear();
}

#[test]
#[ignore = "needs the payment sandbox"]
fn pays_the_order() {
    sleep(Duration::from_secs(2));
    assert!(Checkout::new().pay("4111", 29.99).is_ok());
}
```

gets QCR-A001 on line 1, QCR-F002 on line 7 ("This test is skipped: needs the payment sandbox.") and QCR-W001 on line 10. Rust has no way to focus a test, so there is no `focusPattern`. A `glob` of `**/*.rs` also takes unit tests inside `src/`.

### Limits

- The patterns see lines, not code. A helper that asserts is not followed, so a test that checks only through a helper gets QCR-A001 unless the helper's name is in `assertionPattern`.
- A test that expects a failure through an attribute (`#[should_panic]`) has no assertion line and gets QCR-A001. Suppress it with a comment and a reason.
- Sleeps in setup code outside a test are not seen, and the length of a sleep is not read, because the unit differs per language. `QCR-W001` `maxMs` has no effect on these files.
- A focused or skipped group (`fdescribe`, `xdescribe`) is not seen, only single tests.
- A file in which `testPattern` matches nothing gets [QCR-X001](rules.md#qcr-x001): no test was found.
- `framework` is kept for the LLM review. The static part does not use it.
