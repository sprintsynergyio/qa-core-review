import { delay } from '../src/time';
import { Queue } from '../src/queue';

describe('Queue', () => {
  beforeEach(async () => {
    await delay(100); // expect: QCR-W001
  });

  it('drains in order', async () => {
    const queue = new Queue();
    queue.push('a');
    queue.push('b');
    await delay(250); // expect: QCR-W001
    expect(queue.drained).toEqual(['a', 'b']);
  });
});
