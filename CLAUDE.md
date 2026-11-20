# CLAUDE.md: standing rules for qa-core-review

`qa-core-review` reviews test code in any language, especially AI-written tests, and flags tests that stay green while checking nothing. Language/framework adapters turn test files into one normalized test model, and rules run on that model. The full spec is `SPEC.md`. Read it before you start, and re-read the relevant section before each milestone. `SPEC.v1.md` is the older JS/TS-only spec, for reference only. If this file and SPEC.md disagree, this file wins for process and SPEC.md wins for product behavior.

## Kickoff workflow

1. Read `SPEC.md` and this file.
2. Reply with a short summary: what the tool does, the coverage tiers, the adapter architecture, the milestone list (0 to 35, with 0 to 26 being v0.1.0), and any questions or risks you see. Then **wait for Muhammad to say "go"**.
3. After "go", build **Milestone 0** only.
4. For every milestone:
   1. `git switch main && git pull`
   2. `git switch -c feat/<name>` (the branch name given in SPEC.md Section 18)
   3. Build the milestone with tests. Keep the change limited to that milestone. If it grows past about 1,500 changed lines (not counting fixtures and goldens), stop and propose a split.
   4. Run `npm run build && npm test && npm run lint && npm run coverage` (and `npm run eval`, `npm run pack:smoke`, `npm run binary:smoke` once they exist). All must pass.
   5. Update `CHANGELOG.md` under "Unreleased".
   6. Commit, push the branch, and open a PR: `gh pr create --base main --title "M<n>: <title>"`. The PR body lists every acceptance criterion as a checkbox with how you checked it.
   7. Tell Muhammad the PR link, then **stop and wait for "next"**. Do not start the next milestone on your own.
5. If a PR gets review comments, fix them on the same branch and push again.

## Repo rules (never break these)

- Repo: `github.com/sprintsynergyio/qa-core-review`. Use only the `sprintsynergyio` org. Never use `sprintsynergyhq`, `sprint-synergy` or any other org name in URLs, image names or package metadata, even if an older SprintSynergy repo does. The Docker image is `ghcr.io/sprintsynergyio/qa-core-review`.
- Commit author: `SprintSynergy <usman@sprintsynergy.com>`. Set it for this repo only: `git config user.name "SprintSynergy"` and `git config user.email "usman@sprintsynergy.com"`.
- **Never push to `main`.** Never merge, force-push, tag, create a release, run `npm publish`, push a Docker image, or upload binaries. Muhammad merges, tags and publishes. The release workflow may only trigger on tags.
- No secrets in the repo: no API keys, tokens or `.env` files. Keys come only from environment variables. Never print a token.
- License: MIT, "Copyright (c) 2026 SprintSynergy". Vendored grammars must be MIT, Apache-2.0 or BSD, listed in `grammars/LICENSES.md`; otherwise stop and ask.
- Do not mention any competition or event. Do not use client or company names anywhere; use generic names, the public SauceDemo site, or `https://api.example.test`.
- Do not add dependencies beyond SPEC.md Section 7.6 without asking first.
- Static review is offline by default: no network calls unless LLM mode is on and the user agreed (SPEC.md Section 16.2), or the `comment` command is run. LLM review is always opt-in.
- Stop and ask if a step needs anything irreversible or outside this repo.
- No em dashes in docs, comments or messages.

## Conventions

- The tool is TypeScript on Node 22.6 or later, ESM (`"type": "module"`), compiled by `tsc` to `dist/`, whatever language it reviews. It never runs Python, Java, .NET, Go or any other toolchain, and never runs the user's build.
- Parsing: `web-tree-sitter` (WASM) with vendored grammars in `grammars/` (sha256 in `grammars/manifest.json`). No native parser bindings, no ts-morph, no Babel, no TypeScript compiler API for parsing. Fallback is the lexical scanner in `src/parse/lexical.ts`.
- Layout: one folder per adapter in `src/adapters/<id>/` with `adapter.ts`, `detect.ts`, `vocab.ts` (vocabulary as data tables), `normalize.ts`, `queries/*.scm` and optional `rules/` for framework-specific rules. Universal rules live in `src/rules/` and read **only** the normalized model (`src/model/types.ts`); they never import tree-sitter or an adapter. Language-specific facts belong in the adapter's vocab and normalizer, not in rules.
- Adapters declare their `capabilities`; the engine skips rules whose `requires` are not met. Never guess a fact: use `null` or leave the capability out.
- Rule ids `QCR-xxxx` are stable forever. New rules take the next free number in their category; never reuse or renumber an id.
- Tests: Node's built-in `node:test`, files `tests/**/*.test.mjs`, run against `dist/`. No vitest, jest or mocha as the runner (they only appear as fixtures).

## Testing rules for adapters

Every adapter PR must include:
- **Golden models:** fixtures in `fixtures/adapters/<adapter>/<framework>/` with a `*.model.json` golden each, validated against `schemas/model.schema.json`. Update goldens only with `UPDATE_GOLDEN=1 npm test`, and explain every golden diff in the PR.
- **Vocab coverage:** every entry in the adapter's `vocab.ts` appears in at least one golden fixture (the vocab coverage test enforces this).
- **Capability proof:** every declared capability is filled in at least one golden.
- **Rule fixtures:** for every rule that applies to the language, at least 3 bad and 3 good files in `fixtures/rules/<id>/<language>-<framework>/{bad,good}/`. Bad files mark findings with `// expect: QCR-xxxx` or `# expect: QCR-xxxx` (the file's own comment syntax), or a `<file>.expect.json` sidecar for formats without comments. Good files must give zero findings from every rule.
- **Detection fixtures:** a small project in `fixtures/projects/` with the language's manifest files.
- **Robustness:** syntax error, empty file, CRLF, BOM, non-ASCII titles, a 1,000-line file under the time budget (post-edit hook under 2 seconds, cold start).
- **No toolchains:** tests must pass with no Python, JDK, .NET, Go, Ruby or PHP installed.
- **Eval corpus:** files in `evals/corpus/<language>/<framework>/` with labels, meeting the SPEC.md Section 17.5 thresholds for that language.
- **Fix texts:** rule messages and fixes for the language in `src/rules/fix-text.ts`, written in that language's idioms.
- If a universal rule needs a code change to work for the new language, explain why in the PR; prefer fixing the adapter's normalization instead.

## Other conventions

- Reports go to `.qa-core/review/` in the user's project.
- Paths in all output use `/`, on every OS. Use `spawn` with `shell: false`. Files use LF line endings (`.gitattributes`: `* text=auto eol=lf`, `*.wasm binary`).
- All assets (grammars, `ui/`, `schemas/`, `templates/`, `skill/`) are read through `src/assets.ts`, so the standalone binary works.
- Plain, clear English in messages, docs and the README. README output must be copied from a real run, with the date.

## Commands

```bash
npm ci                 # install
npm run build          # tsc -p tsconfig.build.json
npm run typecheck      # tsc --noEmit
npm run lint           # typecheck + scripts/check-text.mjs + support matrix check
npm test               # build, then node --test "tests/**/*.test.mjs"
UPDATE_GOLDEN=1 npm test   # rewrite adapter golden models (explain diffs in the PR)
npm run coverage       # c8 --check-coverage --lines 90 --functions 90 --branches 85
npm run eval           # rule precision/recall per language on evals/corpus (from Milestone 16)
npm run pack:smoke     # npm pack, install the tarball in a temp folder, run it
npm run binary:smoke   # build the SEA binary for this OS and run it (from Milestone 24)
node scripts/build-grammars.mjs   # rebuild vendored grammars (by hand only)
node dist/cli.js --help
node dist/cli.js detect
```

CI (`.github/workflows/ci.yml`) runs typecheck, lint, coverage, eval, pack smoke and binary smoke on ubuntu, windows and macos with Node 22 and 24, plus a Docker build-and-run job on Linux. A milestone is done only when CI is green on all of them.
