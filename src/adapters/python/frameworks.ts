// Which runner and libraries one Python file uses (SPEC.md Sections 7.4 and 9.2). It reads
// the text only, so it works before parsing and for a file that cannot be parsed.
//
// pytest is the runner when the project has pytest, or the file uses `pytest.`, or the file
// has plain `test_` functions that use `assert`. A `unittest.TestCase` class in a project with
// no pytest is run by unittest. In a pytest project, unittest is then a library of the file.
import type { FrameworkId } from '../../model/types.js';
import { PYTHON_LEXICAL, scanLines } from '../../parse/lexical.js';
import type { FrameworkGuess, SourceFile } from '../types.js';
import { FRAMEWORK_MODULES, MOCK_MODULES, TESTCASE_SUFFIX, TEST_FUNCTION_PREFIX } from './vocab.js';

/** The modules a file imports, as written: 'shop.cart', 'playwright.sync_api', '.helpers'. */
export function importedModules(code: string): string[] {
  const found: string[] = [];
  for (const line of code.split('\n')) {
    const from = /^\s*from\s+([\w.]+)\s+import\b/.exec(line);
    if (from) found.push(from[1]!);
    const plain = /^\s*import\s+(.+)$/.exec(line);
    if (plain) found.push(...plain[1]!.split(',').map((part) => part.trim().split(/\s+/)[0]!).filter((name) => /^[\w.]+$/.test(name)));
  }
  return found;
}

export function detectPythonFrameworks(file: SourceFile): FrameworkGuess {
  const project = file.project;
  const declared = project?.frameworks ?? [];
  // Markers are searched in code only, not in strings or comments.
  const code = scanLines(file.text, PYTHON_LEXICAL).map((line) => line.codeNoStrings).join('\n');
  // `unittest.mock` is a mock library that pytest files use too: importing it does not make a file a unittest file.
  const modules = importedModules(code.replace(/^\s*from\s+unittest\s+import\s+mock\s*$/gm, '')).filter((name) => !MOCK_MODULES.some((module) => name === module || name.startsWith(`${module}.`)));
  const imported = [...new Set(modules.map((name) => FRAMEWORK_MODULES[name.split('.')[0]!]).filter((id): id is FrameworkId => id !== undefined))];

  const usesPytest = imported.includes('pytest') || /(?<![\w.])pytest\./.test(code);
  const testCase = new RegExp(`^\\s*class\\s+\\w+\\s*\\([^)]*\\b\\w*${TESTCASE_SUFFIX}\\b`, 'm').test(code);
  // The `page` fixture of pytest-playwright needs no import.
  const pageFixture = declared.includes('playwright-python') && new RegExp(`\\bdef\\s+${TEST_FUNCTION_PREFIX}\\w*\\s*\\([^)]*\\bpage\\b`).test(code);
  const plainTests = new RegExp(`^(async\\s+)?def\\s+${TEST_FUNCTION_PREFIX}\\w*\\s*\\(`, 'm').test(code) && /^\s+assert\b/m.test(code);

  const seen = [...new Set<FrameworkId>([
    ...(usesPytest ? ['pytest' as const] : []), ...(testCase ? ['unittest' as const] : []), ...imported, ...(pageFixture ? ['playwright-python' as const] : []),
  ])];
  const guess = (runner: FrameworkId, confidence: FrameworkGuess['confidence']): FrameworkGuess => ({ runner, libraries: seen.filter((id) => id !== runner), confidence });
  const runners = declared.filter((id) => id === 'pytest' || id === 'unittest');

  // 1. A config `projects` entry names the runner: it wins.
  if (project?.evidence[0]?.startsWith('config: ') && runners.length > 0) return guess(runners[0]!, 'high');
  // 2. The file uses pytest itself.
  if (usesPytest) return guess('pytest', 'high');
  // 3. The project has pytest: pytest runs every test file in it, unittest classes included.
  if (declared.includes('pytest')) return guess('pytest', 'medium');
  // 4. A TestCase class, and no pytest anywhere.
  if (testCase) return guess('unittest', imported.includes('unittest') ? 'high' : 'medium');
  // 5. Plain test functions with `assert`: only pytest runs those.
  if (plainTests) return guess('pytest', 'medium');
  if (runners.length > 0) return guess(runners[0]!, 'low');
  return guess('unknown', 'low');
}
