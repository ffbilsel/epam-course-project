/**
 * Next.js instrumentation hook — runs once per server process start.
 * Used to apply DB migrations idempotently (dev convenience) and to
 * run the application bootstrap (FR-005b, staging sweep).
 *
 * The bootstrap module pulls in `better-sqlite3` (a native Node
 * addon) and `node:fs`/`node:path`. Webpack only tree-shakes the
 * dynamic import out of the edge bundle when the guard uses the
 * literal `process.env.NEXT_RUNTIME === "nodejs"` pattern, so this
 * file must keep that exact shape.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { bootstrap } = await import("@/server/bootstrap");
    await bootstrap();
  }
}
