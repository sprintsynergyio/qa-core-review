// The normalized model: schemas/model.schema.json must mirror src/model/types.ts.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import * as api from '../dist/index.js';
import { readJson, schemaErrors, validatorFor } from './helpers/schema.mjs';

const SCHEMA = 'model.schema.json';
const schema = readJson('schemas', SCHEMA);
const full = () => readJson('tests', 'fixtures', 'model', 'full.model.json');

test('the model schema compiles in strict mode', () => {
  assert.equal(typeof validatorFor(SCHEMA), 'function');
  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.match(schema.$id, /^https:\/\/raw\.githubusercontent\.com\/sprintsynergyio\/qa-core-review\//);
});

test('the value lists in src/model/types.ts match the schema enums', () => {
  const pairs = {
    LanguageId: api.LANGUAGE_IDS,
    FrameworkId: api.FRAMEWORK_IDS,
    Capability: api.CAPABILITIES,
    Modifier: api.MODIFIERS,
    AssertionKind: api.ASSERTION_KINDS,
    SelectorStrategy: api.SELECTOR_STRATEGIES,
    ParseStatus: api.PARSE_STATUSES,
  };
  for (const [name, values] of Object.entries(pairs)) {
    assert.deepEqual(schema.$defs[name].enum, [...values], `${name} differs between the schema and the code`);
    assert.equal(new Set(values).size, values.length, `${name} has a duplicate value`);
  }
});

test('the model lists hold the Tier 1 languages, frameworks and all 18 capabilities', () => {
  for (const language of ['javascript', 'typescript', 'python', 'java', 'generic']) assert.ok(api.LANGUAGE_IDS.includes(language));
  for (const framework of ['playwright', 'cypress', 'jest', 'vitest', 'mocha', 'webdriverio', 'pytest', 'unittest', 'junit4', 'junit5', 'testng', 'selenium', 'restassured']) {
    assert.ok(api.FRAMEWORK_IDS.includes(framework), framework);
  }
  assert.equal(api.CAPABILITIES.length, 18);
});

test('a model that fills every field is valid', () => {
  assert.deepEqual(schemaErrors(SCHEMA, full()), []);
});

test('the full fixture uses every property the schema defines', () => {
  const schemaKeys = new Set();
  const collectSchema = (node) => {
    if (Array.isArray(node)) node.forEach(collectSchema);
    else if (node && typeof node === 'object') {
      for (const key of Object.keys(node.properties ?? {})) schemaKeys.add(key);
      Object.values(node).forEach(collectSchema);
    }
  };
  collectSchema(schema);

  const usedKeys = new Set();
  const collectUsed = (node) => {
    if (Array.isArray(node)) node.forEach(collectUsed);
    else if (node && typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) {
        usedKeys.add(key);
        collectUsed(value);
      }
    }
  };
  collectUsed(full());

  assert.deepEqual([...schemaKeys].filter((key) => !usedKeys.has(key)), []);
  assert.deepEqual([...usedKeys].filter((key) => !schemaKeys.has(key)), []);
});

test('every object in the schema rejects unknown properties', () => {
  const open = [];
  const walk = (node, where) => {
    if (Array.isArray(node)) node.forEach((item, index) => walk(item, `${where}/${index}`));
    else if (node && typeof node === 'object') {
      if (node.type === 'object' && node.additionalProperties !== false) open.push(where);
      for (const [key, value] of Object.entries(node)) walk(value, `${where}/${key}`);
    }
  };
  walk(schema, '');
  assert.deepEqual(open, []);
});

test('invalid models are rejected with the path of the problem', () => {
  const cases = [
    ['a missing required field', (file) => delete file.tests[0].assertions, /\/tests\/0 must have required property 'assertions'/],
    ['an unknown property', (file) => { file.tests[0].flaky = true; }, /\/tests\/0 must NOT have additional properties "flaky"/],
    ['an unknown language', (file) => { file.language = 'cobol'; }, /\/language must be equal to one of the allowed values/],
    ['an unknown capability', (file) => { file.capabilities.push('telepathy'); }, /\/capabilities\/18 must be equal to one of the allowed values/],
    ['a 0-based line', (file) => { file.tests[0].span.startLine = 0; }, /\/tests\/0\/span\/startLine must be >= 1/],
    ['a Windows path', (file) => { file.path = 'tests\\cart.spec.ts'; }, /\/path must match pattern/],
    ['a test id that is not 12 hex characters', (file) => { file.tests[0].id = 'abc'; }, /\/tests\/0\/id must match pattern/],
    ['a guessed targetsSubject string', (file) => { file.fileMocks[0].targetsSubject = 'maybe'; }, /\/fileMocks\/0\/targetsSubject must be boolean/],
    ['evidence longer than 200 characters', (file) => { file.tests[0].assertions[0].text = 'x'.repeat(201); }, /\/tests\/0\/assertions\/0\/text must NOT have more than 200 characters/],
    ['tier 4', (file) => { file.tier = 4; }, /\/tier must be equal to one of the allowed values/],
  ];
  for (const [name, breakIt, expected] of cases) {
    const file = full();
    breakIt(file);
    assert.match(schemaErrors(SCHEMA, file).join('\n'), expected, name);
  }
});

test('optional fields may be left out, nullable fields may be null', () => {
  const file = full();
  delete file.tests[0].assertions[0].actual.literal;
  delete file.tests[0].assertions[1].statusCodes;
  delete file.tests[0].selectors[1].positional;
  delete file.tests[1].linkedSteps;
  file.subject = null;
  file.tests[0].skip = null;
  file.tests[0].parameterized = null;
  file.tests[0].bodyHash = null;
  assert.deepEqual(schemaErrors(SCHEMA, file), []);
});

test('testId is sha1(file, full title, occurrence index), first 12 hex characters', () => {
  const id = api.testId('tests/cart.spec.ts', 'Cart > adds an item', 0);
  const expected = createHash('sha1').update('tests/cart.spec.ts\0Cart > adds an item\x000').digest('hex').slice(0, 12);
  assert.equal(id, expected);
  assert.match(id, /^[0-9a-f]{12}$/);
  assert.equal(api.testId('tests/cart.spec.ts', 'Cart > adds an item', 0), id);
  assert.notEqual(api.testId('tests/cart.spec.ts', 'Cart > adds an item', 1), id);
  assert.notEqual(api.testId('tests/other.spec.ts', 'Cart > adds an item', 0), id);
});
