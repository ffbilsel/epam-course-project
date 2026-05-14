import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { auth } from "@/server/auth-options";

// Admin pages depend on the live DB session and must never be
// statically pre-rendered at build time.
export const dynamic = "force-dynamic";

/**
 * Admin section layout — guards every nested page with `requireRole('ADMIN')`.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin/users");
  if (session.user.role !== "ADMIN") redirect("/");
  return <AppShell>{children}</AppShell>;
}
