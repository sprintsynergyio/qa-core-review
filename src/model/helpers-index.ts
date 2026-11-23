// The helper index (SPEC.md Section 8.1): functions and methods that contain an assertion,
// collected by the adapters from every file of a project, support files included. A test that
// calls one of them has an assertion, with `viaHelper` set.
import type { HelperDef, HelperIndex } from '../adapters/types.js';

/** `extraNames` are the `assertionHelpers` of the config: names added by hand. */
export function createHelperIndex(helpers: readonly HelperDef[], extraNames: readonly string[] = []): HelperIndex {
  const byName = new Map<string, HelperDef[]>();
  for (const name of extraNames) byName.set(name, []);
  for (const helper of helpers) byName.set(helper.name, [...(byName.get(helper.name) ?? []), helper]);
  return { has: (name) => byName.has(name), get: (name) => byName.get(name) ?? [] };
}
