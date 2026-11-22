// The output of `qa-core-review detect`: what was found and what will be reviewed.
// `schemas/detect.schema.json` describes the JSON form.
import { builtinProfiles } from '../adapters/index.js';
import type { AdapterProfile } from '../adapters/types.js';
import type { Discovery } from '../discover/files.js';
import type { FrameworkId, LanguageId, Tier } from '../model/types.js';
import { VERSION } from '../version.js';

export interface DetectReport {
  tool: { name: 'qa-core-review'; version: string };
  /** Absolute path, for display only. */
  root: string;
  fileSource: 'git' | 'walk';
  /** The config file used, relative to the root when it is inside it, or null for the defaults. */
  config: string | null;
  projects: Array<{ dir: string; adapter: string; languages: LanguageId[]; frameworks: FrameworkId[]; evidence: string[]; testFiles: number }>;
  /** Test files per adapter. `languages` counts them per language (per language hint for generic). */
  adapters: Array<{ id: string; tier: Tier; testFiles: number; languages: Record<string, number> }>;
  testFiles: number;
}

export function buildDetectReport(discovery: Discovery, config: string | null, profiles: readonly AdapterProfile[] = builtinProfiles): DetectReport {
  const adapters: DetectReport['adapters'] = [];
  for (const profile of profiles) {
    const files = discovery.files.filter((file) => file.adapterId === profile.id);
    if (files.length === 0) continue;
    const languages: Record<string, number> = {};
    for (const file of files) {
      const name = file.languageHint ?? file.language;
      languages[name] = (languages[name] ?? 0) + 1;
    }
    adapters.push({ id: profile.id, tier: profile.tier, testFiles: files.length, languages });
  }
  return {
    tool: { name: 'qa-core-review', version: VERSION },
    root: discovery.root.split('\\').join('/'),
    fileSource: discovery.fileSource,
    config,
    projects: discovery.projects.map((project) => ({
      dir: project.dir,
      adapter: project.adapterId,
      languages: project.languages,
      frameworks: project.frameworks,
      evidence: project.evidence,
      testFiles: discovery.files.filter((file) => file.project === project).length,
    })),
    adapters,
    testFiles: discovery.files.length,
  };
}

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;

export function formatDetectPretty(report: DetectReport): string {
  const lines = [
    `Root: ${report.root}`,
    `Files: ${report.fileSource === 'git' ? 'from git (ignored files are left out)' : 'from a directory walk'}`,
    `Config: ${report.config ?? 'none (defaults)'}`,
    '',
  ];

  lines.push(`Projects (${report.projects.length})`);
  if (report.projects.length === 0) lines.push('  none found');
  for (const project of report.projects) {
    lines.push(`  ${project.dir}  [${project.adapter}]  ${project.frameworks.join(', ') || 'no framework found'}`);
    for (const evidence of project.evidence) lines.push(`      ${evidence}`);
    lines.push(`      ${plural(project.testFiles, 'test file')}`);
  }

  lines.push('', `Test files (${report.testFiles})`);
  if (report.adapters.length === 0) lines.push('  none found');
  for (const adapter of report.adapters) {
    const languages = Object.entries(adapter.languages).map(([name, count]) => `${name} ${count}`).join(', ');
    const note = adapter.id === 'generic' ? '  (no static rules yet: listed, and reviewed only with --llm)' : '';
    lines.push(`  ${adapter.id}  Tier ${adapter.tier}  ${adapter.testFiles}  ${languages}${note}`);
  }
  return `${lines.join('\n')}\n`;
}
