/**
 * Next.js instrumentation hook — runs once per server process start.
 * Used to apply DB migrations idempotently (dev convenience) and to
 * run the application bootstrap (FR-005b, staging sweep).
 */
export async function register(): Promise<void> {
  if (process.env["NEXT_RUNTIME"] !== "nodejs") return;
  const { bootstrap } = await import("@/server/bootstrap");
  await bootstrap();
}
