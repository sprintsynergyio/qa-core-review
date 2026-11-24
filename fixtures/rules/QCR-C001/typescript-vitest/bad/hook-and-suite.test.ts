import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Session } from '../src/session';

// Timers switched on in a hook and never switched back.
describe('Session', () => {
  beforeEach(() => {
    vi.useFakeTimers(); // expect: QCR-C001
  });

  it('expires after 30 minutes', () => {
    const session = new Session();
    vi.advanceTimersByTime(30 * 60 * 1000);
    expect(session.expired).toBe(true);
  });
});

// The cleanup of another suite does not reach this test.
describe('Session warnings', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('warns after 25 minutes', () => {
    vi.useFakeTimers();
    const session = new Session();
    vi.advanceTimersByTime(25 * 60 * 1000);
    expect(session.warned).toBe(true);
  });
});

describe('Session renewal', () => {
  it('starts again after a click', () => {
    vi.useFakeTimers(); // expect: QCR-C001
    const session = new Session();
    session.touch();
    expect(session.expired).toBe(false);
  });
});
