// File discovery: which files will be reviewed, by which adapter, in which project
// (SPEC.md Sections 7.1 and 7.4).
import fs from 'node:fs';
import path from 'node:path';
import { builtinProfiles } from '../adapters/index.js';
import { languageHintFor } from '../adapters/generic/languages.js';
import type { AdapterProfile, DetectedProject, SourceFile } from '../adapters/types.js';
import { DEFAULT_EXCLUDE } from '../config/defaults.js';
import type { ResolvedConfig } from '../config/types.js';
import { applyOverrides, detectProjects, nearestOverride, nearestProject } from '../detect/projects.js';
import type { LanguageId } from '../model/types.js';
import { toLf } from '../parse/positions.js';
import { gitListFiles } from '../util/git.js';
import { createGlobMatcher, matchGlob } from '../util/glob.js';

export interface FileList {
  /** Root-relative paths with '/' separators, sorted. */
  files: string[];
  /** 'git': tracked and untracked files that are not ignored. 'walk': a directory walk. */
  source: 'git' | 'walk';
}

/** Every file under `dir`, skipping the default excludes and `.git`. Links are not followed. */
function walk(root: string): string[] {
  const excluded = createGlobMatcher(DEFAULT_EXCLUDE);
  const files: string[] = [];
  const visit = (dir: string, prefix: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix + entry.name;
      if (entry.isDirectory()) {
        // Ask about a file inside the folder, so `**/node_modules/**` prunes the whole folder.
        if (entry.name !== '.git' && !excluded(`${rel}/x`)) visit(path.join(dir, entry.name), `${rel}/`);
      } else if (entry.isFile() && !excluded(rel)) {
        files.push(rel);
      }
    }
  };
  visit(root, '');
  return files;
}

/**
 * The files under the root. Inside a git repo this is what git lists (so ignored files are left
 * out). Elsewhere, or with `git: false`, it is a directory walk with the default excludes.
 */
export function listFiles(root: string, options: { git?: boolean } = {}): FileList {
  const fromGit = options.git === false ? null : gitListFiles(root);
  const files = fromGit ?? walk(root);
  return { files: files.sort(), source: fromGit ? 'git' : 'walk' };
}

export interface DiscoveredFile {
  /** Root-relative, with '/' separators. */
  path: string;
  adapterId: string;
  language: LanguageId;
  /** For generic files: 'scala', 'rust', and so on. */
  languageHint: string | null;
  /** The nearest project of the file's adapter, after config overrides. Null when there is none. */
  project: DetectedProject | null;
}

export interface Discovery {
  root: string;
  fileSource: 'git' | 'walk';
  projects: DetectedProject[];
  /** Sorted by path. */
  files: DiscoveredFile[];
}

/** Larger files are not reviewed: they are generated or data, not tests someone reads. */
export const MAX_SOURCE_BYTES = 1_000_000;

/**
 * Reads a discovered file for its adapter: LF-normalized text, without a byte order mark.
 * Returns null when the file is larger than MAX_SOURCE_BYTES or cannot be read.
 */
export function readSourceFile(root: string, found: DiscoveredFile): SourceFile | null {
  const absPath = path.join(root, found.path);
  try {
    if (fs.statSync(absPath).size > MAX_SOURCE_BYTES) return null;
    return { path: found.path, absPath, text: toLf(fs.readFileSync(absPath, 'utf8')), language: found.language, project: found.project };
  } catch {
    return null;
  }
}

export interface DiscoverOptions {
  profiles?: readonly AdapterProfile[];
  /** Pass false to skip git and walk the directory. */
  git?: boolean;
}

/** Detects the projects under the root and picks the files to review. Reads files, runs nothing. */
export function discover(root: string, config: ResolvedConfig, options: DiscoverOptions = {}): Discovery {
  const profiles = options.profiles ?? builtinProfiles;
  const listed = listFiles(root, options);
  const excluded = createGlobMatcher(config.exclude);
  const all = listed.files.filter((file) => !excluded(file));
  const projects = applyOverrides(detectProjects(root, all, profiles), config.projects, profiles);

  const staticProfiles = profiles.filter((profile) => profile.id !== 'generic');
  const generic = profiles.find((profile) => profile.id === 'generic') ?? null;
  // `include` in the config replaces the default include globs of every adapter.
  const configInclude = config.include ? createGlobMatcher(config.include) : null;
  const included = new Map(profiles.map((profile) => [profile.id, configInclude ?? createGlobMatcher(profile.defaultInclude)]));
  const adapterExcluded = new Map(profiles.map((profile) => [profile.id, createGlobMatcher(profile.defaultExclude)]));
  const wanted = (language: LanguageId): boolean => config.languages === 'auto' || config.languages.includes(language);

  const files: DiscoveredFile[] = [];
  for (const file of all) {
    const lower = file.toLowerCase();
    const override = nearestOverride(config.projects, file);
    if (override?.exclude && createGlobMatcher(override.exclude)(file)) continue;
    const extra = override?.include ? createGlobMatcher(override.include)(file) : false;

    const claimed = staticProfiles.filter((profile) => profile.extensions.some((extension) => lower.endsWith(extension)));
    if (claimed.length > 0) {
      // A `projects` entry with a language limits its folder to that language.
      const profile = claimed.find((candidate) => !override?.language || candidate.languages.includes(override.language));
      if (!profile || adapterExcluded.get(profile.id)!(file)) continue;
      if (!included.get(profile.id)!(file) && !extra) continue;
      const language = profile.languageOf(file);
      if (wanted(language)) files.push({ path: file, adapterId: profile.id, language, languageHint: null, project: nearestProject(projects, profile.id, file) });
      continue;
    }

    // No static adapter knows this extension: a `generic` config entry, or a common test name.
    if (!generic || override?.language || !wanted('generic')) continue;
    const entry = config.generic.find((candidate) => matchGlob(candidate.glob, file));
    const hint = entry ? entry.language : languageHintFor(file);
    if (entry || (hint !== null && (included.get(generic.id)!(file) || extra))) {
      files.push({ path: file, adapterId: generic.id, language: 'generic', languageHint: hint, project: null });
    }
  }

  return { root, fileSource: listed.source, projects, files };
}
