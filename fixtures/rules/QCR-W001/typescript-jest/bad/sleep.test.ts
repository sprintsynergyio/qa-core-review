import { startSync } from '../src/sync';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test('finishes the sync', async () => {
  const job = startSync();
  await sleep(2000); // expect: QCR-W001
  expect(job.state).toBe('done');
});

test('retries once', async () => {
  const job = startSync({ failFirst: true });
  await new Promise((resolve) => setTimeout(resolve, 1500)); // expect: QCR-W001
  expect(job.attempts).toBe(2);
});
