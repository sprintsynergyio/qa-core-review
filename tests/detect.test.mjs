// Project detection (src/detect, the adapters' detect.ts) and the `detect` command.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { builtinProfiles, discover, loadConfig, resolveConfig } from '../dist/index.js';
import { repoRoot, schemaErrors } from './helpers/schema.mjs';

const cli = path.join(repoRoot, 'dist', 'cli.js');
const fixture = (name) => path.join(repoRoot, 'fixtures', 'projects', name);
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', windowsHide: true, shell: false });
const profile = (id) => builtinProfiles.find((candidate) => candidate.id === id);

/** A probe over files held in memory: { 'package.json': '...text...' }. */
function memoryProbe(files) {
  return { dir: '.', hasFile: (name) => name in files, readText: (name) => files[name] ?? null, list: (glob) => Object.keys(files).filter((name) => new RegExp(`^${glob.replace(/\./g, '\\.').replace(/\*/g, '.*')}$`).test(name)) };
}
/** [frameworks, evidence, weak] for one adapter and one set of files, or null when it is not a project. */
function detectIn(adapterId, files) {
  const project = profile(adapterId).detectProject(memoryProbe(files));
  return project && [project.frameworks, project.evidence, project.weak === true];
}
const pkg = (devDependencies, dependencies = {}) => JSON.stringify({ name: 'x', dependencies, devDependencies });
const pom = (...coordinates) => `<project><dependencies>${coordinates.map((c) => `<dependency><groupId>${c.split(':')[0]}</groupId><artifactId>${c.split(':')[1]}</artifactId></dependency>`).join('')}</dependencies></project>`;

test('JS: every runner is found from package.json dependencies', () => {
  for (const [dependency, framework] of [['@playwright/test', 'playwright'], ['cypress', 'cypress'], ['jest', 'jest'], ['vitest', 'vitest'], ['mocha', 'mocha'], ['webdriverio', 'webdriverio']]) {
    assert.deepEqual(detectIn('js', { 'package.json': pkg({ [dependency]: '1.0.0' }) }), [[framework], [`package.json: ${dependency}`], false]);
  }
  assert.deepEqual(detectIn('js', { 'package.json': pkg({}, { '@wdio/cli': '9' }) }), [['webdriverio'], ['package.json: @wdio/'], false]);
  assert.deepEqual(detectIn('js', { 'package.json': pkg({ jest: '29', '@playwright/test': '1' }) })[0], ['playwright', 'jest']);
});

test('JS: only real dependency names count, and a broken package.json declares nothing', () => {
  const noise = JSON.stringify({ name: 'x', scripts: { test: 'jest && mocha' }, keywords: ['vitest'], devDependencies: { '@types/mocha': '10', 'ts-jest': '29', 'eslint-plugin-cypress': '3' } });
  assert.deepEqual(detectIn('js', { 'package.json': noise }), [[], ['package.json'], false]);
  assert.deepEqual(detectIn('js', { 'package.json': '{ not json' }), [[], ['package.json'], false]);
});

test('JS: a runner config file is enough without dependencies, and a lone tsconfig.json is a weak project', () => {
  for (const [file, framework] of [['playwright.config.ts', 'playwright'], ['cypress.config.js', 'cypress'], ['jest.config.mjs', 'jest'], ['vitest.config.ts', 'vitest'], ['.mocharc.json', 'mocha'], ['wdio.conf.ts', 'webdriverio']]) {
    assert.deepEqual(detectIn('js', { [file]: '' }), [[framework], [file], false]);
  }
  assert.deepEqual(detectIn('js', { 'tsconfig.json': '{}' }), [[], ['tsconfig.json'], true]);
  assert.deepEqual(detectIn('js', { 'jsconfig.json': '{}', 'vitest.config.ts': '' }), [['vitest'], ['vitest.config.ts'], false]);
  assert.equal(detectIn('js', { 'README.md': 'jest' }), null);
});

test('Python: frameworks are found in every kind of manifest', () => {
  for (const [file, text] of [['pyproject.toml', 'dev = ["pytest>=8.0"]'], ['requirements-dev.txt', 'pytest==8.3.2\n'], ['setup.cfg', '[options.extras_require]\ntest = pytest\n'], ['setup.py', "tests_require=['pytest']"], ['Pipfile', '[dev-packages]\npytest = "*"\n'], ['tox.ini', '[testenv]\ndeps = pytest\n']]) {
    assert.deepEqual(detectIn('python', { [file]: text }), [['pytest'], [`${file}: pytest`], false]);
  }
  assert.deepEqual(detectIn('python', { 'requirements.txt': 'pytest-playwright==0.5\nselenium>=4\n' }), [
    ['pytest', 'playwright-python', 'selenium'],
    ['requirements.txt: pytest-playwright', 'requirements.txt: selenium'],
    false,
  ]);
  assert.deepEqual(detectIn('python', { 'pyproject.toml': '[tool.pytest.ini_options]\naddopts = "-q"\n' })[0], ['pytest']);
  assert.deepEqual(detectIn('python', { 'pytest.ini': '[pytest]\n' }), [['pytest'], ['pytest.ini'], false]);
});

test('Python: unittest is assumed with no runner, and a lone conftest.py is a weak pytest project', () => {
  const assumed = 'no test runner in the manifests: unittest assumed';
  assert.deepEqual(detectIn('python', { 'requirements.txt': 'requests\nselenium\npytestify\n' }), [['unittest', 'selenium'], [assumed, 'requirements.txt: selenium'], false]);
  assert.deepEqual(detectIn('python', { 'poetry.lock': 'name = "pytest"' }), [['unittest'], [assumed], false]);
  assert.deepEqual(detectIn('python', { 'conftest.py': 'import pytest' }), [['pytest'], ['conftest.py'], true]);
  assert.equal(detectIn('python', { 'main.py': 'import pytest' }), null);
});

test('Java: frameworks are found from Maven and Gradle coordinates', () => {
  const cases = [
    ['org.junit.jupiter:junit-jupiter', 'junit5', 'org.junit.jupiter'], ['org.springframework.boot:spring-boot-starter-test', 'junit5', 'spring-boot-starter-test'],
    ['junit:junit', 'junit4', 'junit'], ['org.testng:testng', 'testng', 'org.testng'], ['org.seleniumhq.selenium:selenium-java', 'selenium', 'org.seleniumhq.selenium'],
    ['io.rest-assured:rest-assured', 'restassured', 'io.rest-assured'], ['com.microsoft.playwright:playwright', 'playwright-java', 'com.microsoft.playwright'], ['io.cucumber:cucumber-java', 'cucumber', 'io.cucumber'],
  ];
  for (const [coordinate, framework, shown] of cases) {
    assert.deepEqual(detectIn('java', { 'pom.xml': pom(coordinate) }), [[framework], [`pom.xml: ${shown}`], false], coordinate);
    assert.deepEqual(detectIn('java', { 'build.gradle': `dependencies { testImplementation '${coordinate}:1.0' }` })[0], [framework], coordinate);
    assert.deepEqual(detectIn('java', { 'build.gradle.kts': `dependencies { testImplementation("${coordinate}:1.0") }` })[0], [framework], coordinate);
  }
});

test('Java: the JUnit 5 BOM and a version property are not JUnit 4, and a lone settings.gradle is weak', () => {
  const text = '<properties><junit.version>5.11</junit.version></properties><dependency><groupId>org.junit</groupId><artifactId>junit-bom</artifactId></dependency>';
  assert.deepEqual(detectIn('java', { 'pom.xml': text }), [[], ['pom.xml'], false]);
  assert.deepEqual(detectIn('java', { 'settings.gradle': "include 'app'" }), [[], ['settings.gradle'], true]);
  assert.equal(detectIn('java', { 'Main.java': 'class Main {}' }), null);
});

const EXPECTED = {
  'js-basic': {
    projects: [['.', 'js', ['playwright', 'jest'], ['package.json: @playwright/test', 'playwright.config.ts', 'package.json: jest'], 3]],
    adapters: [['js', 1, 3, { typescript: 3 }]],
  },
  'python-basic': {
    projects: [['.', 'python', ['pytest', 'selenium'], ['pyproject.toml: pytest', 'pyproject.toml: selenium'], 3]],
    adapters: [['python', 1, 3, { python: 3 }]],
  },
  'java-basic': {
    projects: [['.', 'java', ['junit5', 'selenium', 'restassured'], ['pom.xml: org.junit.jupiter', 'pom.xml: org.seleniumhq.selenium', 'pom.xml: io.rest-assured'], 3]],
    adapters: [['java', 1, 3, { java: 3 }]],
  },
  'monorepo-mixed': {
    projects: [
      ['.', 'js', [], ['package.json'], 0],
      ['apps/web', 'js', ['vitest'], ['package.json: vitest'], 1],
      ['services/payments', 'java', ['testng', 'restassured'], ['pom.xml: org.testng', 'pom.xml: io.rest-assured'], 1],
      ['services/payments/e2e', 'js', ['playwright'], ['package.json: @playwright/test', 'playwright.config.ts'], 1],
      ['services/reports', 'python', ['pytest'], ['pyproject.toml: pytest'], 2],
    ],
    adapters: [['js', 1, 2, { typescript: 2 }], ['python', 1, 2, { python: 2 }], ['java', 1, 1, { java: 1 }], ['generic', 3, 1, { scala: 1 }]],
  },
  override: {
    config: 'qa-core-review.config.yaml',
    projects: [
      ['.', 'js', ['jest'], ['package.json: jest'], 1],
      ['services/payments', 'java', ['testng', 'selenium', 'restassured'], ['config: projects[0]', 'pom.xml: junit', 'pom.xml: org.seleniumhq.selenium'], 2],
    ],
    adapters: [['js', 1, 1, { javascript: 1 }], ['java', 1, 2, { java: 2 }]],
  },
};

for (const [name, expected] of Object.entries(EXPECTED)) {
  test(`detect on ${name}: JSON output is valid and has the right adapters, frameworks and evidence`, () => {
    const ran = run('detect', '--root', fixture(name), '--format', 'json');
    assert.equal(ran.status, 0, ran.stderr);
    assert.equal(ran.stderr, '');
    const report = JSON.parse(ran.stdout);
    assert.deepEqual(schemaErrors('detect.schema.json', report), []);
    assert.equal(report.root, fixture(name).split(path.sep).join('/'));
    assert.equal(report.config, expected.config ?? null);
    assert.deepEqual(report.projects.map((p) => [p.dir, p.adapter, p.frameworks, p.evidence, p.testFiles]), expected.projects);
    assert.deepEqual(report.adapters.map((a) => [a.id, a.tier, a.testFiles, a.languages]), expected.adapters);
    assert.equal(report.testFiles, expected.adapters.reduce((sum, adapter) => sum + adapter[2], 0));
  });

  test(`detect on ${name}: pretty output lists every project with its frameworks and evidence`, () => {
    const ran = run('detect', '--root', fixture(name));
    assert.equal(ran.status, 0, ran.stderr);
    assert.match(ran.stdout, new RegExp(`^Root: .*${name}\\nFiles: from (git|a directory walk)`));
    assert.ok(ran.stdout.includes(`Config: ${expected.config ?? 'none (defaults)'}\n`));
    assert.ok(ran.stdout.includes(`Projects (${expected.projects.length})\n`));
    for (const [dir, adapter, frameworks, evidence, testFiles] of expected.projects) {
      const block = [`  ${dir}  [${adapter}]  ${frameworks.join(', ') || 'no framework found'}`, ...evidence.map((line) => `      ${line}`), `      ${testFiles} test file${testFiles === 1 ? '' : 's'}`];
      assert.ok(ran.stdout.includes(`${block.join('\n')}\n`), `missing block for ${dir}:\n${ran.stdout}`);
    }
    for (const [id, tier, count] of expected.adapters) assert.match(ran.stdout, new RegExp(`^  ${id}  Tier ${tier}  ${count}  `, 'm'));
  });
}

test('monorepo: each file goes to the nearest project for its language, and Scala goes to generic', () => {
  const root = fixture('monorepo-mixed');
  const found = discover(root, loadConfig({ root }).config);
  assert.deepEqual(found.files.map((file) => [file.path, file.adapterId, file.language, file.languageHint, file.project?.dir ?? null]), [
    ['apps/web/src/cart.test.ts', 'js', 'typescript', null, 'apps/web'],
    ['modules/billing/src/test/scala/billing/InvoiceSpec.scala', 'generic', 'generic', 'scala', null],
    ['services/payments/e2e/tests/checkout.spec.ts', 'js', 'typescript', null, 'services/payments/e2e'],
    ['services/payments/src/test/java/pay/PaymentTest.java', 'java', 'java', null, 'services/payments'],
    ['services/reports/tests/conftest.py', 'python', 'python', null, 'services/reports'],
    ['services/reports/tests/test_summary.py', 'python', 'python', null, 'services/reports'],
  ]);
  // The TS e2e tests inside the Java service belong to the Playwright project, not to the pom.xml.
  assert.deepEqual(found.files[2].project.frameworks, ['playwright']);
  // A conftest.py or tsconfig.json deeper in a project does not become a project of its own.
  assert.ok(!found.projects.some((project) => ['services/reports/tests', 'services/payments/e2e/tests'].includes(project.dir)));
  assert.equal(found.projects.filter((project) => project.dir === 'services/payments/e2e').length, 1);
});

test('override: the projects entry wins over detection for the files under its path', () => {
  const root = fixture('override');
  const found = discover(root, loadConfig({ root }).config);
  assert.deepEqual(found.files.map((file) => [file.path, file.adapterId, file.project.dir]), [
    ['services/payments/checks/RefundCheck.java', 'java', 'services/payments'], // added by the entry's include
    ['services/payments/src/test/java/pay/PaymentTest.java', 'java', 'services/payments'],
    ['web/cart.test.js', 'js', '.'],
  ]);
  const payments = found.projects.find((project) => project.dir === 'services/payments');
  // The pom.xml says JUnit 4. The entry says TestNG, and adds REST Assured. Selenium stays.
  assert.deepEqual(payments.frameworks, ['testng', 'selenium', 'restassured']);
  assert.deepEqual(payments.languages, ['java']);
  // Left out: the legacy folder (the entry's exclude) and the TS file (the entry forces Java).
  const paths = found.files.map((file) => file.path);
  assert.ok(!paths.some((file) => file.includes('legacy') || file.endsWith('.spec.ts')));
  // Without the config, detection alone gives JUnit 4 and reviews the legacy test and the TS file.
  const plain = discover(root, resolveConfig({}).config);
  assert.deepEqual(plain.projects.find((project) => project.dir === 'services/payments').frameworks, ['junit4', 'selenium']);
  assert.equal(plain.files.length, 4);
});

test('an invalid JSON or YAML config exits 2 with the file and the JSON pointer', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcr-detect-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const cases = [
    ['qa-core-review.config.json', '{ "failOn": "fatal", "ui": { "port": "x" } }', /^qa-core-review: Invalid config: qa-core-review\.config\.json\n {2}\/failOn: must be one of "error", "warn", "info", "never"\n {2}\/ui\/port: must be a whole number\n$/],
    ['qa-core-review.config.json', '{ "failOn": ', /^qa-core-review: Invalid config: qa-core-review\.config\.json\n {2}\/: not valid JSON: /],
    ['qa-core-review.config.yaml', 'rules:\n  QCR-W001: { severity: loud }\n', /^qa-core-review: Invalid config: qa-core-review\.config\.yaml\n {2}\/rules\/QCR-W001\/severity: must be one of/],
    ['qa-core-review.config.yaml', 'failOn: [warn\n', /^qa-core-review: Invalid config: qa-core-review\.config\.yaml\n {2}\/: not valid YAML: .* at line \d+, column \d+\n$/],
    ['qa-core-review.config.yaml', 'failOn: !!js/function "function () {}"\n', /\/: not valid YAML: custom YAML tags are not allowed: !!js\/function\n$/],
  ];
  for (const [name, text, expected] of cases) {
    fs.writeFileSync(path.join(dir, name), text);
    const ran = run('detect', '--root', dir);
    assert.equal(ran.status, 2, `${name}: ${text}`);
    assert.equal(ran.stdout, '');
    assert.match(ran.stderr, expected);
    fs.unlinkSync(path.join(dir, name));
  }
  fs.writeFileSync(path.join(dir, 'other.yml'), 'failOn: warn\n');
  assert.equal(run('detect', '--root', dir, '--config', 'other.yml', '--format', 'json').status, 0);
  const missing = run('detect', '--root', dir, '--config', 'nope.json');
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /Invalid config: nope\.json\n {2}\/: the config file was not found/);
});

test('detect: wrong usage exits 2 with one line and a pointer to --help, and --help prints the flags', () => {
  for (const [args, message] of [
    [['detect', '--format', 'xml'], 'qa-core-review: --format must be pretty or json for detect, not "xml"'],
    [['detect', '--root', path.join(repoRoot, 'no-such-folder')], 'qa-core-review: --root is not a folder: '],
    [['detect', '--root', cli], 'qa-core-review: --root is not a folder: '],
    [['detect', 'src'], 'qa-core-review: detect takes no paths (got "src"). Use --root <dir>'],
    [['detect', '--fail-on', 'warn'], "qa-core-review: Unknown option '--fail-on'"],
  ]) {
    const ran = run(...args);
    assert.equal(ran.status, 2, args.join(' '));
    assert.equal(ran.stdout, '');
    assert.ok(ran.stderr.startsWith(message), ran.stderr);
    assert.ok(ran.stderr.endsWith('\nRun qa-core-review --help\n'), ran.stderr);
  }
  const help = run('detect', '--help');
  assert.equal(help.status, 0);
  assert.match(help.stdout, /^Usage: qa-core-review detect \[flags\]/);
  for (const flag of ['--format <pretty|json>', '--root <dir>', '--config <file>']) assert.ok(help.stdout.includes(flag));
  assert.match(run('--help').stdout, /qa-core-review detect \[flags\]/);
});

test('detect works from the current folder with no flags, and on a folder with nothing to review', (t) => {
  const here = spawnSync(process.execPath, [cli, 'detect', '--format', 'json'], { cwd: fixture('js-basic'), encoding: 'utf8', windowsHide: true, shell: false });
  assert.equal(JSON.parse(here.stdout).projects[0].adapter, 'js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcr-empty-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const empty = run('detect', '--root', dir);
  assert.equal(empty.status, 0);
  assert.match(empty.stdout, /Files: from a directory walk\nConfig: none \(defaults\)\n\nProjects \(0\)\n {2}none found\n\nTest files \(0\)\n {2}none found\n$/);
});
