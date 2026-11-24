// Rule fixtures (SPEC.md Section 10.0). Every folder fixtures/rules/<rule id>/<language>-<framework>/
// is a small project with a bad/ and a good/ folder. A bad file marks each expected finding
// with a trailing comment on the line where it starts: `// expect: QCR-A002` or
// `# expect: QCR-A002`, with several ids comma separated. A format with no comments uses a
// sidecar `<file>.expect.json`: [{ "ruleId": "QCR-A001", "line": 12 }]. Good files have no marker.
import fs from 'node:fs';
import path from 'node:path';
import { resolveConfig, runReview } from '../../dist/index.js';
import { repoRoot } from './schema.mjs';

const MARKER = /(?:\/\/|#)\s*expect:\s*(QCR-[A-Z]\d{3}(?:\s*,\s*QCR-[A-Z]\d{3})*)\s*$/;
const rulesRoot = path.join(repoRoot, 'fixtures', 'rules');

/** [{ ruleId, name, dir }] for every fixture folder, sorted. */
export function ruleFixtureFolders() {
  return fs.readdirSync(rulesRoot).sort().flatMap((ruleId) => fs.readdirSync(path.join(rulesRoot, ruleId)).sort()
    .map((name) => ({ ruleId, name, dir: path.join(rulesRoot, ruleId, name) })));
}

/** The markers of one file as sorted "QCR-A001@12" strings. */
export function expectedIn(file) {
  const sidecar = `${file}.expect.json`;
  if (fs.existsSync(sidecar)) return JSON.parse(fs.readFileSync(sidecar, 'utf8')).map((entry) => `${entry.ruleId}@${entry.line}`).sort();
  return fs.readFileSync(file, 'utf8').split('\n').flatMap((line, index) => (MARKER.exec(line.trimEnd())?.[1].split(',') ?? []).map((id) => `${id.trim()}@${index + 1}`)).sort();
}

/**
 * Reviews one fixture folder with every rule and the default config. Returns the files under
 * bad/ and good/ as { file, expected, actual }, both lists sorted, plus the whole report.
 */
export async function runRuleFixtures(dir, config = {}) {
  const { report } = await runReview({ root: dir, config: resolveConfig(config).config, git: false });
  const entries = report.files.filter((file) => /^(bad|good)\//.test(file.file)).map((file) => ({
    file: file.file,
    expected: expectedIn(path.join(dir, file.file)),
    actual: report.findings.filter((finding) => finding.location.file === file.file).map((finding) => `${finding.ruleId}@${finding.location.startLine}`).sort(),
  }));
  return { report, bad: entries.filter((entry) => entry.file.startsWith('bad/')), good: entries.filter((entry) => entry.file.startsWith('good/')) };
}
