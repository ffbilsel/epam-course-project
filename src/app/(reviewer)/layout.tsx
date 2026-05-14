import { AppShell } from "@/components/layout/app-shell";

/**
 * Reviewer section layout — wraps every nested page in the shared
 * {@link AppShell}. Each page enforces its own role guard.
 */
export default function ReviewerLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return <AppShell>{children}</AppShell>;
}
