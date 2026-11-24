import { debounce } from '../src/debounce';

it('calls once after the quiet time', () => {
  jest.useFakeTimers(); // expect: QCR-C001
  const save = jest.fn();
  debounce(save, 300)();
  jest.advanceTimersByTime(300);
  expect(save).toHaveBeenCalledTimes(1);
});
