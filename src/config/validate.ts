// A small JSON Schema checker for the config file.
//
// The tool has no schema library at run time, so this reads `schemas/config.schema.json` and
// checks a value against the part of JSON Schema that file uses. The schema stays the single
// source of truth: tests run the same cases through this checker and through ajv and compare,
// and fail if the schema starts to use a keyword that is not listed in SUPPORTED_KEYWORDS.

export interface SchemaProblem {
  /** JSON pointer to the value, for example '/rules/QCR-W001/severity'. '' is the root. */
  pointer: string;
  message: string;
}

type Schema = Record<string, unknown>;

/** Checked keywords, plus the annotations that are read but not checked. */
export const SUPPORTED_KEYWORDS = [
  'type', 'enum', 'const', 'properties', 'required', 'additionalProperties', 'items', 'minItems',
  'minimum', 'maximum', 'minLength', 'anyOf', '$ref',
  '$schema', '$id', '$defs', 'title', 'description', 'default',
] as const;

function typeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  return typeof value;
}

const TYPE_WORDS: Record<string, string> = {
  string: 'a string', number: 'a number', integer: 'a whole number', boolean: 'true or false',
  array: 'a list', object: 'an object', null: 'null',
};

function quoted(values: readonly unknown[]): string {
  return values.map((value) => JSON.stringify(value)).join(', ');
}

function escapePointer(key: string): string {
  return key.replace(/~/g, '~0').replace(/\//g, '~1');
}

function check(value: unknown, schema: Schema, root: Schema, pointer: string, problems: SchemaProblem[]): void {
  const fail = (message: string, at = pointer): void => void problems.push({ pointer: at, message });

  if (typeof schema.$ref === 'string') {
    const target = (root.$defs as Record<string, Schema>)[schema.$ref.replace('#/$defs/', '')]!;
    check(value, target, root, pointer, problems);
    return;
  }

  if (Array.isArray(schema.anyOf)) {
    const branches = (schema.anyOf as Schema[]).map((branch) => {
      const found: SchemaProblem[] = [];
      check(value, branch, root, pointer, found);
      return found;
    });
    if (branches.every((found) => found.length > 0)) {
      // If the value has the right shape for exactly one form, show what is wrong inside it.
      const shaped = branches.filter((found) => found.every((problem) => problem.pointer !== pointer));
      if (shaped.length === 1) problems.push(...shaped[0]!);
      else fail(`must be ${typeof schema.description === 'string' ? schema.description : 'one of the allowed forms'}`);
    }
    return;
  }

  if ('const' in schema && value !== schema.const) return fail(`must be ${JSON.stringify(schema.const)}`);
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) return fail(`must be one of ${quoted(schema.enum)}`);

  const actual = typeOf(value);
  if (typeof schema.type === 'string') {
    const ok = actual === schema.type || (schema.type === 'number' && actual === 'integer');
    if (!ok) return fail(`must be ${TYPE_WORDS[schema.type]}`);
  }

  if (typeof value === 'string' && typeof schema.minLength === 'number' && value.length < schema.minLength) {
    fail('must not be empty');
  }
  if (typeof value === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum) fail(`must be at least ${schema.minimum}`);
    if (typeof schema.maximum === 'number' && value > schema.maximum) fail(`must be at most ${schema.maximum}`);
  }

  if (Array.isArray(value)) {
    if (typeof schema.minItems === 'number' && value.length < schema.minItems) {
      fail(`must have at least ${schema.minItems} item${schema.minItems === 1 ? '' : 's'}`);
    }
    if (schema.items) value.forEach((item, index) => check(item, schema.items as Schema, root, `${pointer}/${index}`, problems));
  }

  if (actual === 'object') {
    const object = value as Record<string, unknown>;
    const properties = (schema.properties ?? {}) as Record<string, Schema>;
    for (const key of (schema.required ?? []) as string[]) {
      if (!(key in object)) fail(`is missing the required key "${key}"`);
    }
    for (const [key, item] of Object.entries(object)) {
      const at = `${pointer}/${escapePointer(key)}`;
      if (properties[key]) check(item, properties[key], root, at, problems);
      else if (schema.additionalProperties === false) fail(`unknown key "${key}"`, at);
      else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        check(item, schema.additionalProperties as Schema, root, at, problems);
      }
    }
  }
}

/** Checks a value against a schema. Returns the problems found, in document order. */
export function validateSchema(value: unknown, schema: object): SchemaProblem[] {
  const problems: SchemaProblem[] = [];
  check(value, schema as Schema, schema as Schema, '', problems);
  return problems;
}
