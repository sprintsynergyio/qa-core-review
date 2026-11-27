// The `rules`, `explain`, `adapters` and `init` commands (SPEC.md Section 11.1), run on dist/cli.js.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { CAPABILITIES, builtinProfiles, builtinRules, defaultConfigFile, javaAdapter, loadConfig, pythonAdapter, resolveConfig } from '../dist/index.js';
import { repoRoot } from './helpers/schema.mjs';

const run = (args, cwd = repoRoot) => spawnSync(process.execPath, [path.join(repoRoot, 'dist', 'cli.js'), ...args], { cwd, encoding: 'utf8', windowsHide: true, shell: false });
const ok = (args, cwd) => {
  const ran = run(args, cwd);
  assert.deepEqual([ran.status, ran.stderr], [0, ''], args.join(' '));
  return ran.stdout;
};
const usageError = (args, message, cwd) => {
  const ran = run(args, cwd);
  assert.deepEqual([ran.status, ran.stdout], [2, ''], args.join(' '));
  assert.match(ran.stderr, message, args.join(' '));
  assert.match(ran.stderr, /\nRun qa-core-review --help\n$/);
};

test('rules lists every rule with its severity, scope and description', () => {
  const lines = ok(['rules']).split('\n');
  assert.match(lines[0], /^Id +Name +Severity +Scope +Description$/);
  assert.deepEqual(lines.slice(1, 1 + builtinRules.length).map((line) => line.split(/ {2,}/)), builtinRules.map((rule) => [rule.id, rule.name, rule.defaultSeverity, rule.scope, rule.description]));
  assert.deepEqual(lines.slice(-3), ['', `${builtinRules.length} ${builtinRules.length === 1 ? 'rule' : 'rules'}. Run qa-core-review explain <ruleId> for more.`, '']);
  assert.ok(ok(['rules', '--language', 'python']).includes(`\n${builtinRules.length} rules for Python. `));
  assert.match(ok(['rules', '--help']), /^Usage: qa-core-review rules/);
  usageError(['rules', '--language', 'elvish'], /--language must be .*, not "elvish"/);
  usageError(['rules', 'extra'], /rules takes no arguments \(got "extra"\)/);
});

test('explain describes one rule and says how to turn it off', () => {
  assert.deepEqual(ok(['explain', 'QCR-X001']).split('\n'), [
    'QCR-X001  parse-error', '', 'A test file could not be parsed, or no test was found in a file that is named like a test file.', '',
    'Default severity: info', 'Scope: universal', 'Languages: all', 'Needs from the file: nothing',
    'Turn it off: "rules": { "QCR-X001": "off" } in the config, or --disable QCR-X001',
    'Docs: https://github.com/sprintsynergyio/qa-core-review/blob/main/docs/rules.md#qcr-x001', '',
  ]);
  assert.match(ok(['explain', 'qcr-x001', '--language', 'java']), /\nJava: the rule applies\n/);
  // A rule with fix texts also shows each sub-case with a bad and a good example in the language asked for.
  const a003 = ok(['explain', 'QCR-A003']);
  assert.ok(a003.includes("\n\nAn async assertion that is not awaited\n  Fix: Put await before the assertion, or return it from the test.\n  Bad:\n    expect(page.getByRole('button', { name: 'Checkout' })).toBeVisible();\n"));
  assert.ok(a003.includes("\n  Good:\n    await expect(page.getByRole('button', { name: 'Checkout' })).toBeVisible();\n"));
  // Seven of the eight cases have a JS/TS example. The eighth is found in Python only.
  assert.equal(a003.split('\n  Bad:\n').length - 1, 7);
  assert.ok(a003.endsWith('\n\nA truth check that is given a second value\n  Fix: Compare the two values with an equality assertion.\n  No example for TypeScript yet.\n'));
  assert.equal(ok(['explain', 'QCR-A003', '--language', 'javascript']).replace('JavaScript: the rule applies\n', '').replace('for JavaScript yet', 'for TypeScript yet'), a003);
  // Python has its own examples, and its own words for the fix where the general ones do not fit.
  const python = ok(['explain', 'QCR-A003', '--language', 'python']);
  assert.equal(python.split('\n  Bad:\n').length - 1, 8);
  assert.ok(python.includes('\n\nA truth check that is given a second value\n  Fix: Use assertEqual to compare the two values. assertTrue checks only the first one and takes the second as the failure message.\n  Bad:\n    self.assertTrue(cart.total(), 29.99)\n  Good:\n    self.assertEqual(cart.total(), 29.99)\n'));
  assert.ok(ok(['explain', 'QCR-A001', '--language', 'java']).includes('\n\nA test with no assertion\n  Fix: Add an assertion that checks the result of the action, for example the URL, a visible element or the response body.\n  No example for Java yet.\n'));
  assert.match(ok(['explain', '-h']), /^Usage: qa-core-review explain/);
  usageError(['explain'], /explain needs one rule id\. Known: QCR-A001, .*QCR-X001/);
  usageError(['explain', 'QCR-Z999'], /unknown rule id "QCR-Z999"\. Known: /);
  usageError(['explain', 'QCR-X001', 'QCR-X002'], /explain needs one rule id/);
});

test('adapters lists every adapter with its tier, languages, frameworks and capabilities', () => {
  const blocks = ok(['adapters']).trimEnd().split('\n\n');
  assert.deepEqual(blocks.map((block) => block.split('\n')[0]), builtinProfiles.map((profile) => `${profile.id}  Tier ${profile.tier}`));
  assert.deepEqual(blocks[0].split('\n').slice(1), [
    '  Languages: JavaScript, TypeScript', '  Frameworks: playwright, cypress, jest, vitest, mocha, webdriverio, node-test', '  Extensions: .js .jsx .mjs .cjs .ts .tsx .mts .cts',
    `  Capabilities: ${[...CAPABILITIES].filter((capability) => blocks[0].includes(capability)).length === CAPABILITIES.length ? blocks[0].split('Capabilities: ')[1] : 'missing'}`,
  ]);
  assert.equal(blocks[1], `python  Tier 1\n  Languages: Python\n  Frameworks: pytest, unittest, playwright-python, selenium\n  Extensions: .py\n  Capabilities: ${pythonAdapter.capabilities.join(', ')}`);
  assert.equal(blocks[2], `java  Tier 1\n  Languages: Java\n  Frameworks: junit5, junit4, testng, selenium, restassured, playwright-java, cucumber\n  Extensions: .java\n  Capabilities: ${javaAdapter.capabilities.join(', ')}`);
  assert.match(blocks.at(-1), /^generic {2}Tier 3\n[\s\S]*\n {2}Capabilities: none \(files are listed for the LLM review\)$/);
  assert.match(ok(['adapters', '--help']), /^Usage: qa-core-review adapters/);
  usageError(['adapters', 'js'], /adapters takes no arguments/);
});

test('init writes a config file with the defaults, in JSON or YAML, and does not replace one without --force', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcr-init-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const defaults = resolveConfig({}).config;
  const loaded = () => loadConfig({ root: dir });

  assert.equal(ok(['init'], dir), 'Wrote qa-core-review.config.json\n');
  const written = JSON.parse(fs.readFileSync(path.join(dir, 'qa-core-review.config.json'), 'utf8'));
  assert.deepEqual(written, { $schema: 'https://raw.githubusercontent.com/sprintsynergyio/qa-core-review/main/schemas/config.schema.json', ...defaultConfigFile() });
  assert.deepEqual([loaded().config, loaded().warnings, path.basename(loaded().file)], [defaults, [], 'qa-core-review.config.json']);

  usageError(['init'], /qa-core-review\.config\.json is already there\. Use --force to replace it/, dir);
  usageError(['init', '--config', 'yaml'], /is already there/, dir);
  assert.equal(ok(['init', '--config', 'yaml', '--force'], dir), 'Removed qa-core-review.config.json\nWrote qa-core-review.config.yaml\n');
  assert.deepEqual(fs.readdirSync(dir), ['qa-core-review.config.yaml']);
  assert.match(fs.readFileSync(path.join(dir, 'qa-core-review.config.yaml'), 'utf8'), /^# qa-core-review config\. [^\n]+\ninclude: null\nexclude:\n {2}- "\*\*\/node_modules\/\*\*"\n/);
  assert.deepEqual([loaded().config, loaded().warnings, path.basename(loaded().file)], [defaults, [], 'qa-core-review.config.yaml']);

  // `--config` with no value means JSON. `--root` says where to write.
  assert.equal(ok(['init', '--force', '--config'], dir), 'Removed qa-core-review.config.yaml\nWrote qa-core-review.config.json\n');
  assert.equal(ok(['init', '--config', '--force', '--root', dir]), 'Wrote qa-core-review.config.json\n');
  assert.deepEqual(fs.readdirSync(dir), ['qa-core-review.config.json']);
  // A review with the written file behaves like a review with no config.
  assert.equal(run(['review', '--quiet'], dir).stdout, 'Summary: 0 pass, 0 review, 0 fail. 0 errors, 0 warnings, 0 info. 0 suppressed.\n');

  assert.match(ok(['init', '--help']), /^Usage: qa-core-review init/);
  usageError(['init', '--config', 'toml'], /--config must be json or yaml, not "toml"/, dir);
  usageError(['init', '--claude'], /init --claude is not available yet/, dir);
  usageError(['init', 'somewhere'], /init takes no arguments/, dir);
  usageError(['init', '--root', 'nowhere'], /--root is not a folder: nowhere/, dir);
});
