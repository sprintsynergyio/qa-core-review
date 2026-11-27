// CI templates and commit hooks (SPEC.md Sections 15.4, 15.5 and 18, Milestone 23): the files
// in templates/, `.pre-commit-hooks.yaml`, and `init --ci <provider>` and `init --pre-commit`
// run on dist/cli.js.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { parse } from 'yaml';
import { repoRoot } from './helpers/schema.mjs';

const cliPath = path.join(repoRoot, 'dist', 'cli.js');
const run = (args, cwd = repoRoot) => spawnSync(process.execPath, [cliPath, ...args], { cwd, encoding: 'utf8', windowsHide: true, shell: false });
const ok = (args, cwd) => {
  const result = run(args, cwd);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  return result.stdout;
};
const read = (...parts) => fs.readFileSync(path.join(repoRoot, ...parts), 'utf8');
const version = JSON.parse(read('package.json')).version;
function tempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcr-ci-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/** provider: [template, the file `init --ci` writes, what the template must hold besides the review itself]. */
const CI = {
  github: ['github.yml', '.github/workflows/qa-core-review.yml', [/fetch-depth: 0/, /pull-requests: write/, /uses: sprintsynergyio\/qa-core-review@v/, /fail-on: error/]],
  gitlab: ['gitlab.yml', '.gitlab-ci.yml', [/GIT_DEPTH: "0"/, /--diff "\$CI_MERGE_REQUEST_DIFF_BASE_SHA"/, /junit: \.qa-core\/review\/report\.junit\.xml/, /when: always/]],
  azure: ['azure.yml', 'azure-pipelines.yml', [/fetchDepth: 0/, /--diff "origin\/\$TARGET"/, /SYSTEM_PULLREQUEST_TARGETBRANCH#refs\/heads\//, /PublishTestResults@2/, /ArtifactName: CodeAnalysisLogs/, /report\.sarif/]],
  jenkins: ['Jenkinsfile', 'Jenkinsfile', [/git fetch --no-tags origin/, /--diff "origin\/\$CHANGE_TARGET"/, /junit testResults: '\.qa-core\/review\/report\.junit\.xml'/, /recordIssues\(tools: \[sarif\(pattern: '\.qa-core\/review\/report\.sarif'\)\]\)/]],
  bitbucket: ['bitbucket.yml', 'bitbucket-pipelines.yml', [/depth: full/, /--diff "origin\/\$BITBUCKET_PR_DESTINATION_BRANCH"/, /test-results\//, /after-script:/]],
};
const REVIEW = /npx --yes qa-core-review@\S+ review --diff "[^"]+" --format pretty,json,sarif,markdown,junit --fail-on error/;
const HOOKS = ['pre-commit-config.snippet.yaml', 'husky-pre-commit', 'lefthook.snippet.yml'];
const everyTemplate = () => [...Object.values(CI).map(([name]) => ['templates', 'ci', name]), ...HOOKS.map((name) => ['templates', 'precommit', name]), ['.pre-commit-hooks.yaml']];

test('every CI template is valid, fetches history, runs the review with all four report files, publishes them and fails on errors', () => {
  assert.deepEqual(fs.readdirSync(path.join(repoRoot, 'templates', 'ci')).sort(), Object.values(CI).map(([name]) => name).sort());
  for (const [provider, [name, , needs]] of Object.entries(CI)) {
    const text = read('templates', 'ci', name);
    for (const need of needs) assert.match(text, need, `${provider}: ${need}`);
    // The GitHub template runs the same review through the action, which takes the gate as an input.
    if (provider !== 'github') assert.match(text, REVIEW, provider);
    assert.match(text, /docs\/ci\.md/, `${provider}: a pointer to the docs`);
    if (name !== 'Jenkinsfile') assert.equal(typeof parse(text), 'object', `${provider}: valid YAML`);
  }
  // The shape each CI system needs, read from the parsed file.
  const yaml = (name) => parse(read('templates', 'ci', name));
  const github = yaml('github.yml');
  assert.deepEqual([github.on, github.permissions, github.jobs.review.steps.map((step) => step.uses.split('@')[0])], ['pull_request', { contents: 'read', 'pull-requests': 'write' }, ['actions/checkout', 'sprintsynergyio/qa-core-review']]);
  const gitlab = yaml('gitlab.yml')['qa-core-review'];
  assert.deepEqual([gitlab.image, gitlab.rules, gitlab.artifacts.paths, gitlab.script.length], ['node:22', [{ if: '$CI_PIPELINE_SOURCE == "merge_request_event"' }], ['.qa-core/review/'], 1]);
  const azure = yaml('azure.yml');
  assert.deepEqual(azure.steps.map((step) => step.task ?? Object.keys(step)[0]), ['checkout', 'UseNode@1', 'bash', 'PublishTestResults@2', 'PublishBuildArtifacts@1']);
  assert.deepEqual(azure.steps.slice(3).map((step) => step.condition), ['succeededOrFailed()', 'succeededOrFailed()']);
  const step = yaml('bitbucket.yml').pipelines['pull-requests']['**'][0].step;
  assert.deepEqual([step.name, step.clone, step.script.length, step.artifacts], ['qa-core-review', { depth: 'full' }, 2, ['.qa-core/review/**']]);
  // The Jenkinsfile is Groovy: the brackets pair up, and the stage has its steps and its post block.
  const jenkins = read('templates', 'ci', 'Jenkinsfile').split('\n').filter((line) => !line.trim().startsWith('//')).join('\n').replace(/'[^'\n]*'/g, "''");
  for (const [open, close] of ['{}', '()', '[]']) assert.equal(jenkins.split(open).length, jenkins.split(close).length, `Jenkinsfile: ${open}${close} pair up`);
  assert.match(jenkins, /^pipeline \{\n {2}agent \{[^\n]*\}\n {2}stages \{\n {4}stage\(''\) \{\n {6}when \{ changeRequest\(\) \}\n {6}steps \{[\s\S]*\n {6}post \{\n {8}always \{/);
});

test('no template holds a secret, another org name or another version than the one of the package', () => {
  for (const parts of everyTemplate()) {
    const name = parts.join('/');
    const text = read(...parts);
    assert.ok(!/\b(password|passwd|api[_-]?key|secret|token)\b/i.test(text.replace(/github-token|GITHUB_TOKEN/g, '')), `${name}: a word that names a secret`);
    assert.ok(!/ghp_|github_pat_|AKIA[0-9A-Z]{16}|-----BEGIN|xox[bap]-/.test(text), `${name}: something that looks like a key`);
    for (const [, org] of text.matchAll(/(?:github\.com|ghcr\.io)\/([\w-]+)\//g)) assert.equal(org, 'sprintsynergyio', name);
    for (const [, org] of text.matchAll(/uses: ([\w-]+)\/qa-core-review/g)) assert.equal(org, 'sprintsynergyio', name);
    // One placeholder for release prep to update: wherever a template names a version of this tool, it is the version of the package.
    const versions = [...text.matchAll(/qa-core-review(?:@v?|:)(\d[\w.-]*)|rev: v(\d[\w.-]*)/g)].map((match) => match[1] ?? match[2]);
    assert.ok(versions.every((found) => found === version), `${name}: names version ${versions.join(', ')}, the package is ${version}`);
    assert.ok(!text.includes('\r') && !text.includes('\t') && text.endsWith('\n'), `${name}: LF line endings, no tabs`);
  }
  // Every file that pins the tool names a version, so none is missed at release prep.
  const pinned = everyTemplate().filter((parts) => /qa-core-review(?:@v?|:)\d|rev: v\d/.test(read(...parts))).map((parts) => parts.at(-1));
  assert.deepEqual(pinned, ['github.yml', 'gitlab.yml', 'azure.yml', 'Jenkinsfile', 'bitbucket.yml', 'pre-commit-config.snippet.yaml', '.pre-commit-hooks.yaml']);
});

test('init --ci writes the file of each provider, and a second run changes nothing', (t) => {
  for (const [provider, [name, target]] of Object.entries(CI)) {
    const dir = tempDir(t);
    const template = read('templates', 'ci', name);
    assert.equal(ok(['init', '--ci', provider, '--root', dir]), `Wrote ${target}\n`);
    assert.equal(fs.readFileSync(path.join(dir, target), 'utf8'), template);
    // Only the CI file: no config file comes with it.
    assert.deepEqual(fs.readdirSync(dir), [target.split('/')[0]]);
    const stamp = fs.statSync(path.join(dir, target)).mtimeMs;
    assert.equal(ok(['init', '--ci', provider, '--root', dir]), `${target} is already there and up to date. Nothing to do.\n`);
    assert.deepEqual([fs.readFileSync(path.join(dir, target), 'utf8'), fs.statSync(path.join(dir, target)).mtimeMs], [template, stamp]);
  }
});

test('init --ci never overwrites a file that is already there: it prints the template to copy from', (t) => {
  const parts = { github: 'job', gitlab: 'job', azure: 'steps', jenkins: 'stage', bitbucket: 'step' };
  for (const [provider, [name, target]] of Object.entries(CI)) {
    const dir = tempDir(t);
    const file = path.join(dir, target);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const mine = '# my own pipeline\nstages: [build]\n';
    fs.writeFileSync(file, mine);
    assert.equal(ok(['init', '--ci', provider, '--root', dir]), `${target} is already there, so it was not changed. Copy the qa-core-review ${parts[provider]} from this template into it:\n\n${read('templates', 'ci', name)}`);
    assert.equal(fs.readFileSync(file, 'utf8'), mine);
    // --force is for the files of this tool alone. A pipeline file of the project stays as it is.
    const forced = ok(['init', '--ci', provider, '--force', '--root', dir]);
    if (provider === 'github') assert.deepEqual([forced, fs.readFileSync(file, 'utf8')], [`Wrote ${target}\n`, read('templates', 'ci', name)]);
    else assert.deepEqual([forced.split('\n')[0], fs.readFileSync(file, 'utf8')], [`${target} is already there, so it was not changed. Copy the qa-core-review ${parts[provider]} from this template into it:`, mine]);
  }
  // A pipeline that already runs the tool, pasted in by hand or with CRLF line endings: nothing to do, and nothing is printed again.
  const dir = tempDir(t);
  fs.writeFileSync(path.join(dir, '.gitlab-ci.yml'), 'build:\n  script: [make]\nqa-core-review:\n  script: [npx qa-core-review]\n');
  assert.equal(ok(['init', '--ci', 'gitlab', '--root', dir]), '.gitlab-ci.yml already runs qa-core-review. Nothing to do.\n');
  fs.writeFileSync(path.join(dir, 'Jenkinsfile'), read('templates', 'ci', 'Jenkinsfile').replace(/\n/g, '\r\n'));
  assert.equal(ok(['init', '--ci', 'jenkins', '--root', dir]), 'Jenkinsfile is already there and up to date. Nothing to do.\n');
  fs.mkdirSync(path.join(dir, '.github', 'workflows'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.github', 'workflows', 'qa-core-review.yml'), 'name: mine\n# runs qa-core-review my way\n');
  assert.equal(ok(['init', '--ci', 'github', '--root', dir]), '.github/workflows/qa-core-review.yml already runs qa-core-review. Nothing to do. Use --force to replace it with the template.\n');
  assert.equal(ok(['init', '--ci', 'github', '--force', '--root', dir]), 'Wrote .github/workflows/qa-core-review.yml\n');
  assert.equal(ok(['init', '--ci', 'github', '--force', '--root', dir]), '.github/workflows/qa-core-review.yml is already there and up to date. Nothing to do.\n');
});

test('init: the targets can be combined, a wrong provider is a usage error, and the agent targets are still to come', (t) => {
  const dir = tempDir(t);
  assert.equal(ok(['init', '--config', 'yaml', '--ci', 'bitbucket', '--pre-commit'], dir), 'Wrote qa-core-review.config.yaml\nWrote bitbucket-pipelines.yml\nWrote .pre-commit-config.yaml\n');
  assert.deepEqual(fs.readdirSync(dir).sort(), ['.pre-commit-config.yaml', 'bitbucket-pipelines.yml', 'qa-core-review.config.yaml']);
  const usageError = (args, message) => {
    const result = run(args, dir);
    assert.deepEqual([result.status, result.stdout], [2, '']);
    assert.match(result.stderr, message);
  };
  usageError(['init', '--ci', 'circle'], /--ci must be github, gitlab, azure, jenkins or bitbucket, not "circle"/);
  usageError(['init', '--ci'], /--ci/);
  usageError(['init', '--cursor'], /init --cursor is not available yet/);
  const help = ok(['init', '--help']);
  for (const flag of ['--config [json|yaml]', '--ci <provider>', '--pre-commit', '--force', '--root <dir>']) assert.ok(help.includes(flag), flag);
  assert.match(ok(['--help']), /qa-core-review init \[flags\]\s+Write a config file, a CI file or a pre-commit hook entry\./);
});

test('init --pre-commit adds the hook to .pre-commit-config.yaml and keeps what is there', async (t) => {
  const snippet = read('templates', 'precommit', 'pre-commit-config.snippet.yaml');
  const hook = { repo: 'https://github.com/sprintsynergyio/qa-core-review', rev: `v${version}`, hooks: [{ id: 'qa-core-review' }] };
  assert.deepEqual(parse(`repos:\n${snippet}`), { repos: [hook] });
  const dir = tempDir(t);
  const file = path.join(dir, '.pre-commit-config.yaml');
  const init = () => ok(['init', '--pre-commit', '--root', dir]);

  // No config yet: it is written. A second run is a no-op.
  assert.equal(init(), 'Wrote .pre-commit-config.yaml\n');
  assert.equal(fs.readFileSync(file, 'utf8'), `repos:\n${snippet}`);
  assert.equal(init(), '.pre-commit-config.yaml already has the qa-core-review hook. Nothing to do.\n');
  assert.equal(fs.readFileSync(file, 'utf8'), `repos:\n${snippet}`);
  assert.deepEqual(fs.readdirSync(dir), ['.pre-commit-config.yaml']);

  // A config with `repos:` as its last block: the hook goes at the end, in the indent of the file, and every old line stays.
  const other = { repo: 'https://github.com/pre-commit/pre-commit-hooks', rev: 'v5.0.0', hooks: [{ id: 'end-of-file-fixer' }, { id: 'check-yaml', args: ['--unsafe'] }] };
  const flush = '# checks before a commit\ndefault_stages: [pre-commit]\nrepos:\n- repo: https://github.com/pre-commit/pre-commit-hooks\n  rev: v5.0.0\n  hooks:\n  - id: end-of-file-fixer\n  - id: check-yaml\n    args: [--unsafe]\n';
  const indented = 'repos:\n    # the usual ones\n    - repo: https://github.com/pre-commit/pre-commit-hooks\n      rev: v5.0.0\n      hooks:\n          - id: end-of-file-fixer\n          - id: check-yaml\n            args: [--unsafe]\n\n\n';
  for (const [before, indent] of [[flush, ''], [indented, '    '], [flush.replace(/\n/g, '\r\n'), '']]) {
    fs.writeFileSync(file, before);
    assert.equal(init(), 'Added the qa-core-review hook to .pre-commit-config.yaml\n');
    const after = fs.readFileSync(file, 'utf8');
    const eol = before.includes('\r\n') ? '\r\n' : '\n';
    assert.equal(after, `${before.trimEnd()}${eol}${indent}- repo: https://github.com/sprintsynergyio/qa-core-review${eol}${indent}  rev: v${version}${eol}${indent}  hooks:${eol}${indent}    - id: qa-core-review${eol}`);
    assert.deepEqual(parse(after).repos, [other, hook]);
    assert.equal(init(), '.pre-commit-config.yaml already has the qa-core-review hook. Nothing to do.\n');
    assert.equal(fs.readFileSync(file, 'utf8'), after);
  }
  // `repos:` with nothing under it yet.
  fs.writeFileSync(file, 'fail_fast: true\nrepos:\n');
  assert.equal(init(), 'Added the qa-core-review hook to .pre-commit-config.yaml\n');
  assert.deepEqual(parse(fs.readFileSync(file, 'utf8')), { fail_fast: true, repos: [hook] });

  // A list that ends inside a block of text: the new lines are less indented, so they end the block and join the list.
  fs.writeFileSync(file, 'repos:\n- repo: local\n  hooks:\n  - id: note\n    name: note\n    language: system\n    entry: |\n      echo done\n');
  assert.equal(init(), 'Added the qa-core-review hook to .pre-commit-config.yaml\n');
  assert.deepEqual(parse(fs.readFileSync(file, 'utf8')).repos, [{ repo: 'local', hooks: [{ id: 'note', name: 'note', language: 'system', entry: 'echo done\n' }] }, hook]);

  // Anything else is left alone, and the lines to add are printed: a key after the list, a list written
  // in brackets, no list at all, a file that is a list, a file that is not YAML, and an empty file.
  const unsafe = ['repos:\n- repo: local\n  hooks: []\nfail_fast: true\n', 'repos: []\n', 'fail_fast: true\n', '- just\n- a list\n', 'repos: [\n', ''];
  for (const before of unsafe) {
    fs.writeFileSync(file, before);
    assert.equal(init(), `.pre-commit-config.yaml was not changed, because the hook cannot be added to it safely. Add these lines under "repos:" yourself:\n\n${snippet}`, JSON.stringify(before));
    assert.equal(fs.readFileSync(file, 'utf8'), before);
  }
  const { withPreCommitHook } = await import('../dist/commands/init.js');
  assert.equal(withPreCommitHook('repos:\n- repo: local\n  hooks: []\n', '  - repo: https://example.test/other\n    rev: v1\n    hooks:\n      - id: other\n'), null);
});

test('.pre-commit-hooks.yaml has the two hooks of Section 15.4, and the Husky and Lefthook files review what is staged', () => {
  const [node, docker, ...rest] = parse(read('.pre-commit-hooks.yaml'));
  assert.deepEqual(rest, []);
  const { description: nodeDescription, ...nodeHook } = node;
  assert.deepEqual(nodeHook, {
    id: 'qa-core-review', name: 'qa-core-review (test quality)', entry: 'qa-core-review review --fail-on error', language: 'node', additional_dependencies: [],
    pass_filenames: true, require_serial: true, types: ['text'], minimum_pre_commit_version: '3.0.0',
  });
  const { description: dockerDescription, ...dockerHook } = docker;
  assert.deepEqual(dockerHook, {
    id: 'qa-core-review-docker', name: 'qa-core-review (test quality, Docker)', entry: `ghcr.io/sprintsynergyio/qa-core-review:${version} review --fail-on error`, language: 'docker_image',
    pass_filenames: true, require_serial: true, types: ['text'],
  });
  assert.ok(nodeDescription.length > 20 && dockerDescription.length > 20);
  // The node hook installs this package from git, so its entry must be the bin of the package.
  const pkg = JSON.parse(read('package.json'));
  assert.deepEqual([Object.keys(pkg.bin), pkg.scripts.prepack], [[node.entry.split(' ')[0]], 'npm run build']);

  const husky = read('templates', 'precommit', 'husky-pre-commit').split('\n').filter((line) => line !== '' && !line.startsWith('#'));
  assert.deepEqual(husky, ['npx qa-core-review --staged --fail-on error']);
  assert.deepEqual(parse(read('templates', 'precommit', 'lefthook.snippet.yml')), { 'pre-commit': { commands: { 'qa-core-review': { run: 'npx qa-core-review --staged --fail-on error' } } } });
});

test('the entry of the node pre-commit hook, given a list of mixed files, reviews only the test files', (t) => {
  const dir = tempDir(t);
  const files = {
    'package.json': '{ "devDependencies": { "vitest": "^2.1.0" } }\n', 'requirements.txt': 'pytest==8.3.4\n',
    'tests/sum.test.ts': "import { expect, it } from 'vitest';\n\nit('adds', () => {\n  add(1, 2);\n});\n",
    'tests/test_cart.py': 'from shop.cart import Cart\n\n\ndef test_total():\n    assert Cart().total() == 0\n',
    'docs/notes.md': '# Notes\n\nNothing to test here.\n', 'src/sum.ts': 'export const add = (a: number, b: number): number => a + b;\n',
  };
  for (const [name, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), text);
  }
  fs.writeFileSync(path.join(dir, 'docs', 'logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff]));
  // pre-commit runs `<entry> <files...>` in the root of the repo. The entry names the bin, which is dist/cli.js.
  const [bin, ...args] = parse(read('.pre-commit-hooks.yaml'))[0].entry.split(' ');
  assert.equal(bin, 'qa-core-review');
  const staged = ['tests/sum.test.ts', 'tests/test_cart.py', 'docs/notes.md', 'docs/logo.png', 'src/sum.ts', 'package.json'];
  const result = run([...args, ...staged], dir);
  // The TypeScript test has no assertion, so the hook stops the commit.
  assert.equal(result.status, 1, result.stderr);
  const report = JSON.parse(fs.readFileSync(path.join(dir, '.qa-core', 'review', 'report.json'), 'utf8'));
  // The Markdown file, the image and package.json are skipped without a word. A source file in a language an adapter
  // knows is read (SPEC.md Section 11.1), has no tests and so gives nothing.
  assert.deepEqual(report.files.map((file) => [file.file, file.language, file.tests.length]), [['src/sum.ts', 'typescript', 0], ['tests/sum.test.ts', 'typescript', 1], ['tests/test_cart.py', 'python', 1]]);
  assert.deepEqual(report.findings.map((finding) => [finding.ruleId, finding.location.file]), [['QCR-A001', 'tests/sum.test.ts']]);
  assert.equal(report.summary.tests, 2);
  assert.ok(!/notes\.md|logo\.png|src\/sum\.ts|package\.json/.test(result.stdout + result.stderr));
  // With only files that are not tests, and with a clean test, the hook lets the commit through.
  assert.equal(run([...args, 'docs/notes.md', 'docs/logo.png'], dir).status, 0);
  assert.equal(run([...args, 'tests/test_cart.py', 'docs/notes.md'], dir).status, 0);
});

test('docs/ci.md has numbered steps for every provider and every hook, and shows the lines init adds', () => {
  const docs = read('docs', 'ci.md');
  for (const heading of ['## GitHub Actions', '## GitLab CI', '## Azure Pipelines', '## Jenkins', '## Bitbucket Pipelines', '## The pre-commit framework', '## Husky', '## Lefthook']) {
    const section = docs.split(`${heading}\n`)[1]?.split('\n## ')[0];
    assert.ok(section, heading);
    assert.match(section, /^1\. /m, `${heading}: numbered steps`);
    assert.match(section, /^2\. /m, `${heading}: numbered steps`);
  }
  for (const [provider, [, target]] of Object.entries(CI)) assert.ok(docs.includes(`init --ci ${provider}`) && docs.includes(`\`${target}\``), provider);
  assert.ok(docs.includes(read('templates', 'precommit', 'pre-commit-config.snippet.yaml').replace(`v${version}`, 'v<version>')));
  assert.ok(docs.includes('npx qa-core-review --staged --fail-on error'));
});
