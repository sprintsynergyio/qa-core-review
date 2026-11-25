// QCR-N001 missing-negative-case (SPEC.md Section 10.11): a suite, or a file with no suite,
// where every test is a happy path. A heuristic on titles and assertions, so it is info with
// low confidence.
import type { NFile, NSuite, NTest, Span } from '../model/types.js';
import { fixFor } from './fix-text.js';
import type { FindingDraft, Rule } from './types.js';
import { atStart, suitesOf } from './util.js';

/** A word of a title that starts like this says the test is about something going wrong. */
const NEGATIVE_WORD = /^(invalid|error|fail|reject|wrong|empty|missing|denied|unauthori[sz]ed|forbidden|expired|locked|limit|max|min|zero|negative|boundary|overflow|timeout|404|401|403|500|edge|null|undefined|none|nil)/i;
const NOT_FOUND = /not.?found/i;
/** Text in an assertion that says an error is being checked. */
const ERROR_TEXT = /error|invalid|required/i;
const FIRST_ERROR_STATUS = 400;
const MIN_TESTS = 2;

/** `rejectsUnknownCode` and `rejects_unknown_code` as words. */
const wordsOf = (title: string): string[] => title.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[^A-Za-z0-9]+/).filter(Boolean);

function isNegative(test: NTest): boolean {
  const words = wordsOf(test.fullTitle);
  return words.some((word) => NEGATIVE_WORD.test(word)) || NOT_FOUND.test(words.join(' ')) || test.expectsException
    || test.assertions.some((assertion) => assertion.kind === 'throws' || (assertion.statusCodes ?? []).some((code) => code >= FIRST_ERROR_STATUS) || ERROR_TEXT.test(assertion.text));
}

/** Negative cases to suggest, by a word in the title of the group. The first match wins. */
const SUGGESTIONS: ReadonlyArray<[RegExp, string[]]> = [
  [/checkout|order|basket|cart/i, ['an empty cart', 'a missing postal code', 'a payment that is declined']],
  [/log.?in|sign.?in|auth|session|password/i, ['a wrong password', 'a locked user', 'an expired session']],
  [/sign.?up|regist|form|profile|account/i, ['a missing required field', 'an invalid email address', 'a name that is already taken']],
  [/discount|coupon|promo|voucher|price|total|tax/i, ['an unknown code', 'an expired code', 'a negative amount']],
  [/search|filter|sort|list/i, ['a search with no results', 'an empty search text', 'a very long search text']],
  [/upload|import|file|export|download/i, ['an empty file', 'a file that is too large', 'a file of the wrong type']],
  [/pay|card|refund|invoice/i, ['a declined card', 'an expired card', 'an amount of zero']],
  [/api|endpoint|request|route|http|rest/i, ['an id that does not exist (404)', 'a request with no token (401)', 'a body with a missing field (400)']],
  [/parse|format|convert|valid|date|number/i, ['an empty value', 'a value in the wrong format', 'a value at the limit']],
];
const FALLBACK = ['empty input', 'invalid input', 'a server error'];

function suggestionsFor(title: string): string[] {
  const words = wordsOf(title).join(' ');
  return SUGGESTIONS.find(([pattern]) => pattern.test(words))?.[1] ?? FALLBACK;
}

export const missingNegativeCase: Rule = {
  id: 'QCR-N001',
  name: 'missing-negative-case',
  defaultSeverity: 'info',
  scope: 'universal',
  requires: ['tests', 'assertions'],
  description: 'A suite, or a file with no suite, where every test is a happy path.',
  check({ file }) {
    const byId = new Map(file.tests.map((test) => [test.id, test]));
    const inSuites = new Set(suitesOf(file).flatMap((suite) => suite.testIds));
    const drafts: FindingDraft[] = [];
    const group = (title: string, tests: NTest[], span: Span, where: string): void => {
      if (tests.length < MIN_TESTS || tests.some(isNegative)) return;
      const cases = suggestionsFor(title).map((suggestion) => `${title} with ${suggestion}`);
      drafts.push({
        message: `All ${tests.length} tests of ${where} are happy paths. Cases to think about: ${cases.join('; ')}.`,
        evidence: title, span: atStart(span), testId: null, confidence: 'low', ...fixFor('QCR-N001', file.language),
      });
    };
    const testsOf = (suite: NSuite): NTest[] => suite.testIds.flatMap((id) => byId.get(id) ?? []);
    for (const suite of suitesOf(file)) group(suite.title, testsOf(suite), suite.span, `"${suite.title}"`);
    // Tests outside every suite form one group, named by the file: `checkout.spec.ts` is about "checkout".
    const loose = file.tests.filter((test) => !inSuites.has(test.id));
    const subject = wordsOf(file.path.split('/').at(-1)!.split('.')[0]!).filter((word) => !/^(tests?|specs?)$/i.test(word)).join(' ').toLowerCase();
    if (loose.length > 0) group(subject || 'the code', loose, loose[0]!.span, 'this file');
    return drafts;
  },
};
