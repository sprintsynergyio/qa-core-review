// What kind of selector a string is (SPEC.md Section 8.1, `NSelector.strategy`). Adapters call
// this for selectors given as text, so every language reads `//div`, `#buy` and
// `[data-testid=buy]` the same way. Whether a selector is brittle is decided by a rule.
import type { SelectorStrategy } from './types.js';

const PREFIXES: ReadonlyArray<[RegExp, SelectorStrategy]> = [
  [/^(xpath=|\/|\(\/|\.\.?\/)/, 'xpath'],
  [/^text=/, 'text'],
  [/^role=/, 'role'],
  [/^id=/, 'id'],
  [/^(aria\/|~)/, 'label'], // WebdriverIO accessibility selectors
  [/^\*?=/, 'link-text'], // WebdriverIO link text
];

/** `testIdAttributes`: attribute names that mark test ids, for example ['data-testid', 'data-test']. */
export function selectorStrategy(selector: string, testIdAttributes: readonly string[]): SelectorStrategy {
  const text = selector.trim();
  for (const [pattern, strategy] of PREFIXES) if (pattern.test(text)) return strategy;
  const css = text.replace(/^css=/, '');
  const attribute = /^\[\s*([\w-]+)\s*[~|^$*]?=?[^\]]*\]$/.exec(css)?.[1];
  if (attribute !== undefined) return testIdAttributes.includes(attribute) ? 'test-id' : attribute === 'name' ? 'name' : attribute === 'id' ? 'id' : 'css';
  if (testIdAttributes.some((name) => css.startsWith(`${name}=`))) return 'test-id';
  // WebdriverIO: `h1=Welcome` and `.title*=Sauce` find an element by its text.
  if (/^[\w.#-]+\*?=/.test(css)) return 'text';
  if (/^#[\w-]+$/.test(css)) return 'id';
  return /^\.[\w-]+$/.test(css) ? 'class' : 'css';
}
