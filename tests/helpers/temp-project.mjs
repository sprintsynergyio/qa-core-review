// Reviews a small project written by the test, for rule tests that need a few exact lines.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveConfig, runReview } from '../../dist/index.js';

/**
 * Writes `files` (path to source) into a temp folder, reviews it, and returns the report with
 * `lines`: every finding as 'file:line RULE level: message'.
 */
export async function reviewFiles(files, { dependencies = {}, config = {} } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcr-project-'));
  try {
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ devDependencies: dependencies }));
    for (const [file, source] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
      fs.writeFileSync(path.join(dir, file), source.replace(/^\n/, ''));
    }
    const { report } = await runReview({ root: dir, config: resolveConfig(config).config, git: false });
    const lines = report.findings.map((finding) => `${finding.location.file}:${finding.location.startLine} ${finding.ruleId.slice(4)} ${finding.severity}: ${finding.message}`);
    return { report, lines, findings: report.findings };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
