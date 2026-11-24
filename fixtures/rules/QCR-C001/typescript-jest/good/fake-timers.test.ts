import { debounce } from '../src/debounce';

afterEach(() => {
  jest.useRealTimers();
});

it('calls once after the quiet time', () => {
  jest.useFakeTimers();
  const save = jest.fn();
  debounce(save, 500)();
  jest.advanceTimersByTime(500);
  expect(save).toHaveBeenCalledTimes(1);
});
