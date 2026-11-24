import { debounce } from '../src/debounce';

describe('debounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('calls once after the quiet time', () => {
    const save = jest.fn();
    const debounced = debounce(save, 300);
    debounced();
    debounced();
    jest.advanceTimersByTime(300);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('runs every timer that is left', async () => {
    const save = jest.fn();
    debounce(save, 5000)();
    await jest.runAllTimersAsync();
    expect(save).toHaveBeenCalledTimes(1);
  });
});
