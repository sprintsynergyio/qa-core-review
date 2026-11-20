## Milestone

M<n>: <title> (SPEC.md Section 18, branch `feat/<name>`)

## What changed

<!-- A short list. Keep the change limited to this milestone. -->

## Acceptance criteria

<!-- Copy every criterion from SPEC.md for this milestone. Tick it and say how it was checked. -->

- [ ] <criterion>. Checked by: <test name, command and output, or manual step>

## Checks run locally

- [ ] `npm run build`
- [ ] `npm test`
- [ ] `npm run lint`
- [ ] `npm run coverage`
- [ ] `npm run eval`
- [ ] `npm run pack:smoke`
- [ ] `npm run binary:smoke` (from Milestone 24)

## Checklist

- [ ] `CHANGELOG.md` updated under "Unreleased"
- [ ] No secrets, no client or company names, no em dashes
- [ ] No new dependency beyond SPEC.md Section 7.6 (or it was approved first)
- [ ] Golden model changes are listed and explained (adapter PRs)
- [ ] Changed lines are under about 1,500, not counting fixtures and goldens (or a split was proposed)

## Notes for the reviewer

<!-- Anything that differs from SPEC.md, and why. Open questions. -->
