# Showing the test review inside qa-core-prcheck

Status: a proposal for a later pull request in the qa-core-prcheck repo. Nothing in this repo changes qa-core-prcheck, and nothing here is built on the prcheck side yet. What works today is Option A in [github-action.md](github-action.md): run both actions in one job.

## The idea

qa-core-prcheck gets one new input:

| Input | Default | Meaning |
| --- | --- | --- |
| `review` | `false` | Also review the tests the pull request changes with qa-core-review, and show the result under a "Test quality" heading in the prcheck summary. |

With `review: true`, prcheck runs:

```bash
npx --yes qa-core-review --diff "$BASE" --stdout markdown --fail-on never
```

and puts the output under a "Test quality" heading in its summary. `$BASE` is the base ref prcheck already works with, passed through `env` like every other input.

## What prcheck can rely on

1. **The Markdown.** The output of `--stdout markdown` starts with the line `<!-- qa-core-review -->` and is at most 60,000 characters. After the marker come a `## Test review` heading, a one-line verdict, a table of the tests that fail or need review, and one collapsed block of findings per row. Text from the reviewed code is escaped, and an `@name` in a test title mentions nobody.
2. **The report file.** The same run writes `.qa-core/review/report.json`. It follows `schemas/report.schema.json` with `schemaVersion: 2`. `summary.fail`, `summary.review` and `summary.pass` hold the counts if prcheck wants one line in place of the whole table.
3. **The exit code.** With `--fail-on never` the exit code is 0 when the review ran, also when it found problems. 2 is a usage or config error (for example a base ref git does not know) and 3 is an internal error. prcheck should treat 2 and 3 as "no test review this time", print the message from stderr as a warning, and go on.
4. **No network and no secrets.** The review reads files and runs git. It makes no network call and needs no token.

A change to point 1 or 2 that would break prcheck is a new `schemaVersion` and a note in the changelog of this repo.

## What prcheck should do with the output

- When prcheck puts the Markdown inside its own comment, remove the first line (the marker). The marker is how `qa-core-review comment` finds its own comment, and a prcheck comment that starts with it could be taken for one.
- Turn the `## Test review` heading into the "Test quality" heading at the level that fits the prcheck summary.
- Keep the last line, the link to this repo.
- Do not run `qa-core-review comment` in the same job. One comment is enough.

## Choosing between the two options

| | Option A: both actions | Option B: `review: true` in prcheck |
| --- | --- | --- |
| Works today | yes | no, it needs a prcheck release |
| Comments on the pull request | two | one |
| The job can fail on test findings | yes, with `fail-on` | no, the review is information in the prcheck summary |
| SARIF upload and report artifact | yes | no |

## Open points for the prcheck pull request

- Which Node version prcheck sets up. qa-core-review needs Node 22.6 or later.
- Whether prcheck pins a version of qa-core-review or runs the latest.
- Whether a failing test review should change the prcheck verdict. The proposal says no.
