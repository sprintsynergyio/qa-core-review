// QCR-C001 missing-cleanup (SPEC.md Section 10.14): state that a test or a hook takes hold of
// and never gives back, so it leaks into the tests that run after it.
import type { NResource } from '../model/types.js';
import { fixFor, termFor } from './fix-text.js';
import type { FindingDraft, Rule } from './types.js';
import { hooksAround } from './util.js';

/** The sub-case of each kind of resource, and how the message names it. */
const KINDS: Record<NResource['kind'], { key: string; message: string }> = {
  'fake-timers': { key: 'timers', message: 'Fake timers are switched on here and never switched back.' },
  spy: { key: 'spy', message: 'This spy or stub is never restored.' },
  patch: { key: 'spy', message: 'This patch is never undone.' },
  env: { key: 'env', message: 'This environment variable is changed and never set back.' },
  global: { key: 'global', message: 'This global is replaced and never put back.' },
  browser: { key: 'handle', message: 'This browser is opened and never closed.' },
  context: { key: 'handle', message: 'This browser context is opened and never closed.' },
  page: { key: 'handle', message: 'This page is opened and never closed.' },
  driver: { key: 'handle', message: 'This driver is started and never quit.' },
  'api-context': { key: 'handle', message: 'This API client is created and never disposed.' },
  connection: { key: 'handle', message: 'This connection is opened and never closed.' },
  server: { key: 'handle', message: 'This server is started and never stopped.' },
  file: { key: 'handle', message: 'This file is opened or created and never closed or removed.' },
};

const LANGUAGE_TERMS = ['environment variable', 'patch'];

export const missingCleanup: Rule = {
  id: 'QCR-C001',
  name: 'missing-cleanup',
  defaultSeverity: 'warn',
  scope: 'universal',
  requires: ['resources', 'hooks'],
  description: 'State that a test creates and never restores: fake timers, spies, globals, environment variables, browsers. Test data that is never deleted is reported as info.',
  check({ file, options }) {
    const spiesRestored = options.restoreMocksConfigured === true;
    const drafts: FindingDraft[] = [];
    const scan = (resources: readonly NResource[], testId: string | null): void => {
      for (const resource of resources) {
        if (resource.released || resource.autoManaged || (spiesRestored && resource.kind === 'spy')) continue;
        const { key, message } = KINDS[resource.kind];
        // The same thing has another name in some languages: a system property in Java, where others change the environment.
        const worded = LANGUAGE_TERMS.reduce((text, term) => text.replace(term, termFor(term, file.language)), message);
        drafts.push({ message: worded, evidence: resource.text, span: resource.span, testId, ...fixFor(`QCR-C001/${key}`, file.language) });
      }
    };
    scan(file.fileResources, null);
    for (const test of file.tests) {
      scan(test.resources, test.id);
      const created = test.data.find((op) => op.op === 'create' && op.via === 'http');
      // A delete counts in the test itself and in any hook that runs around it.
      const deleted = [...test.data, ...hooksAround(file, test).flatMap((hook) => hook.data)].some((op) => op.op === 'delete');
      if (created && !deleted) {
        drafts.push({
          message: 'This test creates data over HTTP and never deletes it.', evidence: created.text, span: created.span, testId: test.id,
          severity: 'info', confidence: 'low', ...fixFor('QCR-C001/data', file.language),
        });
      }
    }
    return drafts;
  },
};
