// QCR-X001 parse-error (SPEC.md Section 10.15): a file that could not be read as code, or a
// file named like a test file in which no test was found. One finding per file.
import type { Rule } from './types.js';

const FILE_START = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 };

export const parseError: Rule = {
  id: 'QCR-X001',
  name: 'parse-error',
  defaultSeverity: 'info',
  scope: 'universal',
  requires: [],
  description: 'A test file could not be parsed, or no test was found in a file that is named like a test file.',
  check({ file }) {
    if (file.parseStatus === 'failed') {
      return [{
        message: 'This file could not be parsed, so it was not reviewed.', evidence: file.path, span: FILE_START, testId: null,
        fix: 'Fix the syntax of the file and run the review again.',
      }];
    }
    if (file.parseStatus === 'llm-only' || file.role !== 'test' || file.tests.length > 0) return [];
    return [{
      message: 'No test was found in this file, although its name says it is a test file.', evidence: file.path, span: FILE_START, testId: null,
      fix: 'Check that the tests are declared the way the test runner expects, or leave the file out with "exclude" in the config.',
    }];
  },
};
