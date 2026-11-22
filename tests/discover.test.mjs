// File discovery (src/discover/files.ts): the file list, include and exclude, languages, generic files.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { ROOT_DIR, applyOverrides, builtinProfiles, discover, languageHintFor, listFiles, nearestOverride, nearestProject, resolveConfig } from '../dist/index.js';
import { repoRoot } from './helpers/schema.mjs';

/** A temp folder holding the given files (path -> text). Removed after the test. */
function project(t, files) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'qcr-discover-')));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
  return dir;
}
const config = (raw = {}) => resolveConfig(raw).config;
const paths = (found) => found.files.map((file) => file.path);

test('the directory walk skips the default excludes and .git, and gives sorted / paths', (t) => {
  const dir = project(t, {
    'src/b.test.ts': '', 'src/a.test.ts': '', 'node_modules/pkg/index.test.js': '', 'web/dist/a.test.js': '', 'api/target/classes/ATest.java': '',
    '.venv/lib/test_x.py': '', 'pkg/__pycache__/test_x.py': '', '.git/HEAD': '', '.qa-core/review/report.json': '', 'types/a.d.ts': '', 'README.md': '',
  });
  assert.deepEqual(listFiles(dir, { git: false }), { files: ['README.md', 'src/a.test.ts', 'src/b.test.ts'], source: 'walk' });
  assert.equal(listFiles(dir).source, 'walk');
});

test('inside a git repo the list comes from git: ignored files out, untracked files in, deleted files out', (t) => {
  const dir = project(t, { '.gitignore': 'generated/\n*.log\n', 'tests/a.test.ts': '', 'tests/gone.test.ts': '', 'tests/new.test.ts': '', 'generated/b.test.ts': '', 'run.log': '' });
  const git = (...args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8', windowsHide: true, shell: false });
  if (git('init', '-q').status !== 0) return t.skip('git is not installed');
  git('add', '.gitignore', 'tests/a.test.ts', 'tests/gone.test.ts');
  fs.unlinkSync(path.join(dir, 'tests', 'gone.test.ts'));
  assert.deepEqual(listFiles(dir), { files: ['.gitignore', 'tests/a.test.ts', 'tests/new.test.ts'], source: 'git' });
  assert.deepEqual(paths(discover(dir, config())), ['tests/a.test.ts', 'tests/new.test.ts']);
  // From a subfolder, paths are relative to that folder.
  assert.deepEqual(listFiles(path.join(dir, 'tests')).files, ['a.test.ts', 'new.test.ts']);
});

test('git and the directory walk agree on every fixture project', () => {
  for (const name of ['js-basic', 'python-basic', 'java-basic', 'monorepo-mixed', 'override']) {
    const root = path.join(repoRoot, 'fixtures', 'projects', name);
    const walked = discover(root, config(), { git: false });
    assert.equal(walked.fileSource, 'walk');
    assert.deepEqual(paths(walked), paths(discover(root, config())), name);
    assert.ok(walked.files.length > 0, name);
  }
});

const MIXED = {
  'package.json': '{ "devDependencies": { "vitest": "2" } }',
  'src/cart.test.ts': '', 'src/cart.ts': '', 'src/types.d.ts': '', 'tests/setup.js': '', 'tests/vitest.config.ts': '', 'tests/notes.md': '',
  'qa/checks/login_check.py': '', 'app/test_cart.py': '', 'app/cart.py': '',
  'svc/src/test/java/CartTest.java': '', 'svc/src/main/java/Cart.java': '',
  'core/tests/cart_test.rs': '', 'core/src/cart.rs': '', 'specs/CartSpec.swift': '', 'tests/data.json': '', 'e2e/cart.zig': '',
};

test('default discovery: each adapter uses its own include globs, and generic takes known languages only', (t) => {
  const found = discover(project(t, MIXED), config());
  assert.deepEqual(found.files.map((file) => [file.path, file.adapterId, file.languageHint ?? file.language]), [
    ['app/test_cart.py', 'python', 'python'],
    ['core/tests/cart_test.rs', 'generic', 'rust'],
    ['specs/CartSpec.swift', 'generic', 'swift'],
    ['src/cart.test.ts', 'js', 'typescript'],
    ['svc/src/test/java/CartTest.java', 'java', 'java'],
    ['tests/setup.js', 'js', 'javascript'],
  ]);
  assert.equal(found.files.find((file) => file.path === 'src/cart.test.ts').project.dir, ROOT_DIR);
  assert.equal(found.files.find((file) => file.path === 'app/test_cart.py').project, null);
});

test('config include replaces every default include, and config exclude and languages narrow the result', (t) => {
  const dir = project(t, MIXED);
  assert.deepEqual(paths(discover(dir, config({ include: ['qa/**', '**/*.zig', 'src/*.ts'] }))), ['qa/checks/login_check.py', 'src/cart.test.ts', 'src/cart.ts']);
  assert.deepEqual(paths(discover(dir, config({ exclude: ['app/**', 'core/**', 'specs/**', 'tests/**'] }))), ['src/cart.test.ts', 'svc/src/test/java/CartTest.java']);
  assert.deepEqual(paths(discover(dir, config({ languages: ['python', 'java'] }))), ['app/test_cart.py', 'svc/src/test/java/CartTest.java']);
  assert.deepEqual(paths(discover(dir, config({ languages: ['javascript'] }))), ['tests/setup.js']);
  assert.deepEqual(paths(discover(dir, config({ languages: ['generic'] }))), ['core/tests/cart_test.rs', 'specs/CartSpec.swift']);
});

test('a generic config entry adds files of any unclaimed extension, with its own language hint', (t) => {
  const found = discover(project(t, MIXED), config({ generic: [{ glob: 'e2e/**/*.zig', language: 'zig' }, { glob: 'src/**', language: 'never' }] }));
  assert.deepEqual(found.files.filter((file) => file.adapterId === 'generic').map((file) => [file.path, file.languageHint]), [
    ['core/tests/cart_test.rs', 'rust'],
    ['e2e/cart.zig', 'zig'],
    ['specs/CartSpec.swift', 'swift'],
  ]);
  // A file a static adapter claims stays with that adapter, whatever a generic entry says.
  assert.equal(found.files.find((file) => file.path === 'src/cart.test.ts').adapterId, 'js');
});

test('language hints come from the extension, compound extensions included', () => {
  assert.deepEqual(['a/InvoiceSpec.scala', 'x_test.go', 'login.feature', 'api.postman_collection.json', 'Plan.JMX', 'notes.md', 'a.ts'].map(languageHintFor), ['scala', 'go', 'gherkin', 'postman', 'jmeter', null, null]);
});

test('a projects entry without a language applies to the adapter that knows its runner', (t) => {
  const dir = project(t, { 'pom.xml': '<project/>', 'package.json': '{}', 'api/src/test/java/ATest.java': '', 'api/a.test.ts': '', 'api/tests/test_a.py': '' });
  const found = discover(dir, config({ projects: [{ path: './api/', runner: 'testng', libraries: ['selenium'] }] }));
  assert.deepEqual(found.projects.map((p) => [p.dir, p.adapterId, p.frameworks, p.evidence]), [
    ['.', 'java', [], ['pom.xml']],
    ['.', 'js', [], ['package.json']],
    ['api', 'java', ['testng', 'selenium'], ['config: projects[0]']],
  ]);
  // No language was forced, so the TS and Python files under the path are still reviewed.
  assert.deepEqual(found.files.map((file) => [file.path, file.project?.dir ?? null]), [['api/a.test.ts', '.'], ['api/src/test/java/ATest.java', 'api'], ['api/tests/test_a.py', null]]);
});

test('a projects entry with only libraries, or with nothing but a path, targets the adapters that fit', () => {
  const detected = [{ dir: '.', adapterId: 'python', languages: ['python'], frameworks: ['pytest'], evidence: ['pytest.ini'] }];
  const withLibrary = applyOverrides(detected, [{ path: 'ui', libraries: ['playwright-python'] }], builtinProfiles);
  assert.deepEqual(withLibrary.map((p) => [p.dir, p.adapterId, p.frameworks]), [['.', 'python', ['pytest']], ['ui', 'python', ['playwright-python']]]);
  const pathOnly = applyOverrides(detected, [{ path: '.', include: ['checks/**'] }], builtinProfiles);
  assert.deepEqual(pathOnly, [{ dir: '.', adapterId: 'python', languages: ['python'], frameworks: ['pytest'], evidence: ['config: projects[0]', 'pytest.ini'] }]);
});

test('nearestProject and nearestOverride pick the deepest folder above a file', () => {
  const projects = ['.', 'a', 'a/b'].map((dir) => ({ dir, adapterId: 'js', languages: [], frameworks: [], evidence: [] }));
  assert.equal(nearestProject(projects, 'js', 'a/b/c/x.test.ts').dir, 'a/b');
  assert.equal(nearestProject(projects, 'js', 'a/bc/x.test.ts').dir, 'a');
  assert.equal(nearestProject(projects, 'js', 'x.test.ts').dir, '.');
  assert.equal(nearestProject(projects, 'java', 'a/X.java'), null);
  const overrides = [{ path: 'a' }, { path: 'a/b/' }, { path: 'z' }];
  assert.equal(nearestOverride(overrides, 'a/b/x.ts').path, 'a/b/');
  assert.equal(nearestOverride(overrides, 'a/x.ts').path, 'a');
  assert.equal(nearestOverride(overrides, 'y/x.ts'), null);
});
