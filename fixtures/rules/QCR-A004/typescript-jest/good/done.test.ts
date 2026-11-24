import { api } from '../src/api';

// The test cannot end without the callback: it is the callback that calls done.
it('checks when the event comes', (done) => {
  api.onSaved((cart) => {
    expect(cart.items).toHaveLength(1);
    done();
  });
});

it('waits for the event in a promise', () => new Promise<void>((resolve) => {
  api.onSaved((cart) => {
    expect(cart.items).toHaveLength(1);
    resolve();
  });
}));
