import { AppShell } from "@/components/layout/app-shell";

/**
 * Employee section layout — wraps every nested page in the shared
 * {@link AppShell}. Auth is enforced per-page (pages run their own
 * `auth()` check + redirect today; layout stays transparent).
 */
export default function EmployeeLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return <AppShell>{children}</AppShell>;
}
