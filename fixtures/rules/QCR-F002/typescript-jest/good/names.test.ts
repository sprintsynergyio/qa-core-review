import { Queue } from '../src/queue';

test('skip moves to the next job', () => {
  const queue = new Queue(['a', 'b']);
  queue.skip();
  expect(queue.todo()).toEqual(['b']);
});
