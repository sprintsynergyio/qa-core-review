// The generic adapter (Tier 3): which files it picks up and what language each is (SPEC.md
// Section 9.5). These files have no static adapter yet. They are listed in the report and are
// reviewed only in LLM mode. The rest of the generic adapter is added in Milestone 15.
import type { AdapterProfile } from '../types.js';

/** Source extensions the generic adapter knows, with the language hint for each. */
export const GENERIC_LANGUAGES: Readonly<Record<string, string>> = {
  '.scala': 'scala', '.swift': 'swift', '.rs': 'rust', '.dart': 'dart', '.ex': 'elixir', '.exs': 'elixir',
  '.cpp': 'cpp', '.cc': 'cpp', '.c': 'c', '.m': 'objective-c', '.lua': 'lua', '.r': 'r', '.jl': 'julia',
  '.clj': 'clojure', '.sh': 'shell', '.bats': 'bats', '.ps1': 'powershell',
  // Tier 2 languages, until their own adapters arrive in v0.2.0.
  '.cs': 'csharp', '.go': 'go', '.rb': 'ruby', '.kt': 'kotlin', '.kts': 'kotlin', '.php': 'php',
  '.robot': 'robot', '.feature': 'gherkin', '.jmx': 'jmeter', '.postman_collection.json': 'postman',
};

/** The language hint for a file, from its extension, or null when the extension is not known. */
export function languageHintFor(filePath: string): string | null {
  const lower = filePath.toLowerCase();
  const extension = Object.keys(GENERIC_LANGUAGES).find((candidate) => lower.endsWith(candidate));
  return extension ? GENERIC_LANGUAGES[extension]! : null;
}

export const genericProfile: AdapterProfile = {
  id: 'generic',
  tier: 3,
  languages: ['generic'],
  extensions: Object.keys(GENERIC_LANGUAGES),
  frameworks: [],
  // Common test naming patterns, in any language.
  defaultInclude: ['**/*{Test,Tests,Spec,_test,_spec,.test,.spec}.*', '**/test_*.*', '**/{test,tests,spec,specs}/**/*.*'],
  defaultExclude: [],
  languageOf: () => 'generic',
  detectProject: () => null,
};
