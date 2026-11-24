// QCR-S001 brittle-selector (SPEC.md Section 10.7): a selector that depends on the layout of
// the page or on names a build tool makes up. The classifier in ./selectors.ts decides; this
// rule turns its answer into a finding.
import { clipText } from '../model/build.js';
import { fixFor } from './fix-text.js';
import { classifySelector, type Brittle } from './selectors.js';
import type { FindingDraft, Rule } from './types.js';

const MESSAGES: Record<Brittle['reason'], (detail: string) => string> = {
  xpath: (detail) => `XPath depends on layout: ${detail}.`,
  position: (detail) => `Selector picks an element by its position in the page: ${detail}.`,
  generated: (detail) => `Selector uses a generated name that changes from build to build: ${detail}.`,
  deep: (detail) => `Selector follows the page structure through many levels: ${detail}.`,
  pick: (detail) => (detail.startsWith('index')
    ? `Picks the element at ${detail} of a list, so the test depends on the order of the list.`
    : `Picks the ${detail} match of a selector that is not a role, a label or a test id, so the test depends on the order of the page.`),
};

export const brittleSelector: Rule = {
  id: 'QCR-S001',
  name: 'brittle-selector',
  defaultSeverity: 'warn',
  scope: 'framework',
  requires: ['selectors'],
  description: 'A selector that depends on page layout or on generated class names. Positional picks are reported as info.',
  check({ file, options }) {
    const allow = (Array.isArray(options.allowPatterns) ? options.allowPatterns : []).map((source) => new RegExp(String(source)));
    const drafts: FindingDraft[] = [];
    for (const test of file.tests) {
      for (const selector of test.selectors) {
        const found = classifySelector(selector, allow);
        if (!found) continue;
        drafts.push({
          message: MESSAGES[found.reason](clipText(found.detail)), evidence: selector.text, span: selector.span, testId: test.id,
          ...(found.reason === 'pick' ? { severity: 'info' as const } : {}), ...fixFor(`QCR-S001/${found.reason}`, file.language),
        });
      }
    }
    return drafts;
  },
};
