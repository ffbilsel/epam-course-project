/**
 * Injectable Clock port (Constitution V.6) so services can be tested
 * deterministically without touching `Date.now()` directly.
 */
export interface Clock {
  /** Returns the current instant. */
  now(): Date;
}

/**
 * Default Clock that reads the system wall clock.
 */
export const SystemClock: Clock = {
  now: () => new Date(),
};

/**
 * Test-only Clock that always returns the supplied instant. Mutate
 * the `current` field to advance time.
 */
export class FixedClock implements Clock {
  /** Current instant returned by {@link now}. */
  current: Date;
  /** Constructs a FixedClock at the given instant (default epoch 0). */
  constructor(initial: Date | number = 0) {
    this.current = typeof initial === "number" ? new Date(initial) : initial;
  }
  /** Returns the current instant. */
  now(): Date {
    return new Date(this.current.getTime());
  }
  /**
   * Advance the clock by `ms` milliseconds.
   */
  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}
