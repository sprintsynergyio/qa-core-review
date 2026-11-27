// Helpers for the tests of the local review page: a small real report, and HTTP calls where the
// test sets every header itself (the Host header too, which `fetch` does not allow).
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { reviewFiles } from './temp-project.mjs';

export const SOURCES = {
  'tests/cart.spec.ts': `
import { test, expect } from '@playwright/test';

test('adds a backpack', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/inventory.html');
  await page.waitForTimeout(3000);
});

test('shows the badge', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/inventory.html');
  await page.waitForTimeout(500);
  await expect(page.getByTestId('shopping-cart-badge')).toHaveText('1');
});

test('opens the cart', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/cart.html');
  await expect(page).toHaveURL(/cart/);
});
`,
  'tests/empty.spec.ts': '// to do\n',
};

/**
 * A report with one failing test (an error and a warning), one test to review (a warning), one
 * passing test, a finding about the first file as a whole and a file with no test in it.
 */
export async function sampleReport(extra = {}) {
  const { report } = await reviewFiles({ ...SOURCES, ...extra }, { dependencies: { '@playwright/test': '^1.49.0' } });
  const tests = Object.fromEntries(report.files.flatMap((file) => file.tests).map((entry) => [entry.title, entry]));
  const finding = (ruleId, testId) => report.findings.find((entry) => entry.ruleId === ruleId && entry.testId === testId);
  return { report, tests, finding };
}

/** A folder for `session.json` that is removed when the test ends. */
export function sessionFileFor(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcr-ui-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return path.join(dir, '.qa-core', 'review', 'session.json');
}

/**
 * One request to a review server. `token` and `host` default to the right ones; pass `null` to
 * leave the header out. `body` is sent as JSON unless it is a string or a Buffer.
 * Resolves with `{ status, headers, text, json }`.
 */
export function call(server, method, target, { token = server.token, host = `127.0.0.1:${server.port}`, body, connectTo = '127.0.0.1' } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
    const headers = {};
    if (token !== null) headers['X-QCR-Token'] = token;
    if (payload !== null) headers['Content-Type'] = 'application/json';
    const request = http.request({ host: connectTo, port: server.port, method, path: target, headers, setHost: false, agent: false }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try {
          json = JSON.parse(text);
        } catch {
          // Not every answer is JSON.
        }
        resolve({ status: response.statusCode, headers: response.headers, text, json });
      });
    });
    request.on('error', reject);
    if (host !== null) request.setHeader('Host', host);
    request.end(payload ?? undefined);
  });
}
