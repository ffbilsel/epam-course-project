/**
 * Injectable id generator port — services that mint UUIDs depend on
 * this so tests can substitute deterministic ids.
 */
export interface IdGenerator {
  /** Returns a new UUID v4 string. */
  next(): string;
}

/**
 * Default {@link IdGenerator} backed by `crypto.randomUUID()`.
 */
export const SystemIdGenerator: IdGenerator = {
  next: () => crypto.randomUUID(),
};

/**
 * Test-only {@link IdGenerator} that returns the supplied ids in order.
 */
export class StaticIdGenerator implements IdGenerator {
  private i = 0;
  /** Constructs a StaticIdGenerator that yields the given ids in order. */
  constructor(private ids: string[]) {}
  /** Returns the next pre-supplied id, throwing if the queue is empty. */
  next(): string {
    const v = this.ids[this.i++];
    if (!v) throw new Error("StaticIdGenerator exhausted");
    return v;
  }
}
