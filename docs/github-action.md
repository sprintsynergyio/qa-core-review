# GitHub Action

The action reviews the tests a pull request changes and keeps one comment on the pull request up to date with the result. It works in a repo of any language: it sets up Node itself when the runner has none that is new enough, and it never runs your build or your tests.

Status: the action runs the npm package, so it works for other repos once `qa-core-review` is published. Until then it runs only in this repo, from the checkout (see "How this repo uses it").

## Use it

Add `.github/workflows/test-review.yml`:

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
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0
      - uses: sprintsynergyio/qa-core-review@v0.1.0
        with:
          fail-on: error
```

The workflow is the same for a JavaScript, Python or Java repo.

Two lines matter:

- `fetch-depth: 0` gives the checkout the history of the base branch. The review compares the pull request with `origin/<base branch>`, and with a shallow checkout git does not know that ref. The review then stops with exit code 2 and a message that names the ref.
- `pull-requests: write` lets the built-in token write the comment. Without it GitHub answers 403, the action prints a warning, and the job goes on. The report is still in the job summary.

## What it does

1. Checks Node. When the runner has Node 22.6 or later, nothing is installed. When it has an older Node or none, the action runs `actions/setup-node` with `node-version`.
2. Runs `npx --yes qa-core-review@<version> review --diff <base> --format json,markdown --output .qa-core/review --fail-on <level>` and keeps the exit code. With `sarif: true` and `junit: true` those formats are added to the list.
3. Adds `report.md` to the job summary.
4. Posts the report as one comment on the pull request, or updates the comment it posted before (`qa-core-review comment --report .qa-core/review/report.json`).
5. With `sarif: true`, uploads `report.sarif` to code scanning.
6. Uploads the folder `.qa-core/review/` as the artifact `qa-core-review-report`.
7. Ends with the exit code of step 2, so the job fails when a finding is at or above `fail-on`.

Only the tests whose lines changed in the pull request are reviewed. A focused test (`QCR-F001`) and a file that cannot be parsed (`QCR-X001`) are reported for every changed file.

## Inputs

| Input | Default | Meaning |
| --- | --- | --- |
| `base-ref` | empty | The git ref to compare with. Empty means `origin/` plus the base branch of the pull request. In a run with no pull request and no `base-ref`, every test file is reviewed. |
| `paths` | empty | Files, folders or globs to review, one per line. Empty means every test file the tool detects. A space inside a line belongs to the path. |
| `fail-on` | `error` | `error`, `warn`, `info` or `never`. The job fails when a finding is at or above this level. |
| `comment` | `true` | Post the report as a comment on the pull request and update it on every run. |
| `github-token` | `${{ github.token }}` | The token that writes the comment. It needs `pull-requests: write`. It is given to the comment step only. |
| `comment-author` | `github-actions[bot]` | The account the token comments as. Only a comment by this account is updated. Change it when you pass the token of another account or app. |
| `sarif` | `false` | Also write `report.sarif` and upload it to code scanning. |
| `junit` | `false` | Also write `report.junit.xml` into the artifact. |
| `version` | empty | The npm version of `qa-core-review` to run. Empty means the version of the action you use: `@v0.1.0` runs `qa-core-review@0.1.0`. |
| `node-version` | `22` | The Node version to set up when the runner has no Node 22.6 or later. |
| `cli` | empty | Path to a built `cli.js` to run with `node` in place of the npm package. It is for testing the action from a checkout of this repo. |

Output: `exit-code`, the exit code of the review (0 no finding at or above `fail-on`, 1 findings, 2 usage or config error, 3 internal error).

Every input reaches the scripts of the action through an environment variable and is used as a quoted shell variable. No input is pasted into a script.

## The comment

The comment starts with the line `<!-- qa-core-review -->`. On the next run the action looks for a comment that starts with this line and was written by `comment-author`, and updates it. A comment with the same first line by anybody else is never touched. When nothing changed, the comment is left alone.

This is the comment for a small sample project with one bad test, copied from a real run of version 0.0.0 on 2026-11-27:

```markdown
<!-- qa-core-review -->
## Test review

1 test needs changes, 0 need review, 1 passes.

| Verdict | Where | Lang | Test | Rules |
| --- | --- | --- | --- | --- |
| fail | `tests/cart.spec.ts:3` | TS | adds an item to the cart | QCR-A001, QCR-W001 |

<details>
<summary>fail: tests/cart.spec.ts:3 adds an item to the cart</summary>

- **QCR-A001** (error), line 3: This test has no assertion, so it passes whatever the code does. Evidence: `adds an item to the cart`. Fix: Add an assertion that checks the result of the action, for example the URL, a visible element or the response body.
- **QCR-W001** (warn), line 6: Hard wait of 3000 ms. Evidence: `page.waitForTimeout(3000)`. Fix: Wait for a condition instead: a web-first assertion, an explicit wait (WebDriverWait, waitForResponse) or a polling helper. For timing failures that come and go, see qa-core-flaky.

</details>

Reviewed by [qa-core-review](https://github.com/sprintsynergyio/qa-core-review), an open-source tool by SprintSynergy.
```

The comment is at most 60,000 characters. A longer report keeps its table and drops the details, with a pointer to the artifact.

No comment is posted, and the job does not fail because of it, when:

- the pull request comes from a fork. The token of such a run cannot write, so the action prints a notice and skips the comment. The report is in the job summary.
- the run has no pull request (a push, a schedule).
- GitHub answers 403. The action prints a warning that names the missing permission.
- GitHub cannot be reached or answers with another error. The action prints a warning.

## The comment command

The action calls `qa-core-review comment --report <file>`. You can call it yourself in any GitHub Actions job of a pull request:

```bash
npx qa-core-review review --diff origin/main --fail-on never
GITHUB_TOKEN="$TOKEN" npx qa-core-review comment --report .qa-core/review/report.json
```

It reads `GITHUB_TOKEN`, `GITHUB_REPOSITORY`, `GITHUB_EVENT_PATH` (the pull request number is in the event file) and `GITHUB_API_URL`. GitHub Actions sets the last three. `--author <login>` names the account whose comment is updated.

Exit codes: 0 posted, updated or skipped, 1 GitHub could not be reached or answered with an error other than 403, 2 usage error.

`comment` is the only command that uses the network when LLM mode is off. The token is sent in the `Authorization` header of requests to `GITHUB_API_URL` and nowhere else. It is never printed or written to a file. The address must start with `https://`.

## SARIF and code scanning

```yaml
permissions:
  contents: read
  pull-requests: write
  security-events: write
jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0
      - uses: sprintsynergyio/qa-core-review@v0.1.0
        with:
          sarif: true
```

`security-events: write` is needed for the upload. Code scanning is free for public repos. A private repo needs it enabled for the repo.

## Use with qa-core-prcheck

**Option A (works now).** Run both actions in the same job. Each keeps its own comment, because each finds its comment by its own first line.

```yaml
steps:
  - uses: actions/checkout@v7
    with:
      fetch-depth: 0
  - uses: sprintsynergyio/qa-core-prcheck@<version>
  - uses: sprintsynergyio/qa-core-review@v0.1.0
```

Replace `<version>` with the version of qa-core-prcheck you use, as its README shows it.

**Option B (a proposal).** qa-core-prcheck gets an input `review: true` and shows the test review under a "Test quality" heading in its own summary. It is not built. The proposal and the contract it relies on are in [prcheck-integration.md](prcheck-integration.md).

## How this repo uses it

`.github/workflows/self-review.yml` runs the action on every pull request of this repo, from the checkout of the pull request: it builds the tool and passes `cli: dist/cli.js`, so the code of the pull request reviews the tests of the pull request. It is advice and not a gate (`fail-on: never`). Only the repo's own test files are listed in `paths`, because the fixture folders hold bad tests on purpose.

## When something goes wrong

| What you see | Why | What to do |
| --- | --- | --- |
| Exit code 2 and a message that git does not know `origin/main` | The checkout is shallow | Add `fetch-depth: 0` to `actions/checkout` |
| A warning that the comment was not posted, with 403 | The token may not write comments | Add `pull-requests: write` under `permissions` |
| A notice that the pull request comes from a fork | The token of a fork run is read-only | Nothing. Read the report in the job summary |
| A second comment appears on every run | The token belongs to another account than `comment-author` | Set `comment-author` to the login of that account |
| `npm error 404` for `qa-core-review@<version>` | That version is not on npm | Use a released tag of the action, or set `version` |
