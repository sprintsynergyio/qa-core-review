// Config loading (src/config): discovery, JSON and YAML, defaults, and errors with JSON pointers.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import {
  CONFIG_FILE_NAMES, ConfigError, FRAMEWORK_IDS, LANGUAGE_IDS, SUPPORTED_KEYWORDS, defaultConfigFile, findConfigFile,
  loadConfig, parseYaml, resolveConfig, validateSchema,
} from '../dist/index.js';
import { readJson, repoRoot } from './helpers/schema.mjs';

const schema = readJson('schemas', 'config.schema.json');

/** A temp project folder holding the given files (path -> text). Removed after the test. */
function project(t, files = {}) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'qcr-config-')));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
  return dir;
}

/** The ConfigError that fn throws. */
function configError(fn) {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof ConfigError, `expected a ConfigError, got ${error}`);
    return error;
  }
  assert.fail('expected a ConfigError, but nothing was thrown');
}

test('with no config file the defaults of SPEC.md Section 12.2 apply', (t) => {
  const loaded = loadConfig({ root: project(t) });
  assert.equal(loaded.file, null);
  assert.deepEqual(loaded.warnings, []);
  assert.equal(loaded.config.failOn, 'error');
  assert.equal(loaded.config.include, null);
  assert.equal(loaded.config.testIdAttribute, 'data-testid');
  assert.deepEqual(loaded.config.rules['QCR-W001'], { enabled: true, severity: 'warn', options: { maxMs: 0 } });
  assert.deepEqual(loaded.config.rules['QCR-M001'], { enabled: true, options: { subjectMap: {} } });
  assert.deepEqual(loaded.config.llm.mode, 'off');
  assert.deepEqual(loaded.config.output, { dir: '.qa-core/review', formats: ['pretty'] });
});

test('the default config equals the JSON block in SPEC.md Section 12.2 and is valid against the schema', () => {
  const spec = fs.readFileSync(path.join(repoRoot, 'SPEC.md'), 'utf8');
  const block = spec.slice(spec.indexOf('### 12.2 Schema with defaults')).match(/```json\n([\s\S]*?)\n```/)[1];
  const fromSpec = JSON.parse(block);
  assert.equal(fromSpec.$schema, schema.$id);
  delete fromSpec.$schema;
  assert.deepEqual(defaultConfigFile(), fromSpec);
  assert.deepEqual(validateSchema({ $schema: schema.$id, ...defaultConfigFile() }, schema), []);
});

test('the language and framework lists in the config schema match the model', () => {
  assert.deepEqual(schema.$defs.LanguageId.enum, [...LANGUAGE_IDS]);
  assert.deepEqual(schema.$defs.FrameworkId.enum, FRAMEWORK_IDS.filter((id) => id !== 'unknown'));
});

test('config files are found in the documented order, and package.json comes last', (t) => {
  assert.deepEqual([...CONFIG_FILE_NAMES], ['qa-core-review.config.json', 'qa-core-review.config.yaml', 'qa-core-review.config.yml', '.qa-core-review.json', '.qa-core-review.yaml']);
  const files = Object.fromEntries(CONFIG_FILE_NAMES.map((name) => [name, name.endsWith('.json') ? '{}' : 'failOn: warn\n']));
  files['package.json'] = JSON.stringify({ name: 'x', 'qa-core-review': { failOn: 'never' } });
  const dir = project(t, files);
  for (const name of CONFIG_FILE_NAMES) {
    assert.equal(findConfigFile(dir), path.join(dir, name));
    fs.unlinkSync(path.join(dir, name));
  }
  assert.equal(findConfigFile(dir), path.join(dir, 'package.json'));
  assert.equal(loadConfig({ root: dir }).config.failOn, 'never');
});

test('a package.json without the key, or one that cannot be read, is not a config', (t) => {
  assert.equal(findConfigFile(project(t, { 'package.json': '{ "name": "x" }' })), null);
  assert.equal(findConfigFile(project(t, { 'package.json': '{ not json' })), null);
});

test('the search goes from the root upward to the git root, and never above it', (t) => {
  const dir = project(t, {
    'qa-core-review.config.json': '{ "failOn": "never" }',
    'repo/.git/HEAD': 'ref: refs/heads/main\n',
    'repo/.qa-core-review.yaml': 'failOn: warn\n',
    'repo/apps/web/src/a.test.ts': '',
    'repo/apps/api/qa-core-review.config.yml': 'failOn: info\n',
    'repo/apps/api/tests/a.py': '',
  });
  const repo = path.join(dir, 'repo');
  assert.equal(loadConfig({ root: path.join(repo, 'apps', 'web', 'src') }).config.failOn, 'warn');
  assert.equal(loadConfig({ root: path.join(repo, 'apps', 'api', 'tests') }).config.failOn, 'info');
  assert.equal(loadConfig({ root: repo }).file, path.join(repo, '.qa-core-review.yaml'));

  // Remove the config inside the repo: the one above the git root must not be picked up.
  fs.unlinkSync(path.join(repo, '.qa-core-review.yaml'));
  assert.equal(loadConfig({ root: path.join(repo, 'apps', 'web') }).file, null);
});

test('outside a git repo only the root folder itself is searched', (t) => {
  const dir = project(t, { 'qa-core-review.config.json': '{ "failOn": "never" }', 'sub/a.test.ts': '' });
  assert.equal(loadConfig({ root: dir }).config.failOn, 'never');
  assert.equal(loadConfig({ root: path.join(dir, 'sub') }).file, null);
});

test('the YAML example from the spec and the same config in JSON resolve to the same result', (t) => {
  const yaml = `failOn: error
languages: [typescript, python, java]
projects:
  - path: services/payments
    language: java
    runner: testng
    libraries: [restassured]
generic:
  - glob: "modules/**/src/test/scala/**/*Spec.scala"
    language: scala
    framework: scalatest
    patterns:
      testPattern: '^\\s*(it|test)\\s*\\(\\s*"'
      assertionPattern: '\\b(assert|should|must)\\b'
      sleepPattern: 'Thread\\.sleep\\('
suppressions:
  - file: "legacy/**/*.py"
    rules: [QCR-W001]
    reason: Legacy suite, tracked for rewrite
rules:
  QCR-S001: { allowPatterns: ["^#app-root"] }
`;
  const fromYaml = loadConfig({ root: project(t, { 'qa-core-review.config.yaml': yaml }) }).config;
  const fromJson = loadConfig({ root: project(t, { 'qa-core-review.config.json': JSON.stringify(parseYaml(yaml)) }) }).config;
  assert.deepEqual(fromYaml, fromJson);
  assert.deepEqual(fromYaml.languages, ['typescript', 'python', 'java']);
  assert.deepEqual(fromYaml.projects, [{ path: 'services/payments', language: 'java', runner: 'testng', libraries: ['restassured'] }]);
  assert.equal(fromYaml.generic[0].patterns.sleepPattern, 'Thread\\.sleep\\(');
  assert.deepEqual(fromYaml.rules['QCR-S001'], { enabled: true, severity: 'warn', options: { allowPatterns: ['^#app-root'] } });
});

test('lists and plain values replace the default, and sections, rules and adapters merge key by key', () => {
  const { config } = resolveConfig({
    $schema: schema.$id,
    exclude: ['legacy/**'],
    include: ['qa/**/*.ts'],
    llm: { mode: 'anthropic', maxFilesPerRun: 5 },
    ui: { open: false },
    output: { formats: ['json', 'sarif'] },
    adapters: { java: { testSourceDirs: ['src/it/java'] } },
    rules: {
      'QCR-W001': { maxMs: 250, languages: ['python'] },
      'QCR-S001': 'error',
      'QCR-N001': 'off',
      'QCR-A001': { severity: 'warn' },
    },
  });
  assert.deepEqual(config.exclude, ['legacy/**']);
  assert.deepEqual(config.include, ['qa/**/*.ts']);
  assert.deepEqual(config.llm, { ...defaultConfigFile().llm, mode: 'anthropic', maxFilesPerRun: 5 });
  assert.deepEqual(config.ui, { port: 0, open: false });
  assert.deepEqual(config.output, { dir: '.qa-core/review', formats: ['json', 'sarif'] });
  assert.deepEqual(config.adapters, { js: {}, python: {}, java: { testSourceDirs: ['src/it/java'] } });
  assert.deepEqual(config.rules['QCR-W001'], { enabled: true, severity: 'warn', languages: ['python'], options: { maxMs: 250 } });
  assert.deepEqual(config.rules['QCR-S001'], { enabled: true, severity: 'error', options: { allowPatterns: [] } });
  assert.deepEqual(config.rules['QCR-N001'], { enabled: false, severity: 'info', options: {} });
  assert.deepEqual(config.rules['QCR-A001'], { enabled: true, severity: 'warn', options: {} });
  assert.equal('$schema' in config, false);
  // The defaults object is fresh on every call, so one run cannot change the next.
  assert.deepEqual(resolveConfig({}).config.llm.mode, 'off');
});

test('an unknown rule id is a warning, not an error, when the rule list is known', () => {
  const raw = { rules: { 'QCR-W001': 'off', 'QCR-Z999': 'error' } };
  const known = resolveConfig(raw, 'qa-core-review.config.json', ['QCR-W001', 'QCR-A001']);
  assert.deepEqual(known.warnings, ['qa-core-review.config.json: unknown rule id "QCR-Z999" under "rules" is ignored']);
  assert.deepEqual(resolveConfig(raw).warnings, []);
});

test('invalid values fail with the file, the JSON pointer of each value and a plain message', (t) => {
  const dir = project(t, {
    'qa-core-review.config.json': JSON.stringify({
      failOn: 'fatal',
      include: 'tests/**',
      languages: [],
      framework: 'karma',
      rules: { 'QCR-W001': { severity: 'loud', maxMs: 5 }, 'QCR-S001': 5 },
      llm: { apiKey: 'not-a-real-key', maxFilesPerRun: 0, redact: 'yes' },
      projects: [{ language: 'cobol' }],
      suppressions: [{ file: 'a/**', rules: [] }],
      ui: { port: 70000 },
      adapters: { js: 'on' },
      'a/b~c': 1,
    }),
  });
  const error = configError(() => loadConfig({ root: dir }));
  assert.equal(error.file, 'qa-core-review.config.json');
  assert.deepEqual(error.problems.map((problem) => `${problem.pointer}: ${problem.message}`), [
    '/failOn: must be one of "error", "warn", "info", "never"',
    '/include: must be null (use the default globs of every detected adapter) or a list of globs that replaces them all',
    '/languages: must be "auto" or a list of languages to review',
    '/framework: must be "auto" or one runner to force for every reviewed file',
    '/rules/QCR-W001/severity: must be one of "error", "warn", "info"',
    '/rules/QCR-S001: must be "off", a severity ("error", "warn", "info"), or an object with rule options',
    '/llm/apiKey: unknown key "apiKey"',
    '/llm/maxFilesPerRun: must be at least 1',
    '/llm/redact: must be true or false',
    '/projects/0: is missing the required key "path"',
    `/projects/0/language: must be one of ${LANGUAGE_IDS.map((id) => `"${id}"`).join(', ')}`,
    '/suppressions/0: is missing the required key "reason"',
    '/suppressions/0/rules: must have at least 1 item',
    '/ui/port: must be at most 65535',
    '/adapters/js: must be an object',
    '/a~1b~0c: unknown key "a/b~c"',
  ]);
  assert.match(error.message, /^Invalid config: qa-core-review\.config\.json\n {2}\/failOn: must be one of/);
  assert.equal(error.message.split('\n').length, 17);
});

test('a config that is not an object, and a number with a fraction where a whole number is needed, are refused', () => {
  assert.deepEqual(configError(() => resolveConfig([], 'c.json')).problems, [{ pointer: '', message: 'must be an object' }]);
  assert.match(configError(() => resolveConfig(null, 'c.json')).message, /^Invalid config: c\.json\n {2}\/: must be an object$/);
  assert.deepEqual(configError(() => resolveConfig({ ui: { port: 80.5 } })).problems, [{ pointer: '/ui/port', message: 'must be a whole number' }]);
  assert.deepEqual(configError(() => resolveConfig({ testIdAttribute: '' })).problems, [{ pointer: '/testIdAttribute', message: 'must not be empty' }]);
});

test('invalid JSON fails with the file and the parser message on one line', (t) => {
  const dir = project(t, { 'qa-core-review.config.json': '{\n  "failOn": "error",\n  "exclude": [,]\n}\n' });
  const error = configError(() => loadConfig({ root: dir }));
  assert.equal(error.file, 'qa-core-review.config.json');
  assert.equal(error.problems.length, 1);
  assert.equal(error.problems[0].pointer, '');
  assert.match(error.problems[0].message, /^not valid JSON: \S.*$/);
  assert.match(error.message, /^Invalid config: qa-core-review\.config\.json\n {2}\/: not valid JSON: /);
});

test('invalid YAML fails with the file, the line and the column', (t) => {
  const dir = project(t, { '.qa-core-review.yaml': 'failOn: error\nexclude: [a\nui: {\n' });
  const error = configError(() => loadConfig({ root: dir }));
  assert.equal(error.file, '.qa-core-review.yaml');
  assert.match(error.problems[0].message, /^not valid YAML: .+ at line \d+, column \d+$/);
  assert.equal(error.message.split('\n').length, 2);
  assert.throws(() => parseYaml('failOn: warn\nfailOn: info\n'), /Map keys must be unique at line 2, column 1/);
});

test('YAML custom tags are rejected, and so is a file with two documents', (t) => {
  for (const [text, tag] of [
    ['failOn: !!js/function "function () { return 1; }"\n', '!!js/function'],
    ['failOn: !danger error\n', '!danger'],
    ['testIdAttribute: !!binary aGk=\n', '!!binary'],
    ['exclude: !!set { a, b }\n', '!!set'],
    ['rules:\n  QCR-W001: !<tag:example.test,2026:rule> off\n', 'tag:example.test,2026:rule'],
  ]) {
    const error = configError(() => loadConfig({ root: project(t, { 'qa-core-review.config.yml': text }) }));
    assert.equal(error.file, 'qa-core-review.config.yml');
    assert.equal(error.problems[0].message, `not valid YAML: custom YAML tags are not allowed: ${tag}`);
  }
  assert.throws(() => parseYaml('failOn: warn\n---\nfailOn: info\n'), /more than one YAML document/);
});

test('YAML anchors, aliases, core tags, comments and an empty file are fine', (t) => {
  const yaml = '# shared list\nshared: &rules [QCR-W001, QCR-S001]\nsuppressions:\n  - { file: "legacy/**", rules: *rules, reason: Old suite }\nfailOn: !!str warn\n';
  assert.deepEqual(parseYaml(yaml), { shared: ['QCR-W001', 'QCR-S001'], suppressions: [{ file: 'legacy/**', rules: ['QCR-W001', 'QCR-S001'], reason: 'Old suite' }], failOn: 'warn' });
  assert.equal(parseYaml(''), null);
  // An empty YAML file is null, which is not a config object.
  assert.match(configError(() => loadConfig({ root: project(t, { 'qa-core-review.config.yaml': '' }) })).message, /\/: must be an object/);
  assert.equal(loadConfig({ root: project(t, { 'qa-core-review.config.yaml': '{}\n' }) }).config.failOn, 'error');
});

test('regular expressions in generic patterns are checked when the config loads', () => {
  const entry = { glob: '**/*Spec.scala', language: 'scala', patterns: { testPattern: '^\\s*it\\(', sleepPattern: 'Thread\\.sleep(' } };
  const error = configError(() => resolveConfig({ generic: [entry] }, 'c.yaml'));
  assert.equal(error.problems.length, 1);
  assert.equal(error.problems[0].pointer, '/generic/0/patterns/sleepPattern');
  assert.match(error.problems[0].message, /^not a valid regular expression: /);
});

test('an explicit config path is used as given, and a missing file or a wrong extension is an error', (t) => {
  const dir = project(t, { 'qa-core-review.config.json': '{ "failOn": "never" }', 'ci/strict.yml': 'failOn: info\n', 'ci/config.toml': '', 'ci/package.json': '{ "name": "x" }' });
  assert.equal(loadConfig({ root: dir, configPath: 'ci/strict.yml' }).config.failOn, 'info');
  assert.equal(loadConfig({ root: dir, configPath: path.join(dir, 'ci', 'strict.yml') }).file, path.join(dir, 'ci', 'strict.yml'));
  assert.equal(configError(() => loadConfig({ root: dir, configPath: 'ci/nope.json' })).message, 'Invalid config: ci/nope.json\n  /: the config file was not found or cannot be read');
  assert.equal(configError(() => loadConfig({ root: dir, configPath: 'ci/config.toml' })).problems[0].message, 'a config file must end in .json, .yaml or .yml');
  assert.match(configError(() => loadConfig({ root: dir, configPath: 'ci/package.json' })).message, /package\.json has no "qa-core-review" key/);
});

test('a config file with a byte order mark and CRLF line endings loads', (t) => {
  const bom = String.fromCharCode(0xfeff);
  assert.equal(loadConfig({ root: project(t, { 'qa-core-review.config.json': `${bom}{\r\n  "failOn": "warn"\r\n}\r\n` }) }).config.failOn, 'warn');
  assert.equal(loadConfig({ root: project(t, { 'qa-core-review.config.yaml': `${bom}failOn: warn\r\nui:\r\n  open: false\r\n` }) }).config.ui.open, false);
});

test('the built-in checker agrees with ajv on valid and invalid configs', () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  const cases = [
    {}, defaultConfigFile(), { $schema: 'x' }, { include: null }, { include: [] }, { include: ['a'] }, { include: [''] }, { include: 'a' }, { include: [1] },
    { languages: 'auto' }, { languages: ['java'] }, { languages: [] }, { languages: 'java' }, { languages: ['scala'] },
    { framework: 'auto' }, { framework: 'pytest' }, { framework: 'unknown' }, { framework: 3 },
    { projects: [{ path: 'a' }] }, { projects: [{ path: 'a', runner: 'junit5', libraries: ['selenium'], include: ['x'], exclude: [] }] }, { projects: [{}] }, { projects: [{ path: 'a', extra: 1 }] }, { projects: {} },
    { generic: [{ glob: 'a', language: 'scala' }] }, { generic: [{ glob: 'a' }] }, { generic: [{ glob: 'a', language: 'rust', patterns: { testPattern: 'x', other: 'y' } }] },
    { failOn: 'warn' }, { failOn: 'WARN' }, { failOn: null }, { testIdAttribute: 'data-test' }, { testIdAttribute: 5 }, { assertionHelpers: ['expectOk'] }, { assertionHelpers: [null] },
    { suppressions: [{ file: 'a', rules: ['QCR-W001'], reason: 'r' }] }, { suppressions: [{ file: 'a', rules: ['QCR-W001'], reason: 'r', test: 't' }] }, { suppressions: [{ file: 'a', rules: ['QCR-W001'] }] }, { suppressions: [{ file: 'a', rules: [], reason: 'r' }] },
    { rules: { 'QCR-W001': 'off' } }, { rules: { X: 'info' } }, { rules: { X: 'loud' } }, { rules: { X: { severity: 'warn', maxMs: 5, languages: ['go'] } } }, { rules: { X: { languages: [] } } }, { rules: { X: null } }, { rules: [] },
    { adapters: { js: {} } }, { adapters: { js: { any: [1] } } }, { adapters: { js: 1 } },
    { llm: { mode: 'openai', model: null } }, { llm: { model: 'm' } }, { llm: { model: '' } }, { llm: { mode: 'local' } }, { llm: { timeoutMs: 0 } }, { llm: { timeoutMs: 1.5 } }, { llm: { key: 'x' } },
    { claude: { stopGate: 'ui' } }, { claude: { stopGate: 'always' } }, { ui: { port: 0, open: false } }, { ui: { port: -1 } }, { ui: { port: 65536 } }, { ui: { port: '0' } },
    { output: { dir: 'out', formats: ['json', 'junit'] } }, { output: { formats: [] } }, { output: { formats: ['html'] } }, { output: { dir: '' } },
    { unknown: true }, [], 'x', null, 5,
  ];
  let invalid = 0;
  for (const value of cases) {
    const ours = validateSchema(value, schema).length === 0;
    assert.equal(ours, ajv(value), `the checkers disagree on ${JSON.stringify(value)}`);
    if (!ours) invalid += 1;
  }
  assert.ok(invalid > 25 && cases.length - invalid > 25, `${invalid} invalid of ${cases.length}`);
});

test('the config schema uses only the keywords the built-in checker supports', () => {
  const used = new Set();
  const walk = (node, isSchema) => {
    if (Array.isArray(node)) node.forEach((item) => walk(item, isSchema));
    else if (node && typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) {
        if (isSchema) used.add(key);
        // The keys under "properties" and "$defs" are names, not keywords. "enum", "const" and "default" hold data.
        if (['enum', 'const', 'default', 'required'].includes(key) && isSchema) continue;
        walk(value, isSchema ? !['properties', '$defs'].includes(key) : true);
      }
    }
  };
  walk(schema, true);
  assert.deepEqual([...used].filter((keyword) => !SUPPORTED_KEYWORDS.includes(keyword)), []);
});
