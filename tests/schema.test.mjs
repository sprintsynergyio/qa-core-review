// schemas/report.schema.json must mirror the report types in src/rules/types.ts (SPEC.md Section 8.2).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FRAMEWORK_IDS, LANGUAGE_IDS, MODIFIERS, PARSE_STATUSES, resolveConfig, runReview } from '../dist/index.js';
import { fixtureRoot } from './helpers/adapter-suite.mjs';
import { readJson, schemaErrors, validatorFor } from './helpers/schema.mjs';
import { toyRules } from './helpers/toy-rules.mjs';

const schema = readJson('schemas', 'report.schema.json');

test('the report schema compiles in strict mode and shares its value lists with the model', () => {
  assert.equal(typeof validatorFor('report.schema.json'), 'function');
  assert.equal(schema.$id, 'https://raw.githubusercontent.com/sprintsynergyio/qa-core-review/main/schemas/report.schema.json');
  assert.deepEqual([schema.$defs.LanguageId.enum, schema.$defs.FrameworkId.enum, schema.$defs.Modifier.enum, schema.$defs.ParseStatus.enum], [[...LANGUAGE_IDS], [...FRAMEWORK_IDS], [...MODIFIERS], [...PARSE_STATUSES]]);
  assert.equal(schema.properties.schemaVersion.const, 2);
});

test('real reports are valid, and reports with a wrong or missing value are not', async () => {
  const { report } = await runReview({ root: fixtureRoot('adapters', 'js', 'cypress'), config: resolveConfig({}).config, git: false, rules: toyRules });
  assert.ok(report.findings.length > 3 && report.files.length === 3);
  assert.deepEqual(schemaErrors('report.schema.json', report), []);
  const changed = (edit) => {
    const copy = structuredClone(report);
    edit(copy);
    return schemaErrors('report.schema.json', copy);
  };
  assert.deepEqual(changed((copy) => { copy.schemaVersion = 1; }), ['/schemaVersion must be equal to constant']);
  assert.deepEqual(changed((copy) => { copy.findings[0].severity = 'fatal'; }), ['/findings/0/severity must be equal to one of the allowed values']);
  assert.deepEqual(changed((copy) => { copy.findings[0].id = 'short'; }), ['/findings/0/id must match pattern "^[0-9a-f]{16}$"']);
  assert.deepEqual(changed((copy) => { copy.findings[0].location.startLine = 0; }), ['/findings/0/location/startLine must be >= 1']);
  assert.deepEqual(changed((copy) => { delete copy.summary.suppressed; }), ["/summary must have required property 'suppressed'"]);
  assert.deepEqual(changed((copy) => { copy.files[0].tests[0].verdict = 'maybe'; }), ['/files/0/tests/0/verdict must be equal to one of the allowed values']);
  assert.deepEqual(changed((copy) => { copy.extra = true; }), ['/ must NOT have additional properties "extra"']);
  assert.deepEqual(changed((copy) => { copy.createdAt = 'yesterday'; }).length, 1);
});
