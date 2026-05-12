import { redirect } from "next/navigation";
import { getServerSession } from "@/server/auth-options";

/**
 * Root landing page — redirects to a role-appropriate page or login.
 */
export default async function HomePage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (session.user.role === "EMPLOYEE") redirect("/my-ideas");
  redirect("/queue");
}
