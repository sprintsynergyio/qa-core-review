# Adapters

A language adapter turns a test file into the normalized test model. Rules read only that model, so a rule written once works for every language. This page describes how adapters are built. The sections on writing a new adapter are added as the adapters land.

## Parsing

### One parser for every language

Files are parsed with [tree-sitter](https://tree-sitter.github.io/tree-sitter/) compiled to WebAssembly (`web-tree-sitter`), plus one grammar `.wasm` file per language in `grammars/`. Nothing is compiled when you install the tool, and no Python, JDK or other toolchain is ever run. The same files work on Linux, macOS and Windows.

The parser service is `createTreeSitterService()` in `src/parse/treesitter.ts`:

| Method | What it does |
| --- | --- |
| `parse(grammar, text)` | Parses LF-normalized text. Returns the tree, or `null` when the grammar cannot be loaded. |
| `parseForReview(grammar, text)` | Like `parse`, and also decides whether the file must go to the lexical scanner (see "Fallback order"). |
| `query(grammar, source)` | Compiles a tree-sitter query (`.scm` source) once and caches it. |
| `loadedGrammars()`, `loadError(grammar)` | What has been loaded, and why a grammar failed to load. |

The parser runtime starts on first use. A grammar is loaded the first time a file of that language is parsed, then kept for the life of the process. Reviewing one Python file loads only the Python grammar.

A tree lives in WebAssembly memory. Call `tree.delete()` when you are done with it.

### Vendored grammars

| Grammar id | Languages | Source package |
| --- | --- | --- |
| `javascript` | JavaScript and JSX | `tree-sitter-javascript` |
| `typescript` | TypeScript | `tree-sitter-typescript` |
| `tsx` | TSX | `tree-sitter-typescript` |
| `python` | Python | `tree-sitter-python` |
| `java` | Java | `tree-sitter-java` |

`grammars/manifest.json` is the source of truth. For each grammar it records the npm package and exact version, the integrity hash of the package tarball, the source repository, the license, the ABI version, the size and the sha256 of the `.wasm` file. It also records the `web-tree-sitter` version and the ABI range that version accepts. `grammars/LICENSES.md` holds the license text of every vendored grammar. Only MIT, Apache-2.0 and BSD grammars may be vendored.

The `.wasm` files are the prebuilt ones that the official grammar packages publish on npm, copied unchanged. They are not compiled in this repo, so there is no Emscripten or Docker step and no second build to trust.

`npm test` checks every file against the manifest (size, sha256, ABI) and loads and parses a sample with each grammar on every OS in CI.

To update or add a grammar, run this by hand (it needs the network; nothing in `npm ci` or `npm test` does):

1. Edit `grammars/manifest.json`: change the `version` and set `integrity` to `null`. For a new grammar, add an entry with `id`, `file`, `package`, `version`, `sourceFile` and `"integrity": null`.
2. Run `node scripts/build-grammars.mjs`. It downloads the pinned package, checks the tarball hash, checks the license and the ABI, copies the `.wasm`, and rewrites the manifest and `LICENSES.md`.
3. Run `npm test`.
4. Commit the changed files, and say in the pull request what changed and why.

When `web-tree-sitter` itself is updated, run the same script. It fails if any grammar's ABI falls outside the range the new runtime accepts.

### Fallback order

1. **The tree.** A file with a syntax error still gives a tree. The broken part becomes `ERROR` nodes and the rest of the file is reviewed as usual.
2. **The lexical scanner.** `parseForReview` returns no tree, and a reason, in two cases: the grammar is missing or cannot be loaded (`grammar-unavailable`), or `ERROR` nodes cover more than 30% of the file's text (`too-many-errors`). The adapter then uses the lexical scanner in `src/parse/lexical.ts`, marks the file as partly parsed, and declares a smaller set of capabilities, so only the rules that the scanner can support run, at low confidence.
3. **The generic adapter.** If that also fails, the file gets `QCR-X001` and is handed to the generic adapter.

One thing to know about the 30% rule: tree-sitter sometimes wraps a large region in a single `ERROR` node for a small mistake, such as a missing closing brace at the end of a class. Such a file can cross the limit and go to the scanner even though only one character is wrong.

### The lexical scanner

The scanner knows three things about a language: its line comment markers, its block comment pairs and its string delimiters. `segments(text, syntax)` splits a file into code, string and comment pieces. `scanLines(text, syntax)` gives each line in three views with identical columns:

| Field | Content |
| --- | --- |
| `text` | The line as written. |
| `code` | Comments replaced by spaces. Strings kept. |
| `codeNoStrings` | Comments and the content of strings replaced by spaces. String delimiters kept. |

Line patterns are matched against `codeNoStrings`, so `time.sleep(3)` inside a comment or a string is not reported as a sleep. Each line also lists its comments with their columns, which is how suppression comments are found.

Ready-made syntaxes exist for JavaScript and TypeScript (`JS_LEXICAL`), Python (`PYTHON_LEXICAL`) and Java (`JAVA_LEXICAL`). `lexicalSyntaxFor(commentSyntax)` builds one for any other language from its comment markers.

The scanner is simple on purpose. Two known limits: a JavaScript regex literal that contains a quote character, and a template literal with a backtick inside `${...}`, are read wrong. Findings from the scanner are always low confidence.

### Positions

- Lines and columns are 1-based.
- Text is LF-normalized before parsing (`toLf` removes a byte order mark and turns CRLF into LF), so positions are the same on every OS.
- Columns count UTF-16 code units, the unit of JavaScript strings.
- The end of a span is exclusive: `endColumn` is the column just after the last character.

`spanOfNode(node)` converts a syntax node to a span. `LineIndex` converts character offsets to lines and columns for code that works without a tree.

### Assets

Grammars, schemas and the other files that ship next to the code are read only through `src/assets.ts` (`readAsset('grammars/python.wasm')`), by name, as bytes. The parser is given bytes, never a file path. This is what lets the standalone binary carry its grammars inside the executable.
