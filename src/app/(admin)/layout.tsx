import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { auth } from "@/server/auth-options";

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
  return (
    <>
      <Header />
      {children}
    </>
  );
}
