// Project detection and config overrides (SPEC.md Section 7.4).
import type { AdapterProfile, DetectedProject } from '../adapters/types.js';
import type { ProjectOverride } from '../config/types.js';
import { toPosixPath } from '../util/glob.js';
import { createProbe } from './probe.js';

/** The root is '.'. Every other folder is a root-relative path with no trailing slash. */
export const ROOT_DIR = '.';

/** True when `filePath` is inside `dir` (or `dir` is the root). */
export function isUnder(filePath: string, dir: string): boolean {
  return dir === ROOT_DIR || filePath.startsWith(`${dir}/`);
}

function depth(dir: string): number {
  return dir === ROOT_DIR ? 0 : dir.split('/').length;
}

/** Deepest folder first, so the first match in a search is the nearest one. */
function byNearest<T extends { dir: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => depth(b.dir) - depth(a.dir));
}

/** The nearest project of an adapter at or above a file (or a folder, written with a trailing '/'), or null. */
export function nearestProject(projects: readonly DetectedProject[], adapterId: string, filePath: string): DetectedProject | null {
  return byNearest(projects.filter((project) => project.adapterId === adapterId)).find((project) => isUnder(filePath, project.dir)) ?? null;
}

/**
 * Asks every adapter about every folder that holds files. `files` are root-relative '/' paths.
 * A weak project (see DetectedProject.weak) is dropped when its adapter has a project above it.
 */
export function detectProjects(root: string, files: readonly string[], profiles: readonly AdapterProfile[]): DetectedProject[] {
  // Only a folder that holds a file directly can hold a manifest. Each such folder's probe sees
  // every file below it, as paths relative to that folder.
  const byDir = new Map<string, string[]>([[ROOT_DIR, []]]);
  for (const file of files) {
    if (file.includes('/')) byDir.set(file.slice(0, file.lastIndexOf('/')), []);
  }
  for (const file of files) {
    byDir.get(ROOT_DIR)!.push(file);
    for (let slash = file.indexOf('/'); slash !== -1; slash = file.indexOf('/', slash + 1)) {
      byDir.get(file.slice(0, slash))?.push(file.slice(slash + 1));
    }
  }

  const found: DetectedProject[] = [];
  for (const [dir, below] of byDir) {
    const probe = createProbe(root, dir, below);
    for (const profile of profiles) {
      const project = profile.detectProject(probe);
      if (project) found.push(project);
    }
  }

  const kept = found.filter((project) => {
    if (!project.weak) return true;
    return !found.some((other) => other !== project && other.adapterId === project.adapterId && !other.weak && isUnder(`${project.dir}/`, other.dir));
  });
  return sortProjects(kept.map(({ weak: _weak, ...project }) => project));
}

/** The root first, then folders by name, then adapters by id. */
function sortProjects(projects: DetectedProject[]): DetectedProject[] {
  const key = (project: DetectedProject): string => (project.dir === ROOT_DIR ? '' : project.dir);
  return projects.sort((a, b) => (key(a) === key(b) ? a.adapterId.localeCompare(b.adapterId) : key(a) < key(b) ? -1 : 1));
}

/** The folder of a `projects` entry, in the same form as DetectedProject.dir. */
export function overrideDir(override: ProjectOverride): string {
  const dir = toPosixPath(override.path).replace(/\/+$/, '');
  return dir === '' ? ROOT_DIR : dir;
}

/** The nearest `projects` entry at or above a file, or null. */
export function nearestOverride(overrides: readonly ProjectOverride[], filePath: string): ProjectOverride | null {
  const withDir = overrides.map((override) => ({ override, dir: overrideDir(override) }));
  return byNearest(withDir).find(({ dir }) => isUnder(filePath, dir))?.override ?? null;
}

/**
 * Applies config `projects` entries on top of detection. Each entry gives a project at its
 * `path`, so it is the nearest project for the files below it and wins over detection:
 * `runner` replaces the detected runners, `libraries` are added, `language` picks the adapter.
 */
export function applyOverrides(projects: readonly DetectedProject[], overrides: readonly ProjectOverride[], profiles: readonly AdapterProfile[]): DetectedProject[] {
  const result = [...projects];
  overrides.forEach((override, index) => {
    const dir = overrideDir(override);
    const owns = (profile: AdapterProfile, id: string | undefined): boolean => id !== undefined && profile.frameworks.some((framework) => framework.id === id);
    // Which adapters the entry is about: the one for its language, else the ones that know its
    // runner or libraries, else the ones that already have a project at or above the folder.
    let targets = override.language ? profiles.filter((profile) => profile.languages.includes(override.language!)) : [];
    if (targets.length === 0) targets = profiles.filter((profile) => owns(profile, override.runner));
    if (targets.length === 0) targets = profiles.filter((profile) => (override.libraries ?? []).some((id) => owns(profile, id)));
    if (targets.length === 0) targets = profiles.filter((profile) => nearestProject(result, profile.id, `${dir}/`) !== null);

    for (const profile of targets) {
      const at = result.findIndex((project) => project.dir === dir && project.adapterId === profile.id);
      const base = at === -1 ? null : result[at]!;
      const runners = new Set(profile.frameworks.filter((framework) => framework.role === 'runner').map((framework) => framework.id));
      const detected = (base?.frameworks ?? []).filter((id) => !(override.runner && runners.has(id)));
      const frameworks = [...new Set([...(override.runner ? [override.runner] : []), ...detected, ...(override.libraries ?? [])])];
      const project: DetectedProject = {
        dir,
        adapterId: profile.id,
        languages: override.language ? [override.language] : base?.languages ?? [...profile.languages],
        frameworks,
        evidence: [`config: projects[${index}]`, ...(base?.evidence ?? [])],
      };
      if (at === -1) result.push(project);
      else result[at] = project;
    }
  });
  return sortProjects(result);
}
