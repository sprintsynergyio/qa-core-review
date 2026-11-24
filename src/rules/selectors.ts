// The shared selector classifier for QCR-S001 (SPEC.md Section 10.7). Adapters only extract
// selectors. Whether one depends on layout or on generated names is decided here, once, for
// every language.
import type { NSelector, SelectorStrategy } from '../model/types.js';

export type BrittleReason = 'xpath' | 'position' | 'generated' | 'deep' | 'pick';

export interface Brittle {
  reason: BrittleReason;
  /** The part that shows the problem: the selector, the generated name, or the pick. */
  detail: string;
}

/** Strategies whose value is CSS, or one class or id name. A role, a label or a text is not a selector string. */
const CSS_LIKE: readonly SelectorStrategy[] = ['css', 'id', 'class', 'name'];
/** A first or last match of one of these is stable enough: there is rarely a better way to say it. */
const STABLE_BASES: readonly SelectorStrategy[] = ['role', 'test-id', 'label'];

const XPATH_START = /^(xpath=|\(*\/|\.\.?\/)/;
const XPATH_INDEX = /\[\s*(\d+|last\(\)(\s*-\s*\d+)?)\s*\]|position\(\)/;
const MAX_XPATH_STEPS = 3;
const MAX_COMBINATORS = 3;
/** `:nth-child(2)`, `:nth-of-type(2)`, `:nth-last-child(1)`, and the Playwright `>> nth=2`. */
const POSITION = /:nth-(last-)?(child|of-type)\(|>>\s*nth=/;

/** Whole class or id names that a styling library or a framework writes at build time. */
const GENERATED_NAMES: readonly RegExp[] = [
  /^css-[a-z0-9]{4,}$/, // Emotion
  /^sc-[a-zA-Z]{5,}$/, // styled-components
  /^jss\d+$/, /^makeStyles-/, // JSS, Material UI
  /^ng-tns-c\d+/, // Angular
  /^ember\d+$/, // Ember
  /^_.+_[a-zA-Z0-9]{5}_\d+$/, // CSS modules, Vite: _button_1x2y3_12
];
/** CSS modules, webpack and Next.js: Button_primary__3xK2a. The hash has a digit or a capital, so a BEM name (card__title) is not one. */
const MODULE_HASH = /__([\w-]{5})$/;
/** Groups nested deeper than this are left as they are. No real selector comes close. */
const MAX_NESTING = 8;

/** A hash inside a name: 6 or more characters, 3 or more digits, and letters and digits that alternate (4f3a2b1c, not item2024). */
function isHash(part: string): boolean {
  const digits = part.replace(/\D/g, '').length;
  const switches = part.match(/(?<=\d)[a-zA-Z]|(?<=[a-zA-Z])\d/g)?.length ?? 0;
  return part.length >= 6 && digits >= 3 && switches >= 2;
}

/** True for a class or id name that changes from one build to the next. */
export function isGeneratedName(name: string): boolean {
  return GENERATED_NAMES.some((pattern) => pattern.test(name)) || /[A-Z0-9]/.test(MODULE_HASH.exec(name)?.[1] ?? '') || name.split(/[-_]/).some(isHash);
}

const withoutStrings = (text: string): string => text.replace(/"[^"]*"|'[^']*'/g, '""');

/** Removes nested (...) or [...] groups, innermost first. */
function withoutGroups(text: string, pattern: RegExp): string {
  let before = text;
  for (let pass = 0; pass < MAX_NESTING; pass += 1) {
    const after = before.replace(pattern, '');
    if (after === before) break;
    before = after;
  }
  return before;
}

function xpathProblem(value: string): boolean {
  const bare = withoutStrings(value.replace(/^xpath=/, '').trim());
  if (/^\(*\/html\b/.test(bare) || XPATH_INDEX.test(bare)) return true;
  const steps = (path: string): number => path.replace(/[()]/g, '').split(/\/+/).filter((step) => step.trim() !== '' && !/^\.\.?$/.test(step.trim())).length;
  return withoutGroups(bare, /\[[^[\]]*\]/g).split('|').some((path) => steps(path) > MAX_XPATH_STEPS);
}

function cssProblem(value: string): Brittle | null {
  const css = value.replace(/^css=/, '');
  if (POSITION.test(withoutStrings(css))) return { reason: 'position', detail: value };
  // Class and id names: `.name`, `#name`, and `[class*="name"]` or `[id="name"]`.
  const inAttributes = [...css.matchAll(/\[\s*(?:class|id)\s*[~|^$*]?=\s*["']?([^"'\]]*)["']?\s*\]/g)].flatMap((match) => match[1]!.split(/\s+/));
  const plain = withoutGroups(withoutGroups(withoutStrings(css), /\[[^[\]]*\]/g), /\([^()]*\)/g);
  const names = [...[...plain.matchAll(/[.#]([\w-]+)/g)].map((match) => match[1]!), ...inAttributes];
  const generated = names.find(isGeneratedName);
  if (generated) return { reason: 'generated', detail: generated };
  // Combinators: `>`, `+`, `~`, a space, and the Playwright `>>`.
  const levels = Math.max(...plain.split(',').map((part) => part.trim().replace(/\s*(>>|[>+~])\s*/g, '>').replace(/\s+/g, '>').split('>').filter(Boolean).length - 1));
  return levels > MAX_COMBINATORS ? { reason: 'deep', detail: value } : null;
}

/**
 * Why a selector is brittle, or null when it is fine. `allow` holds the `allowPatterns` of the
 * config: a selector that matches one of them is never reported.
 */
export function classifySelector(selector: Pick<NSelector, 'value' | 'strategy' | 'positional'>, allow: readonly RegExp[] = []): Brittle | null {
  const { value, strategy, positional } = selector;
  if (value !== null && allow.some((pattern) => pattern.test(value))) return null;
  if (value !== null) {
    const text = value.trim();
    if (strategy === 'xpath' || (CSS_LIKE.includes(strategy) && XPATH_START.test(text))) {
      if (xpathProblem(text)) return { reason: 'xpath', detail: value };
    } else if (CSS_LIKE.includes(strategy)) {
      // `By.id("ember123")` and `By.className("css-1q2w3e4")` give the bare name.
      const found = /^[\w-]+$/.test(text) && strategy !== 'css' ? (isGeneratedName(text) ? { reason: 'generated' as const, detail: text } : null) : cssProblem(text);
      if (found) return found;
    } else if (/>>\s*nth=/.test(text)) return { reason: 'position', detail: value };
  }
  if (positional?.kind === 'nth' && positional.index !== null && positional.index > 0) return { reason: 'pick', detail: `index ${positional.index}` };
  if (positional && positional.kind !== 'nth' && !STABLE_BASES.includes(positional.baseStrategy)) return { reason: 'pick', detail: positional.kind };
  return null;
}
