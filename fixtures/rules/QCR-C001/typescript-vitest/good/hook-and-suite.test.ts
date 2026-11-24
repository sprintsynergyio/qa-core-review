import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Session } from '../src/session';

describe('Session', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('expires after 40 minutes with the long setting', () => {
    const session = new Session({ minutes: 40 });
    vi.advanceTimersByTime(40 * 60 * 1000);
    expect(session.expired).toBe(true);
  });

  // The hook of the outer suite also covers a suite inside it.
  describe('renewal', () => {
    it('starts again after a key press', () => {
      const session = new Session();
      session.touch();
      expect(session.expired).toBe(false);
    });
  });
});
