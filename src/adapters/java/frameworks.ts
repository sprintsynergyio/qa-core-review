// Which runner and libraries one Java file uses (SPEC.md Sections 7.4 and 9.3). It reads the
// text only, so it works before parsing and for a file that cannot be parsed.
//
// The runner of a file is the framework whose test annotation it names: a TestNG test that
// uses the assertions of JUnit is still run by TestNG. A file with no test annotation (a base
// class, a page object) gets the runner it names in another way, or the runner of its project.
import type { FrameworkId } from '../../model/types.js';
import { JAVA_LEXICAL, scanLines } from '../../parse/lexical.js';
import type { FrameworkGuess, SourceFile } from '../types.js';
import { FRAMEWORK_PACKAGES, RUNNERS, SHARED_JUNIT_PACKAGES, TEST_ANNOTATIONS } from './vocab.js';

const PACKAGES = [...Object.keys(FRAMEWORK_PACKAGES), ...SHARED_JUNIT_PACKAGES].sort((a, b) => b.length - a.length);
const QUALIFIED_NAME = /(?<![\w.])(?:[a-z_]\w*\.)+\w+/g;
const WILDCARD_IMPORT = /^\s*import\s+(?:static\s+)?([\w.]+)\.\*\s*;/gm;

/** The framework that a qualified name belongs to: the longest package that it starts with decides. */
export function frameworkOf(name: string): FrameworkId | null {
  const home = PACKAGES.find((candidate) => name === candidate || name.startsWith(`${candidate}.`));
  return home === undefined ? null : FRAMEWORK_PACKAGES[home] ?? null;
}

export function detectJavaFrameworks(file: SourceFile): FrameworkGuess {
  const project = file.project;
  const declared = project?.frameworks ?? [];
  // Names are searched in code only, not in strings or comments.
  const code = scanLines(file.text, JAVA_LEXICAL).map((line) => line.codeNoStrings).join('\n');
  const names = [...new Set(code.match(QUALIFIED_NAME) ?? [])];
  const wildcards = [...code.matchAll(WILDCARD_IMPORT)].map((match) => match[1]!);
  const seen = [...new Set(names.map(frameworkOf).filter((id): id is FrameworkId => id !== null))];

  // The frameworks whose test annotation the file names: by its full name, or through `import package.*;` and `@Test`.
  const testing = [...new Set(Object.entries(TEST_ANNOTATIONS).filter(([name]) => {
    const [home, simple] = [name.slice(0, name.lastIndexOf('.')), name.slice(name.lastIndexOf('.') + 1)];
    return names.includes(name) || (wildcards.includes(home) && new RegExp(`@${simple}\\b`).test(code));
  }).map(([, entry]) => entry.runner))];

  const guess = (runner: FrameworkId, confidence: FrameworkGuess['confidence']): FrameworkGuess => ({ runner, libraries: seen.filter((id) => id !== runner), confidence });
  const inOrder = (list: readonly FrameworkId[]): FrameworkId[] => RUNNERS.filter((id) => list.includes(id));
  const runners = inOrder(declared);

  // 1. A config `projects` entry names the runner: it wins.
  if (project?.evidence[0]?.startsWith('config: ') && runners.length > 0) return guess(runners[0]!, 'high');
  // 2. The file names the test annotation of one runner.
  if (testing.length === 1) return guess(testing[0]!, 'high');
  // 3. It names those of two runners (a class that is half moved from JUnit 4 to 5): the one the project has, else the newer one.
  if (testing.length > 1) return guess(inOrder(testing).find((id) => declared.includes(id)) ?? inOrder(testing)[0]!, 'medium');
  // 4. No test annotation, and it names a runner in another way: a base class with hooks, a helper with assertions.
  const named = inOrder(seen);
  if (named.length > 0) return guess(named.find((id) => declared.includes(id)) ?? named[0]!, named.length === 1 ? 'high' : 'medium');
  // 5. A support file that names no runner: the runner of its project.
  if (runners.length > 0) return guess(runners[0]!, runners.length === 1 ? 'medium' : 'low');
  return guess('unknown', 'low');
}
