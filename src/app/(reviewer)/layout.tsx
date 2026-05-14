import { AppShell } from "@/components/layout/app-shell";

// Reviewer pages depend on the live DB session and must never be
// statically pre-rendered at build time.
export const dynamic = "force-dynamic";

/**
 * Reviewer section layout — wraps every nested page in the shared
 * {@link AppShell}. Each page enforces its own role guard.
 */
export default function ReviewerLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return <AppShell>{children}</AppShell>;
}
