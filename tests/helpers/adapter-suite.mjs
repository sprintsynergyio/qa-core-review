// Shared pieces for adapter tests (SPEC.md Section 17, item 2): run an adapter over a fixture
// folder exactly as a review would (detect, discover, read, parse, normalize), and tell
// whether a model fills a capability.
import fs from 'node:fs';
import path from 'node:path';
import { createTreeSitterService, discover, readSourceFile, resolveConfig } from '../../dist/index.js';
import { repoRoot } from './schema.mjs';

/** The context an adapter gets. One parser service is shared, like in a real run. */
export function adapterContext(config = {}) {
  return { config: resolveConfig(config).config, helperIndex: { has: () => false, get: () => [] }, parser: sharedParser };
}
const sharedParser = createTreeSitterService();

export const fixtureRoot = (...segments) => path.join(repoRoot, 'fixtures', ...segments);

/** The framework folders of an adapter's golden fixtures: fixtures/adapters/<adapter>/<framework>. */
export function frameworkFolders(adapterId) {
  const base = fixtureRoot('adapters', adapterId);
  return fs.readdirSync(base, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}

/** Normalizes every file of one adapter under a project root. Returns [{ file, source, model }]. */
export async function normalizeProject(adapter, root, config = {}) {
  const ctx = adapterContext(config);
  const found = discover(root, ctx.config, { git: false });
  const results = [];
  for (const file of found.files.filter((candidate) => candidate.adapterId === adapter.id)) {
    const source = readSourceFile(root, file);
    const parsed = await adapter.parse(source, ctx);
    results.push({ file: file.path, source, model: adapter.normalize(parsed, ctx) });
    parsed.tree?.delete();
  }
  return results;
}

/** Normalizes one piece of source text, as if it were the file `relPath` in a project. */
export async function normalizeText(adapter, relPath, text, { project = null, config = {}, parser } = {}) {
  const ctx = { ...adapterContext(config), ...(parser ? { parser } : {}) };
  const source = { path: relPath, absPath: `/virtual/${relPath}`, text, language: adapter.languageOf(relPath), project };
  const parsed = await adapter.parse(source, ctx);
  const model = adapter.normalize(parsed, ctx);
  parsed.tree?.delete();
  return model;
}

const everyTest = (model) => model.tests;
const everyHook = (model) => {
  const hooks = [...model.fileHooks];
  const collect = (suites) => suites.forEach((suite) => { hooks.push(...suite.hooks); collect(suite.suites); });
  collect(model.suites);
  return hooks;
};

/** For each capability: does this model hold at least one fact of that kind? */
const FILLED = {
  tests: (model) => model.tests.length > 0,
  suites: (model) => model.suites.length > 0,
  hooks: (model) => everyHook(model).length > 0,
  modifiers: (model) => everyTest(model).some((test) => test.modifiers.length > 0 || test.skip !== null),
  parameterized: (model) => everyTest(model).some((test) => test.parameterized !== null),
  assertions: (model) => everyTest(model).some((test) => test.assertions.length > 0),
  'assertion-operands': (model) => everyTest(model).some((test) => test.assertions.some((assertion) => assertion.actual !== null)),
  waits: (model) => everyTest(model).some((test) => test.waits.length > 0),
  selectors: (model) => everyTest(model).some((test) => test.selectors.length > 0),
  'try-blocks': (model) => everyTest(model).some((test) => test.tryBlocks.length > 0),
  mocks: (model) => model.fileMocks.length > 0 || everyTest(model).some((test) => test.mocks.length > 0),
  subject: (model) => model.subject !== null,
  network: (model) => [...model.fileMocks, ...everyTest(model).flatMap((test) => test.mocks)].some((mock) => mock.kind === 'network'),
  data: (model) => everyTest(model).some((test) => test.data.length > 0),
  resources: (model) => model.fileResources.length > 0 || everyTest(model).some((test) => test.resources.length > 0),
  'body-hash': (model) => everyTest(model).some((test) => test.bodyHash !== null),
  helpers: (model) => everyTest(model).some((test) => test.assertions.some((assertion) => assertion.viaHelper !== null)),
  reachability: (model) => everyTest(model).some((test) => test.assertions.some((assertion) => !assertion.reachable)),
};

export function capabilityFilled(capability, model) {
  return FILLED[capability](model);
}
