// JSON Schema helpers for tests. Schemas are draft 2020-12 and live in schemas/.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import Ajv2020 from 'ajv/dist/2020.js';

export const repoRoot = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));

export function readJson(...segments) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, ...segments), 'utf8'));
}

const validators = new Map();

/** A compiled validator for schemas/<name>, for example 'model.schema.json'. */
export function validatorFor(name) {
  if (!validators.has(name)) {
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    validators.set(name, ajv.compile(readJson('schemas', name)));
  }
  return validators.get(name);
}

/** Schema errors as short lines ('/tests/0/id must match pattern ...'). Empty when valid. */
export function schemaErrors(name, value) {
  const validate = validatorFor(name);
  if (validate(value)) return [];
  return validate.errors.map((error) => {
    const extra = error.params?.additionalProperty ? ` "${error.params.additionalProperty}"` : '';
    return `${error.instancePath || '/'} ${error.message}${extra}`;
  });
}

let sarifValidator;

/**
 * Errors of a SARIF log against the official SARIF 2.1.0 schema in tests/schemas/, as short
 * lines. Empty when valid. The schema file is the official one, byte for byte. It is written
 * for JSON Schema draft 04, which this Ajv does not read, so two keywords are adapted in
 * memory: the draft marker is dropped and `id` becomes `$id`. The schema uses nothing else
 * that differs between the drafts.
 */
export function sarifErrors(value) {
  if (!sarifValidator) {
    const { $schema: _draft, id, ...rest } = readJson('tests', 'schemas', 'sarif-2.1.0.json');
    const ajv = new Ajv({ allErrors: true, strict: false });
    // The three formats the schema names. Enough to catch a path with a space or a missing scheme.
    ajv.addFormat('uri', (text) => /^[A-Za-z][A-Za-z0-9+.-]*:[^\s<>"{}|\\^`]*$/.test(text));
    ajv.addFormat('uri-reference', (text) => /^[^\s<>"{}|\\^`]*$/.test(text));
    ajv.addFormat('date-time', (text) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(text));
    sarifValidator = ajv.compile({ $id: id, ...rest });
  }
  if (sarifValidator(value)) return [];
  return sarifValidator.errors.map((error) => `${error.instancePath || '/'} ${error.message}`);
}
