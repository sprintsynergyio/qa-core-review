// The adapter registry: which language adapters exist, and which of them claim a file.
import { CAPABILITIES, LANGUAGE_IDS } from '../model/types.js';
import { genericProfile } from './generic/languages.js';
import { javaAdapter } from './java/adapter.js';
import { javaProfile } from './java/detect.js';
import { jsAdapter } from './js/adapter.js';
import { jsProfile } from './js/detect.js';
import { pythonAdapter } from './python/adapter.js';
import { pythonProfile } from './python/detect.js';
import type { AdapterProfile, LanguageAdapter } from './types.js';

const ID_PATTERN = /^[a-z][a-z0-9-]*$/;

/** Problems that would make an adapter unsafe to register. Empty when the adapter is fine. */
export function adapterProblems(adapter: LanguageAdapter): string[] {
  const problems: string[] = [];
  if (!ID_PATTERN.test(adapter.id)) problems.push(`id "${adapter.id}" must be lower case letters, digits and dashes`);
  if (![1, 2, 3].includes(adapter.tier)) problems.push(`tier ${String(adapter.tier)} must be 1, 2 or 3`);
  if (adapter.languages.length === 0) problems.push('languages must not be empty');
  for (const language of adapter.languages) {
    if (!(LANGUAGE_IDS as readonly string[]).includes(language)) problems.push(`unknown language "${language}"`);
  }
  for (const extension of adapter.extensions) {
    if (!extension.startsWith('.') || extension !== extension.toLowerCase()) {
      problems.push(`extension "${extension}" must start with a dot and be lower case`);
    }
  }
  const seen = new Set<string>();
  for (const capability of adapter.capabilities) {
    if (!(CAPABILITIES as readonly string[]).includes(capability)) problems.push(`unknown capability "${capability}"`);
    if (seen.has(capability)) problems.push(`capability "${capability}" is listed twice`);
    seen.add(capability);
  }
  return problems;
}

export class AdapterRegistry {
  readonly #byId = new Map<string, LanguageAdapter>();

  /** Adds an adapter. Throws when the adapter is invalid or its id is taken. */
  register(adapter: LanguageAdapter): void {
    const problems = adapterProblems(adapter);
    if (this.#byId.has(adapter.id)) problems.push(`an adapter with id "${adapter.id}" is already registered`);
    if (problems.length > 0) throw new Error(`Cannot register adapter "${adapter.id}": ${problems.join('; ')}`);
    this.#byId.set(adapter.id, adapter);
  }

  get(id: string): LanguageAdapter | undefined {
    return this.#byId.get(id);
  }

  /** Every adapter, in the order they were registered. */
  list(): LanguageAdapter[] {
    return [...this.#byId.values()];
  }

  /**
   * The adapters whose extensions match the path, in registration order. The match is on the
   * end of the lower-cased path, so compound extensions such as `.postman_collection.json` work.
   * An empty list means the file goes to the generic adapter (Milestone 15).
   */
  forPath(filePath: string): LanguageAdapter[] {
    const lower = filePath.toLowerCase();
    return this.list().filter((adapter) => adapter.extensions.some((extension) => lower.endsWith(extension)));
  }
}

/**
 * The detection half of every adapter that ships with the tool: enough to find projects and
 * test files. Generic comes last, so it only gets the files no other adapter claims.
 */
export const builtinProfiles: AdapterProfile[] = [jsProfile, pythonProfile, javaProfile, genericProfile];

/** The full adapters that ship with the tool. Generic joins in a later milestone. */
export const builtinAdapters: LanguageAdapter[] = [jsAdapter, pythonAdapter, javaAdapter];

export function createRegistry(adapters: LanguageAdapter[] = builtinAdapters): AdapterRegistry {
  const registry = new AdapterRegistry();
  for (const adapter of adapters) registry.register(adapter);
  return registry;
}
