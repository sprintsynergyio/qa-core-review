// Python: which files are tests and how a project shows its frameworks (SPEC.md Sections 7.4, 9.2).
// The parser half of the adapter is added in Milestone 13.
import { detectFromMarkers } from '../../detect/markers.js';
import type { AdapterProfile, FrameworkDescriptor, ProjectMarker } from '../types.js';

/** Files that list dependencies. `poetry.lock` marks a project but is too large to search. */
const DEPENDENCY_FILES = ['pyproject.toml', 'requirements*.txt', 'setup.cfg', 'setup.py', 'Pipfile', 'tox.ini'];
const declares = (...names: string[]): ProjectMarker[] => names.flatMap((contains) => DEPENDENCY_FILES.map((file) => ({ file, contains })));

const frameworks: FrameworkDescriptor[] = [
  {
    id: 'pytest',
    role: 'runner',
    displayName: 'pytest',
    // pytest-playwright needs pytest, so it proves pytest too. `[tool.pytest.ini_options]` is pytest config.
    projectMarkers: [...declares('pytest', 'pytest-playwright', 'tool.pytest.ini_options'), { file: 'pytest.ini' }, { file: 'conftest.py' }],
    fileMarkers: ['import pytest', 'from pytest'],
  },
  { id: 'unittest', role: 'runner', displayName: 'unittest', projectMarkers: [], fileMarkers: ['import unittest', 'from unittest'] },
  {
    id: 'playwright-python',
    role: 'library',
    displayName: 'Playwright for Python',
    projectMarkers: declares('pytest-playwright', 'playwright'),
    fileMarkers: ['playwright.sync_api', 'playwright.async_api'],
  },
  { id: 'selenium', role: 'library', displayName: 'Selenium', projectMarkers: declares('selenium'), fileMarkers: ['from selenium', 'import selenium'] },
];

export const pythonProfile: AdapterProfile = {
  id: 'python',
  tier: 1,
  languages: ['python'],
  extensions: ['.py'],
  frameworks,
  defaultInclude: ['**/test_*.py', '**/*_test.py', '**/tests/**/*.py', '**/test/**/*.py'],
  defaultExclude: [],
  languageOf: () => 'python',
  detectProject: (probe) =>
    detectFromMarkers(probe, pythonProfile, {
      manifests: [...DEPENDENCY_FILES, 'poetry.lock', 'pytest.ini'],
      weakManifests: ['conftest.py'],
      fallbackRunner: { id: 'unittest', evidence: 'no test runner in the manifests: unittest assumed' },
    }),
};
