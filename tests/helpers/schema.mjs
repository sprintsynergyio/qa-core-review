// JSON Schema helpers for tests. Schemas are draft 2020-12 and live in schemas/.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
