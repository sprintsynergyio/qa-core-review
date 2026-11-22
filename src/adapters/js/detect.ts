// JS/TS: which files are tests and how a project shows its frameworks (SPEC.md Sections 7.4, 9.1).
// The parser half of the adapter (queries, vocabulary, normalizer) is added in Milestone 4.
import { detectFromMarkers } from '../../detect/markers.js';
import type { AdapterProfile, FrameworkDescriptor } from '../types.js';

const PKG = 'package.json';
const SOURCE = 'ts,tsx,js,jsx,mjs,cjs,mts,cts';

const frameworks: FrameworkDescriptor[] = [
  { id: 'playwright', role: 'runner', displayName: 'Playwright', projectMarkers: [{ file: PKG, contains: '@playwright/test' }, { file: 'playwright.config.*' }], fileMarkers: ['@playwright/test'] },
  { id: 'cypress', role: 'runner', displayName: 'Cypress', projectMarkers: [{ file: PKG, contains: 'cypress' }, { file: 'cypress.config.*' }], fileMarkers: ['cy.'] },
  { id: 'jest', role: 'runner', displayName: 'Jest', projectMarkers: [{ file: PKG, contains: 'jest' }, { file: 'jest.config.*' }], fileMarkers: ['@jest/globals', 'jest.'] },
  { id: 'vitest', role: 'runner', displayName: 'Vitest', projectMarkers: [{ file: PKG, contains: 'vitest' }, { file: 'vitest.config.*' }], fileMarkers: ['vitest'] },
  { id: 'mocha', role: 'runner', displayName: 'Mocha', projectMarkers: [{ file: PKG, contains: 'mocha' }, { file: '.mocharc*' }], fileMarkers: ['mocha'] },
  {
    id: 'webdriverio',
    role: 'runner',
    displayName: 'WebdriverIO',
    projectMarkers: [{ file: PKG, contains: 'webdriverio' }, { file: PKG, contains: '@wdio/' }, { file: 'wdio.conf.*' }],
    fileMarkers: ['@wdio/globals', 'browser.$'],
  },
  { id: 'node-test', role: 'runner', displayName: 'node:test', projectMarkers: [], fileMarkers: ['node:test'] },
];

/** The names under `dependencies` and `devDependencies` of a package.json. */
function dependencyNames(file: string, text: string): string[] | null {
  if (file !== PKG) return null;
  try {
    const pkg = JSON.parse(text) as { dependencies?: object; devDependencies?: object };
    return [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})];
  } catch {
    return []; // a package.json that cannot be parsed declares nothing
  }
}

export const jsProfile: AdapterProfile = {
  id: 'js',
  tier: 1,
  languages: ['javascript', 'typescript'],
  extensions: ['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts'],
  frameworks,
  defaultInclude: [`**/*.{spec,test,cy}.{${SOURCE}}`, `**/{tests,test,e2e,__tests__,cypress/e2e,specs}/**/*.{${SOURCE}}`],
  // Type declarations and runner config files are never tests, even inside a tests folder.
  defaultExclude: ['**/*.d.ts', `**/*.config.{${SOURCE}}`, `**/wdio.conf.{${SOURCE}}`],
  languageOf: (filePath) => (/\.(ts|tsx|mts|cts)$/i.test(filePath) ? 'typescript' : 'javascript'),
  detectProject: (probe) => detectFromMarkers(probe, jsProfile, { manifests: [PKG], weakManifests: ['tsconfig.json', 'jsconfig.json'], dependencyNames }),
};
