// Writes the rule support matrix into docs/rules.md, between the two marker comments.
//
// The matrix has one row per rule and one column per Tier 1 language. A cell says "yes" when
// the adapter of that language fills in every capability the rule needs, "no" when it lacks
// one, and "planned" when the adapter is not built yet. It is made from the code, so it cannot
// go stale: `npm run lint` runs this script with --check and fails when the file is behind.
//
// Usage: node scripts/gen-support-matrix.mjs [--check] [--file <path>]
// Needs dist/ (run `npm run build` first).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const check = args.includes('--check');
const file = path.resolve(args.includes('--file') ? args[args.indexOf('--file') + 1] : path.join(repoRoot, 'docs/rules.md'));

const START = '<!-- support-matrix:start -->';
const END = '<!-- support-matrix:end -->';
const NAMES = { javascript: 'JavaScript', typescript: 'TypeScript', python: 'Python', java: 'Java' };

const { builtinAdapters, builtinProfiles, builtinRules } = await import(new URL('../dist/index.js', import.meta.url).href);

function supportMatrix() {
  const columns = builtinProfiles.filter((profile) => profile.tier === 1).map((profile) => ({
    title: profile.languages.map((language) => NAMES[language] ?? language).join(', '),
    capabilities: builtinAdapters.find((adapter) => adapter.id === profile.id)?.capabilities ?? null,
  }));
  const cell = (rule, capabilities) => (capabilities === null ? 'planned' : rule.requires.every((need) => capabilities.includes(need)) ? 'yes' : 'no');
  const rows = builtinRules.map((rule) => [`[${rule.id}](#${rule.id.toLowerCase()})`, rule.requires.join(', ') || 'none', ...columns.map((column) => cell(rule, column.capabilities))]);
  const header = ['Rule', 'Needs from the adapter', ...columns.map((column) => column.title)];
  return [header, header.map(() => '---'), ...rows].map((row) => `| ${row.join(' | ')} |`).join('\n');
}

const before = fs.readFileSync(file, 'utf8');
const from = before.indexOf(START);
const to = before.indexOf(END);
if (from === -1 || to === -1 || to < from) {
  console.error(`${path.relative(repoRoot, file)} has no ${START} and ${END} markers.`);
  process.exit(2);
}
const after = `${before.slice(0, from + START.length)}\n${supportMatrix()}\n${before.slice(to)}`;
if (after === before) {
  console.log(`support matrix ok (${builtinRules.length} rules)`);
} else if (check) {
  console.error(`${path.relative(repoRoot, file)} is behind the code. Run: npm run build && node scripts/gen-support-matrix.mjs`);
  process.exit(1);
} else {
  fs.writeFileSync(file, after);
  console.log(`support matrix written (${builtinRules.length} rules)`);
}
