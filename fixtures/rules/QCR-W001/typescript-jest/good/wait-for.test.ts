import { waitFor } from '@testing-library/dom';
import { startSync } from '../src/sync';

test('finishes the sync', async () => {
  const job = startSync();
  await waitFor(() => expect(job.state).toBe('done'), { timeout: 2000 });
});

test('resolves with the result', async () => {
  await expect(startSync().finished).resolves.toEqual({ synced: 3 });
});

// The timer is a time limit here: the event ends the wait.
test('emits done', async () => {
  const job = startSync();
  await new Promise((resolve, reject) => {
    job.once('done', resolve);
    setTimeout(() => reject(new Error('no done event after 2 seconds')), 2000);
  });
  expect(job.state).toBe('done');
});
