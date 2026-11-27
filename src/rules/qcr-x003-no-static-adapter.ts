// QCR-X003 no-static-adapter (SPEC.md Sections 9.5 and 10.15): a test file in a language that
// has no static adapter and no line patterns in the config. It is listed and not reviewed, and
// this finding says so. One per file.
import { languageName } from '../model/languages.js';
import type { Rule } from './types.js';

export const noStaticAdapter: Rule = {
  id: 'QCR-X003',
  name: 'no-static-adapter',
  defaultSeverity: 'info',
  scope: 'universal',
  requires: [],
  description: 'A test file in a language with no static rules yet. It is listed, and reviewed only in LLM mode.',
  check({ file }) {
    if (file.language !== 'generic' || file.parseStatus !== 'llm-only') return [];
    const language = file.languageHint === null ? 'this language' : languageName(file.languageHint);
    return [{
      message: `No static rules for ${language} yet. Run with --llm to review this file.`, evidence: file.path,
      span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 }, testId: null,
      fix: 'Run the review with --llm, or give line patterns for this language under "generic" in the config (see docs/languages.md).',
    }];
  },
};
