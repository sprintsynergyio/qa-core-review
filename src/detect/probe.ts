// A read-only view of one folder for project detection (SPEC.md Section 7.4).
// The probe answers from the list of files that discovery already has, and reads a file's text
// only when a detector asks for it. It cannot run anything.
import fs from 'node:fs';
import path from 'node:path';
import type { ProjectProbe } from '../adapters/types.js';
import { createGlobMatcher } from '../util/glob.js';

/**
 * @param root absolute path of the project root
 * @param dir root-relative folder with '/' separators, '.' for the root itself
 * @param below the files under `dir`, as paths relative to `dir`
 */
export function createProbe(root: string, dir: string, below: readonly string[]): ProjectProbe {
  const direct = new Set(below.filter((file) => !file.includes('/')));
  return {
    dir,
    hasFile: (name) => direct.has(name),
    readText(name, maxBytes = 256 * 1024) {
      try {
        const handle = fs.openSync(path.join(root, dir, name), 'r');
        try {
          const buffer = Buffer.alloc(Math.min(fs.fstatSync(handle).size, maxBytes));
          return buffer.toString('utf8', 0, fs.readSync(handle, buffer, 0, buffer.length, 0));
        } finally {
          fs.closeSync(handle);
        }
      } catch {
        return null;
      }
    },
    list(globPattern, limit) {
      const matches = createGlobMatcher([globPattern]);
      return below.filter(matches).slice(0, limit);
    },
  };
}
