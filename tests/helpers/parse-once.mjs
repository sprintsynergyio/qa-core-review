// Parses one file in a fresh process and prints the time since the process started, so the
// number includes Node startup, loading the parser runtime, loading the grammar and the parse.
// Usage: node tests/helpers/parse-once.mjs <grammar> <file>
import fs from 'node:fs';
import { createTreeSitterService, toLf } from '../../dist/index.js';

const [grammar, file] = process.argv.slice(2);
const text = toLf(fs.readFileSync(file, 'utf8'));
const service = createTreeSitterService();
const result = await service.parseForReview(grammar, text);
const ms = performance.now();

console.log(JSON.stringify({
  ms,
  lines: text.split('\n').length,
  fallback: result.fallback,
  hasError: result.tree ? result.tree.rootNode.hasError : null,
  topLevelNodes: result.tree ? result.tree.rootNode.namedChildCount : 0,
}));
