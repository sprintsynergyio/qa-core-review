// Which runner and libraries one JS/TS file uses (SPEC.md Sections 7.4 and 9.1).
// File markers win over project markers: a Jest file in a project that also has Playwright is
// a Jest file.
import type { FrameworkId } from '../../model/types.js';
import { JS_LEXICAL, scanLines } from '../../parse/lexical.js';
import type { FrameworkGuess, SourceFile } from '../types.js';
import { FRAMEWORK_MODULES, GLOBAL_RUNNERS, USAGE_MARKERS } from './vocab.js';

/** The module names a file imports or requires, read from the text so no tree is needed. */
export function importedModules(text: string): string[] {
  const found: string[] = [];
  const pattern = /(?:\bfrom\s*|\brequire\s*\(\s*|\bimport\s*\(\s*|\bimport\s+)(['"])([^'"\n]+)\1/g;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) found.push(match[2]!);
  return found;
}

export function detectJsFrameworks(file: SourceFile): FrameworkGuess {
  const project = file.project;
  const declared = project?.frameworks ?? [];
  const modules = importedModules(file.text);
  // Usage markers are searched in code only, not in strings or comments.
  const code = scanLines(file.text, JS_LEXICAL).map((line) => line.codeNoStrings).join('\n');
  const used = (marker: string): boolean => new RegExp(`(?<![\\w$.])${marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(code);

  const imported = Object.entries(FRAMEWORK_MODULES).filter(([name]) => modules.includes(name)).map(([, id]) => id);
  const fromUsage = USAGE_MARKERS.filter((marker) => (!marker.needsProject || declared.includes(marker.framework)) && used(marker.text)).map((marker) => marker.framework);
  const seen = [...new Set([...imported, ...fromUsage])];
  const guess = (runner: FrameworkId, confidence: FrameworkGuess['confidence']): FrameworkGuess => ({ runner, libraries: seen.filter((id) => id !== runner), confidence });

  // 1. A config `projects` entry names the runner: it wins.
  if (project?.evidence[0]?.startsWith('config: ') && declared.length > 0) return guess(declared[0]!, 'high');
  // 2. An import of the framework's own module.
  if (imported.length > 0) return guess(imported[0]!, 'high');
  // 3. A global that only that framework has.
  if (fromUsage.length > 0) return guess(fromUsage[0]!, 'medium');
  // 4. The project's runners. A file with no import cannot be a runner that needs one, unless
  //    that runner is all the project has (Vitest with `globals: true`).
  const global = GLOBAL_RUNNERS.filter((id) => declared.includes(id));
  if (/\.cy\.[cm]?[jt]sx?$/.test(file.path) && (global.includes('cypress') || declared.length === 0)) return guess('cypress', 'low');
  if (global.length > 0) return guess(global[0]!, global.length === 1 ? 'medium' : 'low');
  if (declared.length === 1) return guess(declared[0]!, 'low');
  return guess('unknown', 'low');
}
