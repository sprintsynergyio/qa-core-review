// A small glob matcher (SPEC.md Section 7.6). `fs.glob` is not stable on Node 22.6, and the
// tool only needs to match paths it already has, never to walk the disk from a pattern.
//
// Supported: `**` (any number of folders), `*` (anything but '/'), `?` (one character but '/'),
// `{a,b}` (alternatives, may nest and may hold other patterns), and `\` to escape a character.
// Everything else is literal, including `[` and `]`. Matching is case-sensitive, and a `*`
// also matches names that start with a dot. Paths are root-relative with '/' separators;
// Windows-style input paths are accepted and converted.

/** `src\test\a.ts` and `./src//test/a.ts` both become `src/test/a.ts`. */
export function toPosixPath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/^(\.\/)+/, '');
}

const REGEX_SPECIAL = /[.*+?^${}()|[\]\\/]/;

/** The index of the `}` that closes the `{` at `open`, or -1. */
function closingBrace(glob: string, open: number): number {
  let depth = 0;
  for (let i = open; i < glob.length; i += 1) {
    if (glob[i] === '\\') i += 1;
    else if (glob[i] === '{') depth += 1;
    else if (glob[i] === '}' && (depth -= 1) === 0) return i;
  }
  return -1;
}

/** Splits `a,b{c,d},e` on the commas that are not inside nested braces. */
function splitAlternatives(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < body.length; i += 1) {
    if (body[i] === '\\') i += 1;
    else if (body[i] === '{') depth += 1;
    else if (body[i] === '}') depth -= 1;
    else if (body[i] === ',' && depth === 0) {
      parts.push(body.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(body.slice(start));
  return parts;
}

/** `atStart` says whether the pattern begins at the start of a path segment. */
function convert(glob: string, atStart: boolean): string {
  let out = '';
  let i = 0;
  while (i < glob.length) {
    const char = glob[i]!;
    const segmentStart = i === 0 ? atStart : glob[i - 1] === '/';
    if (char === '\\' && i + 1 < glob.length) {
      out += glob[i + 1]!.replace(REGEX_SPECIAL, '\\$&');
      i += 2;
    } else if (char === '*' && glob[i + 1] === '*') {
      let end = i + 2;
      while (glob[end] === '*') end += 1;
      if (segmentStart && glob[end] === '/') {
        out += '(?:[^/]+/)*'; // `**/`: zero or more folders
        i = end + 1;
      } else {
        out += segmentStart && end === glob.length ? '.*' : '[^/]*'; // a trailing `**`, or `a**b`
        i = end;
      }
    } else if (char === '*') {
      out += '[^/]*';
      i += 1;
    } else if (char === '?') {
      out += '[^/]';
      i += 1;
    } else if (char === '{' && closingBrace(glob, i) !== -1) {
      const close = closingBrace(glob, i);
      const alternatives = splitAlternatives(glob.slice(i + 1, close));
      out += `(?:${alternatives.map((alternative) => convert(alternative, segmentStart)).join('|')})`;
      i = close + 1;
    } else {
      out += char.replace(REGEX_SPECIAL, '\\$&');
      i += 1;
    }
  }
  return out;
}

const cache = new Map<string, RegExp>();

/** The regular expression for a glob. It matches a whole root-relative '/' path. */
export function globToRegExp(glob: string): RegExp {
  let compiled = cache.get(glob);
  if (!compiled) {
    compiled = new RegExp(`^${convert(toPosixGlob(glob), true)}$`);
    cache.set(glob, compiled);
  }
  return compiled;
}

/** A leading `./` on a pattern means nothing. Backslashes are kept: in a pattern they escape. */
function toPosixGlob(glob: string): string {
  return glob.replace(/^(\.\/)+/, '');
}

export function matchGlob(glob: string, filePath: string): boolean {
  return globToRegExp(glob).test(toPosixPath(filePath));
}

/** A function that tells whether a path matches at least one of the globs. */
export function createGlobMatcher(globs: readonly string[]): (filePath: string) => boolean {
  const compiled = globs.map(globToRegExp);
  return (filePath) => {
    const normalized = toPosixPath(filePath);
    return compiled.some((pattern) => pattern.test(normalized));
  };
}
