import Link from "next/link";
import { auth, signOut } from "@/server/auth-options";
import { Button } from "@/components/ui/button";

/**
 * Top navigation bar — RSC reads the session and renders the user
 * name + sign-out trigger (form action) so signOut runs on the
 * server.
 */
export async function Header(): Promise<JSX.Element | null> {
  const session = await auth();
  if (!session?.user) return null;
  const role = session.user.role;
  const homeHref = role === "EMPLOYEE" ? "/my-ideas" : "/queue";
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <nav className="flex items-center gap-4">
          <Link href={homeHref} className="text-base font-semibold">
            InnovatEPAM
          </Link>
          <Link href="/my-ideas" className="text-sm text-muted-foreground hover:text-foreground">
            My Ideas
          </Link>
          {(role === "EVALUATOR" || role === "ADMIN") && (
            <Link href="/queue" className="text-sm text-muted-foreground hover:text-foreground">
              Review Queue
            </Link>
          )}
          {role === "ADMIN" && (
            <>
              <Link
                href="/admin/users"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Users
              </Link>
              <Link
                href="/admin/categories"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Categories
              </Link>
            </>
          )}
        </nav>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{session.user.displayName}</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
