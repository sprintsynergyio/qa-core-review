# CI and pre-commit

qa-core-review reviews test files without running them, so it needs no browser, no database and no build of your project. In CI it reviews the tests that a pull request changes. Before a commit it reviews the tests that are staged.

This page has the steps for five CI systems and three kinds of commit hook. `qa-core-review init` writes the files for you:

```
qa-core-review init --ci github      # or gitlab, azure, jenkins, bitbucket
qa-core-review init --pre-commit
```

A real run (2026-11-28, in an empty folder):

```
$ qa-core-review init --ci github --pre-commit
Wrote .github/workflows/qa-core-review.yml
Wrote .pre-commit-config.yaml
```

Three rules hold for every target:

- `init` never changes a pipeline file that is already there. It prints the template, and you copy the part you need.
- A second run does nothing: it says that the file is up to date, or that it already runs qa-core-review.
- No template holds a secret or asks for one. The review is static and makes no network calls.

## What every CI template does

1. It fetches the git history, so that the tool can compare the branch with its base (`--diff`).
2. It runs `npx --yes qa-core-review@<version> review --diff <base> --format pretty,json,sarif,markdown,junit --fail-on error`. The GitHub template uses the action of this repo, which runs the same review and takes the gate as its `fail-on` input.
3. It hands the findings to the CI system in the form that system shows natively: a pull request comment, a test report, or an artifact.
4. It fails the job when a finding is an error. Change `--fail-on` to `warn`, `info` or `never` if you want another gate.

The report files are in `.qa-core/review/`: `report.json`, `report.sarif`, `report.md` and `report.junit.xml`.

Node 22.6 or later is needed where the tool runs. The templates use the `node:22` image or the Node setup task of the CI system. The project itself can be in any language.

## GitHub Actions

File: `.github/workflows/qa-core-review.yml`

1. In the root of your repo, run `qa-core-review init --ci github`. Expected output: `Wrote .github/workflows/qa-core-review.yml`.
2. Commit the file and push it on a branch.
3. Open a pull request that changes a test file.
4. The job "Test review" runs. It posts one comment on the pull request and updates that comment on every push. The same report is on the summary page of the job.
5. Optional, for code scanning: in the file, set `sarif: true` and add `security-events: write` under `permissions`.

The workflow uses the GitHub Action of this repo, `sprintsynergyio/qa-core-review`.

`--force` replaces a `.github/workflows/qa-core-review.yml` that is already there with the template. This is the only CI file that `--force` touches, because it is the only one that belongs to this tool alone.

## GitLab CI

File: `.gitlab-ci.yml`, job `qa-core-review`

1. Run `qa-core-review init --ci gitlab`.
   - With no `.gitlab-ci.yml`: the file is written. Expected output: `Wrote .gitlab-ci.yml`.
   - With a `.gitlab-ci.yml`: the template is printed. Copy the `qa-core-review:` job into your file.
2. Commit and push, then open a merge request that changes a test file.
3. The job runs in the merge request pipeline. It compares with `$CI_MERGE_REQUEST_DIFF_BASE_SHA`, the commit where the branch left its target.
4. The findings show up in the test report widget of the merge request (`artifacts:reports:junit`). `report.md` and the other files are artifacts of the job.

The job has `rules` for merge request pipelines only. If your other jobs run in branch pipelines, read "Merge request pipelines" in the GitLab docs on how to avoid running both for one push.

## Azure Pipelines

File: `azure-pipelines.yml`

1. Run `qa-core-review init --ci azure`.
   - With no `azure-pipelines.yml`: the file is written. Expected output: `Wrote azure-pipelines.yml`.
   - With an `azure-pipelines.yml`: the template is printed. Copy its `steps` into your pipeline, and set `fetchDepth: 0` on your checkout step.
2. Commit and push.
3. For a repo in Azure Repos: open Project settings, Repositories, your repo, Policies, the target branch, and add a build validation policy that names this pipeline. Without it a pull request does not start the pipeline. For a repo on GitHub the `pr:` block of the file is enough.
4. Open a pull request that changes a test file.
5. The findings are on the Tests tab of the run (`PublishTestResults@2`). `report.sarif` is published as the artifact `CodeAnalysisLogs`. With the extension "SARIF SAST Scans Tab" installed, the run gets a Scans tab that shows it.

The review step removes `refs/heads/` from the name of the target branch. Azure Repos gives the full ref (`refs/heads/main`), GitHub gives the short name (`main`), and `--diff` needs `origin/main` in both cases.

## Jenkins

File: `Jenkinsfile`, stage `qa-core-review`

1. Run `qa-core-review init --ci jenkins`.
   - With no `Jenkinsfile`: the file is written. Expected output: `Wrote Jenkinsfile`.
   - With a `Jenkinsfile`: the template is printed. Copy the `qa-core-review` stage into your pipeline.
2. Use a multibranch pipeline job. Jenkins sets `CHANGE_TARGET`, the target branch of a pull request, only there. The stage has `when { changeRequest() }`, so it is skipped on plain branch builds.
3. The stage needs Node 22.6 or later. The template uses the `node:22` Docker image, which needs the Docker Pipeline plugin. On an agent that has Node, replace the `agent` line with your own.
4. Commit, push and open a pull request that changes a test file.
5. The findings show up as test results of the build (`junit` step), and the report files are archived.
6. Optional: with the Warnings Next Generation plugin installed, remove the `//` in front of the `recordIssues` line to show the SARIF report as issues.

## Bitbucket Pipelines

File: `bitbucket-pipelines.yml`

1. Run `qa-core-review init --ci bitbucket`.
   - With no `bitbucket-pipelines.yml`: the file is written. Expected output: `Wrote bitbucket-pipelines.yml`.
   - With a `bitbucket-pipelines.yml`: the template is printed. Copy the `qa-core-review` step into the `pull-requests` section of your file.
2. Commit, push and open a pull request that changes a test file.
3. The step fetches the destination branch and reviews what the pull request changes against `origin/$BITBUCKET_PR_DESTINATION_BRANCH`.
4. The step copies the JUnit report to `test-results/`. Bitbucket scans that folder by itself and shows the findings on the Tests tab of the pipeline. The other report files are artifacts of the step.

## Without Node: the Docker image

Where you cannot or do not want to install Node, run the same review from the Docker image. Replace the `npx` line of a template with:

```
docker run --rm -v "$PWD:/src" ghcr.io/sprintsynergyio/qa-core-review:<version> review --diff origin/main --format pretty,json,sarif,markdown,junit --fail-on error
```

The image is published with each release.

## The pre-commit framework

For teams that use [pre-commit](https://pre-commit.com). The hook reviews the files of the commit and stops the commit when a finding is an error.

1. Run `qa-core-review init --pre-commit`.
   - With no `.pre-commit-config.yaml`: the file is written. Expected output: `Wrote .pre-commit-config.yaml`.
   - With a config whose `repos:` list is the last block of the file: the hook is added at the end. Expected output: `Added the qa-core-review hook to .pre-commit-config.yaml`. Nothing else in the file changes.
   - With any other config: the file is left alone and the lines to add are printed.
2. Run `pre-commit install` once, if the repo does not have the git hook yet.
3. Commit a change to a test file. pre-commit passes the changed files to the tool. Files that are not test files are skipped, so the hook is safe on every text file.

The lines that `init` adds:

```yaml
  - repo: https://github.com/sprintsynergyio/qa-core-review
    rev: v<version>
    hooks:
      - id: qa-core-review
```

Two hooks exist. Use one of them:

| Hook id | Runs with | Use it when |
| --- | --- | --- |
| `qa-core-review` | Node, which pre-commit sets up | The default. |
| `qa-core-review-docker` | The Docker image | The machine has Docker and you do not want pre-commit to manage a Node environment. |

Both run `review --fail-on error` on the files of the commit. To pass another flag, use `args` in your config, for example `args: [--fail-on, warn]`.

## Husky

1. Install the tool in the project: `npm i -D qa-core-review`.
2. Add this line to `.husky/pre-commit`:

```
npx qa-core-review --staged --fail-on error
```

`--staged` reviews only the tests whose lines are staged for the commit. The full script is in `templates/precommit/husky-pre-commit` of the package.

## Lefthook

1. Install the tool in the project: `npm i -D qa-core-review`.
2. Add this to `lefthook.yml`. If the file already has a `pre-commit` block, add only the `qa-core-review` command to its `commands`:

```yaml
pre-commit:
  commands:
    qa-core-review:
      run: npx qa-core-review --staged --fail-on error
```

3. Run `lefthook install`.

## Versions in the templates

Every template names one version of the tool: `qa-core-review@<version>` for npx, `:<version>` for the Docker image, and `@v<version>` or `rev: v<version>` for the action and the hook. It is always the version of the package the template came from, so `init` from version 0.1.0 writes files that run 0.1.0. To move to a newer version later, change that number, or run `init` again from the newer version in a folder where the file does not exist yet.

The facts about each CI system on this page were checked against its docs on 2026-11-28.
