/**
 * Default loading skeleton shown when route segments suspend.
 */
export default function Loading() {
  return (
    <div className="container flex min-h-[40vh] items-center justify-center" aria-busy="true">
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  );
}
