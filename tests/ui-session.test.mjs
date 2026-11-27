// The review session (SPEC.md Sections 8.4 and 13.3): the items a reviewer decides on, what is
// kept from an earlier session, the changes the API applies, and the outcome rule.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import {
  MAX_COMMENT_LENGTH, fileItemId, loadSession, newSession, outcomeOf, restoreSession, reviewItems, saveSession, updateFinding, updateGeneral, updateTest,
} from '../dist/index.js';
import { sampleReport, sessionFileFor } from './helpers/ui.mjs';

const { report, tests, finding } = await sampleReport();
const failing = tests['adds a backpack'];
const toReview = tests['shows the badge'];
const passing = tests['opens the cart'];
const errorId = finding('QCR-A001', failing.id).id;
const warnId = finding('QCR-W001', failing.id).id;

test('the items are every test, plus one item for each file with findings outside its tests', () => {
  assert.deepEqual(reviewItems(report).map((item) => [item.id, item.kind, item.file, item.findings.map((entry) => entry.ruleId)]), [
    [failing.id, 'test', 'tests/cart.spec.ts', ['QCR-A001', 'QCR-W001']],
    [toReview.id, 'test', 'tests/cart.spec.ts', ['QCR-W001']],
    [passing.id, 'test', 'tests/cart.spec.ts', []],
    ['file:tests/cart.spec.ts', 'file', 'tests/cart.spec.ts', ['QCR-N001']],
    ['file:tests/empty.spec.ts', 'file', 'tests/empty.spec.ts', ['QCR-X001']],
  ]);
  assert.equal(fileItemId('tests/a.py'), 'file:tests/a.py');
});

test('a suppressed finding is not an item, and a file with no test boundaries is one item', () => {
  const suppressed = { ...report, findings: report.findings.map((entry) => (entry.testId === null ? { ...entry, suppressed: true } : entry)) };
  assert.deepEqual(reviewItems(suppressed).filter((item) => item.kind === 'file'), []);
  const llmOnly = { ...report, files: [...report.files, { ...report.files[1], file: 'tests/cart.feature', parseStatus: 'llm-only', tests: [] }], findings: [] };
  assert.deepEqual(reviewItems(llmOnly).filter((item) => item.kind === 'file'), [{ id: 'file:tests/cart.feature', kind: 'file', file: 'tests/cart.feature', findings: [] }]);
});

test('a new session has every item pending and every finding not dismissed', () => {
  const session = newSession(report);
  assert.deepEqual({ ...session, tests: null }, { schemaVersion: 1, reportCreatedAt: report.createdAt, tests: null, generalComment: '', finishedAt: null, outcome: null });
  assert.equal(Object.keys(session.tests).length, 5);
  assert.deepEqual(session.tests[failing.id], { decision: 'pending', comment: '', findings: { [errorId]: { dismissed: false, comment: '' }, [warnId]: { dismissed: false, comment: '' } } });
});

test('the changes of the API are applied, and a bad one is refused with the reason', () => {
  const session = newSession(report);
  assert.equal(updateTest(session, failing.id, { decision: 'rejected', comment: 'Check the badge.' }), null);
  assert.equal(updateTest(session, failing.id, { comment: 'Check the cart badge.' }), null);
  assert.deepEqual([session.tests[failing.id].decision, session.tests[failing.id].comment], ['rejected', 'Check the cart badge.']);
  assert.equal(updateFinding(session, warnId, { testId: failing.id, dismissed: true, comment: 'Fine here.' }), null);
  assert.deepEqual(session.tests[failing.id].findings[warnId], { dismissed: true, comment: 'Fine here.' });
  assert.equal(updateGeneral(session, { comment: 'x'.repeat(MAX_COMMENT_LENGTH + 5) }), null);
  assert.equal(session.generalComment.length, MAX_COMMENT_LENGTH);

  assert.equal(updateTest(session, 'nope', { decision: 'approved' }), 'unknown test id: nope');
  assert.equal(updateTest(session, '__proto__', { decision: 'approved' }), 'unknown test id: __proto__');
  assert.equal(updateTest(session, failing.id, { decision: 'maybe' }), 'decision must be one of: pending, approved, rejected');
  assert.equal(updateTest(session, failing.id, { comment: 7 }), 'comment must be a string');
  assert.equal(updateTest(session, failing.id, []), 'the body must be an object');
  assert.equal(updateFinding(session, warnId, null), 'the body must be an object');
  assert.equal(updateFinding(session, warnId, { testId: passing.id, dismissed: true }), `unknown finding id for this test: ${warnId}`);
  assert.equal(updateFinding(session, warnId, { dismissed: true }), `unknown finding id for this test: ${warnId}`);
  assert.equal(updateFinding(session, warnId, { testId: failing.id, dismissed: 'yes' }), 'dismissed must be true or false');
  assert.equal(updateFinding(session, warnId, { testId: failing.id, comment: {} }), 'comment must be a string');
  assert.equal(updateGeneral(session, { comment: null }), 'comment must be a string');
  assert.equal(updateGeneral(session, 'text'), 'comment must be a string');
  // Nothing changed after the refusals.
  assert.deepEqual([session.tests[failing.id].decision, session.tests[failing.id].findings[warnId].dismissed], ['rejected', true]);
});

test('the outcome is changes requested when a test is rejected or an open error is left on a test that is not approved', () => {
  const outcome = (change) => {
    const session = newSession(report);
    change(session);
    return outcomeOf(report, session);
  };
  // Nothing decided: the failing test still has its error.
  assert.equal(outcome(() => {}), 'changes-requested');
  // The error is dismissed: warnings and infos alone do not ask for changes.
  assert.equal(outcome((session) => updateFinding(session, errorId, { testId: failing.id, dismissed: true })), 'approved');
  // The test is approved with its error.
  assert.equal(outcome((session) => updateTest(session, failing.id, { decision: 'approved' })), 'approved');
  // Another test is rejected, although it has no error.
  assert.equal(outcome((session) => {
    updateTest(session, failing.id, { decision: 'approved' });
    updateTest(session, passing.id, { decision: 'rejected' });
  }), 'changes-requested');
  // A rejected test stays rejected when its error is dismissed.
  assert.equal(outcome((session) => {
    updateTest(session, failing.id, { decision: 'rejected' });
    updateFinding(session, errorId, { testId: failing.id, dismissed: true });
  }), 'changes-requested');
  // A report with no error at all is approved with nothing decided.
  const calm = { ...report, findings: report.findings.filter((entry) => entry.severity !== 'error') };
  assert.equal(outcomeOf(calm, newSession(calm)), 'approved');
});

test('an earlier session is restored by test id and finding id, and ids that are gone are dropped', () => {
  const earlier = newSession(report);
  updateTest(earlier, failing.id, { decision: 'rejected', comment: 'Check the badge.' });
  updateTest(earlier, passing.id, { decision: 'approved' });
  updateFinding(earlier, warnId, { testId: failing.id, dismissed: true, comment: 'Fine here.' });
  updateGeneral(earlier, { comment: 'Use test ids.' });
  Object.assign(earlier, { finishedAt: '2026-11-27T10:00:00.000Z', outcome: 'changes-requested' });

  // The next run: the passing test is gone, the error of the failing test is fixed, and the report is newer.
  const next = {
    ...report, createdAt: '2026-11-28T08:00:00.000Z',
    files: report.files.map((file) => ({ ...file, tests: file.tests.filter((entry) => entry.id !== passing.id) })),
    findings: report.findings.filter((entry) => entry.id !== errorId),
  };
  const restored = restoreSession(next, JSON.parse(JSON.stringify(earlier)));
  assert.deepEqual(restored.tests[failing.id], { decision: 'rejected', comment: 'Check the badge.', findings: { [warnId]: { dismissed: true, comment: 'Fine here.' } } });
  assert.equal(Object.hasOwn(restored.tests, passing.id), false);
  assert.equal(restored.tests[toReview.id].decision, 'pending');
  // The general comment is kept. The run is a new one, so it is not finished.
  assert.deepEqual([restored.generalComment, restored.reportCreatedAt, restored.finishedAt, restored.outcome], ['Use test ids.', '2026-11-28T08:00:00.000Z', null, null]);
});

test('saved data with the wrong shape is ignored piece by piece', () => {
  const fresh = newSession(report);
  for (const saved of [null, 'text', [], { schemaVersion: 2, tests: {} }, { schemaVersion: 1, tests: [] }]) assert.deepEqual(restoreSession(report, saved), fresh);
  const odd = restoreSession(report, {
    schemaVersion: 1, generalComment: 5,
    tests: { [failing.id]: { decision: 'deleted', comment: ['x'], findings: { [errorId]: 'yes', [warnId]: { dismissed: 'true', comment: 3 } } }, [toReview.id]: 'approved', [passing.id]: { decision: 'approved', findings: null } },
  });
  assert.deepEqual(odd.tests[failing.id], fresh.tests[failing.id]);
  assert.deepEqual(odd.tests[toReview.id], fresh.tests[toReview.id]);
  assert.deepEqual([odd.tests[passing.id].decision, odd.generalComment], ['approved', '']);
});

test('the session file is written whole, and a missing or broken file gives a fresh session', (t) => {
  const file = sessionFileFor(t);
  assert.deepEqual(loadSession(file, report), newSession(report));
  const session = newSession(report);
  updateTest(session, toReview.id, { decision: 'approved', comment: 'ok' });
  saveSession(file, session);
  assert.equal(fs.existsSync(`${file}.tmp`), false);
  assert.ok(fs.readFileSync(file, 'utf8').endsWith('}\n'));
  assert.deepEqual(loadSession(file, report), session);
  fs.writeFileSync(file, '{ "schemaVersion": 1, "tests": ');
  assert.deepEqual(loadSession(file, report), newSession(report));
});
