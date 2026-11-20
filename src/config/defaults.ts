// The default config, exactly as in SPEC.md Section 12.2. A test compares the two.

/** Folders and files that are never test sources. */
export const DEFAULT_EXCLUDE: readonly string[] = [
  '**/node_modules/**', '**/dist/**', '**/build/**', '**/target/**', '**/out/**', '**/bin/**', '**/obj/**',
  '**/coverage/**', '**/.venv/**', '**/venv/**', '**/__pycache__/**', '**/.gradle/**', '**/vendor/**',
  '**/.qa-core/**', '**/*.d.ts',
];

/** The config a user gets with no config file, in the shape a config file has. */
export function defaultConfigFile(): Record<string, unknown> {
  return {
    include: null,
    exclude: [...DEFAULT_EXCLUDE],
    languages: 'auto',
    framework: 'auto',
    projects: [],
    generic: [],
    failOn: 'error',
    testIdAttribute: 'data-testid',
    assertionHelpers: [],
    suppressions: [],
    rules: {
      'QCR-W001': { severity: 'warn', maxMs: 0 },
      'QCR-S001': { severity: 'warn', allowPatterns: [] },
      'QCR-M001': { subjectMap: {} },
      'QCR-C001': { restoreMocksConfigured: false },
      'QCR-N001': { severity: 'info' },
    },
    adapters: { js: {}, python: {}, java: {} },
    llm: {
      mode: 'off',
      model: null,
      includeSubject: false,
      includeLlmOnlyFiles: true,
      allowErrors: false,
      maxFilesPerRun: 20,
      maxCharsPerFile: 40000,
      redact: true,
      timeoutMs: 60000,
    },
    claude: { stopGate: 'report' },
    ui: { port: 0, open: true },
    output: { dir: '.qa-core/review', formats: ['pretty'] },
  };
}
