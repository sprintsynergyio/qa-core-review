# Changelog

## Unreleased

- Milestone 0, repo scaffolding and CI: `package.json`, TypeScript build to `dist/`, a CLI stub that answers `--version` and `--help` and exits 2 on an unknown flag, tests with `node:test`, the text hygiene check (`scripts/check-text.mjs`), the pack smoke test (`scripts/pack-smoke.mjs`), an eval placeholder, the MIT license, and a CI workflow for Linux, Windows and macOS with Node 22 and 24.
- Milestone 1, normalized model and adapter interface: the normalized test model (`src/model/types.ts`) with its JSON Schema (`schemas/model.schema.json`), the language adapter interface and registry, the rule and report types, and capability gating: a rule runs on a file only when the file has every capability the rule requires, and a skipped rule is listed with the reason. A toy adapter in the tests proves the interface end to end without a parser. Adds the golden file test helper (`UPDATE_GOLDEN=1 npm test`).
