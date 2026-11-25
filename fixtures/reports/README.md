# Report fixtures

`shop/` is a small project for the report tests (`tests/reports.test.mjs`). The tests review it
with the toy rules of `tests/helpers/toy-rules.mjs`, so the golden files below do not change
when the text of a real rule changes.

- `shop.report.md`: the Markdown report (SPEC.md Section 11.6).
- `shop.report.junit.xml`: the JUnit XML report (SPEC.md Section 11.7), with `--fail-on error`.

Update them only with `UPDATE_GOLDEN=1 npm test`, and explain every diff in the pull request.
