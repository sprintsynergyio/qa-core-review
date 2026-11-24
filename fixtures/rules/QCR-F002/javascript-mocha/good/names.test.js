const { expect } = require('chai');
const { Queue } = require('../src/queue');

describe('Queue', () => {
  it('skip moves to the next job', () => {
    const queue = new Queue(['a', 'b']);
    queue.skip();
    expect(queue.pending()).to.deep.equal(['b']);
  });
});
