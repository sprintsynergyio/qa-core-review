// Marker-based project detection, shared by the adapters (SPEC.md Section 7.4).
//
// An adapter describes its frameworks as data: which files, holding which dependency names,
// show that a framework is used. This module reads those files through the probe and builds
// the detected project with its evidence. It only reads files. It never runs a build tool.
import type { AdapterProfile, DetectedProject, FrameworkDescriptor, ProjectMarker, ProjectProbe } from '../adapters/types.js';
import type { FrameworkId } from '../model/types.js';

export interface MarkerRules {
  /** Files that make a folder a project of this adapter (`package.json`, `pom.xml`). Globs allowed. */
  manifests: string[];
  /** Files that mark a project only when there is none above it (`tsconfig.json`, `conftest.py`). */
  weakManifests?: string[];
  /** The runner to assume when the manifests name none. */
  fallbackRunner?: { id: FrameworkId; evidence: string };
  /**
   * The dependency names declared in a manifest, when the file has a structure worth parsing
   * (the dependency maps of `package.json`). Null means: search the text for the name instead.
   */
  dependencyNames?(file: string, text: string): string[] | null;
}

const MAX_MANIFEST_BYTES = 512 * 1024;
const NAME_CHAR = 'A-Za-z0-9_';

/** True when `name` is in the text as a whole dependency name, not as part of a longer one. */
function textHasName(text: string, name: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^${NAME_CHAR}@/.-])${escaped}($|[^${NAME_CHAR}.-])`, 'm').test(text);
}

/** A marker name that ends in '/' is a prefix: '@wdio/' matches '@wdio/cli'. */
function listHasName(names: string[], name: string): boolean {
  return name.endsWith('/') ? names.some((entry) => entry.startsWith(name)) : names.includes(name);
}

export function detectFromMarkers(
  probe: ProjectProbe,
  profile: Pick<AdapterProfile, 'id' | 'languages' | 'frameworks'>,
  rules: MarkerRules,
): DetectedProject | null {
  const found = (pattern: string): string[] => (/[*?{]/.test(pattern) ? probe.list(pattern, 20) : probe.hasFile(pattern) ? [pattern] : []);
  const weakNames = new Set((rules.weakManifests ?? []).flatMap(found));
  const strongNames = rules.manifests.flatMap(found);
  const texts = new Map<string, string | null>();
  const read = (file: string): string | null => {
    if (!texts.has(file)) texts.set(file, probe.readText(file, MAX_MANIFEST_BYTES));
    return texts.get(file)!;
  };

  const hasMarker = (marker: ProjectMarker): string | null => {
    for (const file of found(marker.file)) {
      if (marker.contains === undefined) return file;
      const text = read(file);
      if (text === null) continue;
      const names = rules.dependencyNames?.(file, text) ?? null;
      if (names ? listHasName(names, marker.contains) : textHasName(text, marker.contains)) return `${file}: ${marker.contains}`;
    }
    return null;
  };

  const frameworks: FrameworkId[] = [];
  const evidence: string[] = [];
  let strong = strongNames.length > 0;
  for (const framework of profile.frameworks as FrameworkDescriptor[]) {
    // One line of evidence per file is enough: the first marker that matches in each.
    const lines = new Map<string, string>();
    for (const marker of framework.projectMarkers) {
      const line = hasMarker(marker);
      if (line === null) continue;
      const file = line.split(': ')[0]!;
      if (!lines.has(file)) lines.set(file, line);
      if (!weakNames.has(file)) strong = true;
    }
    if (lines.size > 0) {
      frameworks.push(framework.id);
      evidence.push(...lines.values());
    }
  }

  if (!strong && weakNames.size === 0) return null;

  const runners = new Set(profile.frameworks.filter((framework) => framework.role === 'runner').map((framework) => framework.id));
  if (rules.fallbackRunner && !frameworks.some((id) => runners.has(id))) {
    frameworks.unshift(rules.fallbackRunner.id);
    evidence.unshift(rules.fallbackRunner.evidence);
  }
  // A project with no framework still says which file made it a project.
  if (evidence.length === 0) evidence.push(...new Set([...strongNames, ...weakNames]));

  // Two frameworks can share a line (pytest-playwright proves pytest and Playwright). Show it once.
  return { dir: probe.dir, adapterId: profile.id, languages: [...profile.languages], frameworks, evidence: [...new Set(evidence)], ...(strong ? {} : { weak: true }) };
}
