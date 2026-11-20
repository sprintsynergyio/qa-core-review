// The glob helper (src/util/glob.ts).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_EXCLUDE, createGlobMatcher, globToRegExp, matchGlob, toPosixPath } from '../dist/index.js';

/** Asserts which of the paths a glob matches. */
function expectMatches(glob, yes, no) {
  for (const filePath of yes) assert.equal(matchGlob(glob, filePath), true, `${glob} should match ${filePath}`);
  for (const filePath of no) assert.equal(matchGlob(glob, filePath), false, `${glob} should not match ${filePath}`);
}

test('* matches inside one path segment, including names that start with a dot', () => {
  expectMatches('*.ts', ['a.ts', '.hidden.ts', '.ts'], ['a.tsx', 'src/a.ts', 'a.ts/b']);
  expectMatches('src/*.py', ['src/test_a.py'], ['src/pkg/test_a.py', 'test_a.py']);
  expectMatches('src/*/a.js', ['src/x/a.js'], ['src/a.js', 'src/x/y/a.js']);
});

test('? matches exactly one character that is not a slash', () => {
  expectMatches('test?.py', ['test1.py', 'testA.py'], ['test.py', 'test12.py', 'test/.py']);
});

test('**/ matches zero or more folders', () => {
  expectMatches('**/test_*.py', ['test_a.py', 'tests/test_a.py', 'a/b/c/test_a.py'], ['a/btest_a.py', 'test_a.pyc']);
  expectMatches('src/**/a.ts', ['src/a.ts', 'src/x/a.ts', 'src/x/y/a.ts'], ['a.ts', 'srcx/a.ts', 'src/xa.ts']);
});

test('a trailing ** matches everything below a folder, at any depth', () => {
  expectMatches('legacy/**', ['legacy/a.py', 'legacy/x/y/a.py'], ['legacy', 'other/legacy/a.py', 'legacyx/a.py']);
  expectMatches('**/node_modules/**', ['node_modules/a/index.js', 'apps/web/node_modules/a/b.js'], ['node_modules', 'src/node_modules.js']);
  expectMatches('**', ['a', 'a/b/c.txt'], []);
});

test('{a,b} matches any alternative, and alternatives may hold patterns, be empty or nest', () => {
  expectMatches('*.{ts,tsx}', ['a.ts', 'a.tsx'], ['a.js', 'a.t']);
  expectMatches('**/*.{spec,test,cy}.{ts,js}', ['a.spec.ts', 'e2e/login.cy.js'], ['a.spec.py', 'a.unit.ts']);
  expectMatches('{tests,e2e}/**/*.ts', ['tests/a.ts', 'e2e/x/a.ts'], ['src/a.ts']);
  expectMatches('**/{cypress/e2e,specs}/**/*.js', ['cypress/e2e/a.js', 'web/specs/x/a.js'], ['cypress/a.js']);
  expectMatches('a{,b}.txt', ['a.txt', 'ab.txt'], ['abb.txt']);
  expectMatches('*.{j{s,sx},ts}', ['a.js', 'a.jsx', 'a.ts'], ['a.j', 'a.tsx']);
  expectMatches('{a/**,b}/c.txt', ['a/x/c.txt', 'b/c.txt'], ['c/c.txt']);
});

test('Windows-style input paths and a leading ./ are accepted', () => {
  expectMatches('**/src/test/java/**/*.java', ['services\\pay\\src\\test\\java\\CartTest.java', '.\\src\\test\\java\\a\\B.java'], ['src\\main\\java\\A.java']);
  expectMatches('./tests/*.ts', ['tests/a.ts', './tests/a.ts', 'tests\\a.ts'], ['src/tests/a.ts']);
  assert.equal(toPosixPath('.\\src\\\\test\\a.ts'), 'src/test/a.ts');
  assert.equal(toPosixPath('./a//b/./c.ts'), 'a/b/./c.ts');
  assert.equal(toPosixPath('C:\\repo\\a.ts'), 'C:/repo/a.ts');
});

test('everything else is literal, and a backslash escapes a special character', () => {
  expectMatches('a.b+c(d)[e]$^|.txt', ['a.b+c(d)[e]$^|.txt'], ['aXb+c(d)[e]$^|.txt', 'a.b+c(d)e$^|.txt']);
  expectMatches('[ab].ts', ['[ab].ts'], ['a.ts']);
  expectMatches('a\\*b.txt', ['a*b.txt'], ['axb.txt']);
  expectMatches('a\\{b,c\\}.txt', ['a{b,c}.txt'], ['ab.txt']);
  expectMatches('{a,b', ['{a,b'], ['a']);
  expectMatches('Test*.java', ['TestCart.java'], ['testCart.java']);
});

test('a ** that is not a whole path segment behaves like *', () => {
  expectMatches('a**b.txt', ['ab.txt', 'axxb.txt'], ['a/b.txt']);
  expectMatches('src/**.ts', ['src/a.ts'], ['src/x/a.ts']);
});

test('the default include globs of the Tier 1 adapters match the usual test file layouts', () => {
  const js = createGlobMatcher(['**/*.{spec,test,cy}.{ts,tsx,js,jsx,mjs,cjs,mts,cts}', '**/{tests,test,e2e,__tests__,cypress/e2e,specs}/**/*.{ts,tsx,js,jsx,mjs,cjs,mts,cts}']);
  assert.deepEqual(['cart.test.ts', 'src/cart.spec.tsx', 'cypress/e2e/login.cy.js', '__tests__/a.mjs', 'e2e/flows/pay.ts', 'src/cart.ts', 'tests/readme.md'].map(js), [true, true, true, true, true, false, false]);

  const python = createGlobMatcher(['**/test_*.py', '**/*_test.py', '**/tests/**/*.py', '**/test/**/*.py']);
  assert.deepEqual(['test_cart.py', 'shop/cart_test.py', 'tests/conftest.py', 'shop/cart.py'].map(python), [true, true, true, false]);

  const java = createGlobMatcher(['**/src/test/java/**/*.java', '**/*Test.java', '**/*Tests.java', '**/*IT.java', '**/Test*.java']);
  assert.deepEqual(['src/test/java/shop/BasePage.java', 'CartTest.java', 'a/CartIT.java', 'TestCart.java', 'src/main/java/shop/Cart.java'].map(java), [true, true, true, true, false]);
});

test('the default exclude list hides build output, dependencies and type declarations', () => {
  const excluded = createGlobMatcher(DEFAULT_EXCLUDE);
  for (const filePath of ['node_modules/a/a.test.js', 'web/dist/a.test.js', 'target/test-classes/A.java', '.venv/lib/test_a.py', 'pkg/__pycache__/test_a.py', '.qa-core/review/report.json', 'types/a.d.ts', 'vendor/x/a_test.go']) {
    assert.equal(excluded(filePath), true, filePath);
  }
  for (const filePath of ['tests/a.test.js', 'src/distance.test.ts', 'binary/test_a.py', 'outside/test_a.py']) {
    assert.equal(excluded(filePath), false, filePath);
  }
});

test('createGlobMatcher with no globs matches nothing, and compiled patterns are cached', () => {
  assert.equal(createGlobMatcher([])('a.ts'), false);
  assert.equal(globToRegExp('**/*.ts'), globToRegExp('**/*.ts'));
  assert.notEqual(globToRegExp('**/*.ts'), globToRegExp('**/*.tsx'));
});
