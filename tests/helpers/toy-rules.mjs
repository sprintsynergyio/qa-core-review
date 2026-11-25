// Small rules for engine tests. The real rules arrive from Milestone 6; these only need to
// produce findings of each severity from facts the JS adapter already fills in.
const at = (span) => ({ startLine: span.startLine, startColumn: span.startColumn, endLine: span.startLine, endColumn: span.startColumn + 1 });

/** Error: a test with statements and no assertion. One finding per test. */
export const noCheck = {
  id: 'QCR-T001', name: 'toy-no-check', defaultSeverity: 'error', scope: 'universal', requires: ['tests', 'assertions'], description: 'A test with no assertion.',
  check: ({ file }) => file.tests.filter((test) => test.assertions.length === 0 && test.statementCount > 0 && !test.skip && !test.modifiers.includes('todo'))
    .map((test) => ({ message: 'This test checks nothing.', evidence: test.title, span: at(test.span), testId: test.id, fix: 'Add an assertion.', goodExample: 'expect(total).toBe(1);' })),
};

/** Warn: every fixed sleep. Several findings per test, sometimes with the same evidence. */
export const sleep = {
  id: 'QCR-T002', name: 'toy-sleep', defaultSeverity: 'warn', scope: 'universal', requires: ['waits'], description: 'A fixed sleep.',
  check: ({ file, options }) => file.tests.flatMap((test) => test.waits.filter((wait) => wait.kind === 'fixed-sleep' && (wait.ms ?? Infinity) > (options.maxMs ?? 0))
    .map((wait) => ({ message: `Hard wait of ${wait.ms} ms.`, evidence: wait.text, span: wait.span, testId: test.id }))),
};

/** Info: one note per Cypress or Playwright file that uses selectors. A file-level finding. */
export const fileNote = {
  id: 'QCR-T003', name: 'toy-file-note', defaultSeverity: 'info', scope: 'framework', appliesTo: { frameworks: ['cypress', 'playwright'] }, requires: ['selectors'],
  description: 'A note about the file.',
  check: ({ file, all }) => [{ message: `One of ${all.length} files.`, evidence: `   ${file.path}   with\n  spaces `, span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 }, testId: null, confidence: 'medium' }],
};

export const toyRules = [noCheck, sleep, fileNote];

const suitesOf = (file) => {
  const all = [];
  const walk = (suites) => suites.forEach((suite) => {
    all.push(suite);
    walk(suite.suites);
  });
  walk(file.suites);
  return all;
};

/** Warn: a fixed sleep in a hook. A file-level finding that is not info. Not in toyRules: only the report tests use it. */
export const hookSleep = {
  id: 'QCR-T004', name: 'toy-hook-sleep', defaultSeverity: 'warn', scope: 'universal', requires: ['waits'], description: 'A fixed sleep in a hook. It slows every test of the file.',
  check: ({ file }) => [...file.fileHooks, ...suitesOf(file).flatMap((suite) => suite.hooks)].flatMap((hook) => hook.waits.filter((wait) => wait.kind === 'fixed-sleep')
    .map((wait) => ({ message: `Hard wait of ${wait.ms} ms in a hook.`, evidence: wait.text, span: wait.span, testId: null, fix: 'Wait for a condition.' }))),
};
