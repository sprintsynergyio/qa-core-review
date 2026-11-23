// Normalizes one file in a fresh process and prints the time since the process started.
// Usage: node tests/helpers/normalize-once.mjs <adapter id> <file>
import fs from 'node:fs';
import path from 'node:path';
import { builtinAdapters, createTreeSitterService, resolveConfig, toLf } from '../../dist/index.js';

const [adapterId, file] = process.argv.slice(2);
const adapter = builtinAdapters.find((candidate) => candidate.id === adapterId);
const ctx = { config: resolveConfig({}).config, helperIndex: { has: () => false, get: () => [] }, parser: createTreeSitterService() };
const name = path.basename(file);
const source = { path: name, absPath: file, text: toLf(fs.readFileSync(file, 'utf8')), language: adapter.languageOf(name), project: null };
const model = adapter.normalize(await adapter.parse(source, ctx), ctx);
console.log(JSON.stringify({ ms: performance.now(), tests: model.tests.length, parseStatus: model.parseStatus }));
