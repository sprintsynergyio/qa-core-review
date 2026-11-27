// A small tokenizer for the code view of the review page: keywords, strings and comments for
// each language the tool reads, and plain text for everything else. No library. It never runs
// or parses the code: it only colors it, so a wrong guess costs a color and nothing more.

const words = (text) => new Set(text.split(' '));

const C_COMMENTS = { line: ['//'], block: [['/*', '*/']] };
const HASH_COMMENTS = { line: ['#'], block: [] };

/**
 * One entry per language id of the report.
 * `strings`: [open, close, multiline]; the longest opener is tried first.
 * `linePrefix`: words that are keywords only at the start of a line (Gherkin, Robot).
 */
export const LANGUAGES = {
  javascript: {
    ...C_COMMENTS, strings: [['`', '`', true], ['"', '"', false], ["'", "'", false]],
    keywords: words('async await break case catch class const continue default delete do else export extends false finally for from function if import in instanceof let new null of return static super switch this throw true try typeof undefined var void while yield'),
  },
  python: {
    ...HASH_COMMENTS, strings: [['"""', '"""', true], ["'''", "'''", true], ['"', '"', false], ["'", "'", false]],
    keywords: words('False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield'),
  },
  java: {
    ...C_COMMENTS, strings: [['"""', '"""', true], ['"', '"', false], ["'", "'", false]],
    keywords: words('abstract assert boolean break byte case catch char class continue default do double else enum extends false final finally float for if implements import instanceof int interface long new null package private protected public record return short static super switch this throw throws true try var void while'),
  },
  csharp: {
    ...C_COMMENTS, strings: [['"""', '"""', true], ['@"', '"', true], ['"', '"', false], ["'", "'", false]],
    keywords: words('abstract async await bool break case catch class const continue default do double else enum false finally for foreach if in int interface internal namespace new null out override private protected public readonly ref return static string struct switch this throw true try using var virtual void while'),
  },
  go: {
    ...C_COMMENTS, strings: [['`', '`', true], ['"', '"', false], ["'", "'", false]],
    keywords: words('break case chan const continue default defer else fallthrough false for func go goto if import interface map nil package range return select struct switch true type var'),
  },
  ruby: {
    line: ['#'], block: [['=begin', '=end']], strings: [['"', '"', false], ["'", "'", false]],
    keywords: words('alias and begin break case class def do else elsif end ensure false for if in module next nil not or raise redo require rescue retry return self super then true unless until when while yield'),
  },
  kotlin: {
    ...C_COMMENTS, strings: [['"""', '"""', true], ['"', '"', false], ["'", "'", false]],
    keywords: words('as break by catch class companion const continue data do else false finally for fun if import in interface is lateinit null object override package private protected public return super suspend this throw true try typealias val var when while'),
  },
  php: {
    line: ['//', '#'], block: [['/*', '*/']], strings: [['"', '"', false], ["'", "'", false]],
    keywords: words('abstract array as break case catch class const continue default do echo else elseif extends false final finally fn for foreach function if implements interface namespace new null private protected public return static switch throw true try use var while'),
  },
  robot: {
    ...HASH_COMMENTS, strings: [], keywords: words(''),
    linePrefix: ['*** Settings ***', '*** Variables ***', '*** Test Cases ***', '*** Tasks ***', '*** Keywords ***', '*** Comments ***', '[Documentation]', '[Tags]', '[Setup]', '[Teardown]', '[Template]', '[Timeout]', '[Arguments]', '[Return]', 'Library', 'Resource', 'Variables', 'Suite Setup', 'Suite Teardown', 'Test Setup', 'Test Teardown', 'FOR', 'END', 'IF', 'ELSE IF', 'ELSE', 'TRY', 'EXCEPT', 'FINALLY', 'WHILE'],
  },
  gherkin: {
    ...HASH_COMMENTS, strings: [['"""', '"""', true], ['"', '"', false]], keywords: words(''),
    linePrefix: ['Feature:', 'Rule:', 'Background:', 'Scenario Outline:', 'Scenario Template:', 'Scenario:', 'Example:', 'Examples:', 'Scenarios:', 'Given', 'When', 'Then', 'And', 'But', '*'],
  },
  plain: { line: [], block: [], strings: [], keywords: words('') },
};
LANGUAGES.typescript = {
  ...LANGUAGES.javascript,
  keywords: new Set([...LANGUAGES.javascript.keywords, ...words('abstract any as boolean declare enum implements interface keyof namespace never number private protected public readonly string type unknown')]),
};

/** The table for a language id of the report. A language with no table of its own is plain text. */
export const languageOf = (id) => (Object.hasOwn(LANGUAGES, id) ? LANGUAGES[id] : LANGUAGES.plain);

const WORD_START = /[A-Za-z_$]/;
const WORD_REST = /[A-Za-z0-9_$]/;

/**
 * Splits a whole source text into lines of tokens: `[[{ type, text }, ...], ...]`, where `type`
 * is 'keyword', 'string', 'comment' or 'plain'. A comment or string that runs over several
 * lines is cut at each line end, so every line can be shown on its own. The text of all tokens
 * of a line, joined, is that line again.
 */
export function highlightLines(source, languageId) {
  const language = languageOf(languageId);
  const lines = [[]];
  const push = (type, text) => {
    const parts = text.split('\n');
    parts.forEach((part, index) => {
      if (index > 0) lines.push([]);
      if (part === '') return;
      const line = lines[lines.length - 1];
      const last = line[line.length - 1];
      if (last && last.type === type) last.text += part;
      else line.push({ type, text: part });
    });
  };
  const startsWith = (text, at) => source.startsWith(text, at);
  const lineEnd = (from) => {
    const end = source.indexOf('\n', from);
    return end === -1 ? source.length : end;
  };

  let at = 0;
  let lineStart = true;
  while (at < source.length) {
    const char = source[at];
    if (char === '\n') {
      push('plain', char);
      at += 1;
      lineStart = true;
      continue;
    }
    if (lineStart && (char === ' ' || char === '\t')) {
      push('plain', char);
      at += 1;
      continue;
    }
    if (lineStart && language.linePrefix) {
      // `Given` is a keyword, the first word of `Givenness` is not.
      const prefix = language.linePrefix.find((word) => startsWith(word, at) && !(/[A-Za-z]$/.test(word) && WORD_REST.test(source[at + word.length] ?? '')));
      if (prefix) {
        push('keyword', prefix);
        at += prefix.length;
        lineStart = false;
        continue;
      }
    }
    lineStart = false;
    const block = language.block.find(([open]) => startsWith(open, at));
    if (block) {
      const close = source.indexOf(block[1], at + block[0].length);
      const end = close === -1 ? source.length : close + block[1].length;
      push('comment', source.slice(at, end));
      at = end;
      continue;
    }
    if (language.line.some((mark) => startsWith(mark, at))) {
      const end = lineEnd(at);
      push('comment', source.slice(at, end));
      at = end;
      continue;
    }
    const string = language.strings.find(([open]) => startsWith(open, at));
    if (string) {
      const [open, close, multiline] = string;
      let end = at + open.length;
      const limit = multiline ? source.length : lineEnd(at);
      // A backslash takes the next character with it, so an escaped quote does not end the string.
      while (end < limit && !startsWith(close, end)) end += source[end] === '\\' && open !== '@"' ? 2 : 1;
      end = Math.min(end < limit ? end + close.length : limit, source.length);
      push('string', source.slice(at, end));
      at = end;
      continue;
    }
    if (WORD_START.test(char)) {
      let end = at + 1;
      while (end < source.length && WORD_REST.test(source[end])) end += 1;
      const word = source.slice(at, end);
      // `obj.class` or `$this->new` is a name, not a keyword.
      push(language.keywords.has(word) && source[at - 1] !== '.' ? 'keyword' : 'plain', word);
      at = end;
      continue;
    }
    push('plain', char);
    at += 1;
  }
  return lines;
}
