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
  const initials = session.user.displayName
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link href={homeHref} className="mr-2 flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-sm font-bold text-white shadow-sm"
            >
              i
            </span>
            <span className="text-base font-semibold tracking-tight">InnovatEPAM</span>
          </Link>
          <Link
            href="/my-ideas"
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            My Ideas
          </Link>
          {(role === "EVALUATOR" || role === "ADMIN") && (
            <Link
              href="/queue"
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Review Queue
            </Link>
          )}
          {role === "ADMIN" && (
            <>
              <Link
                href="/admin/users"
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                Users
              </Link>
              <Link
                href="/admin/categories"
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                Categories
              </Link>
            </>
          )}
        </nav>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 sm:flex">
            <span
              aria-hidden="true"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-xs font-semibold text-white"
            >
              {initials || "?"}
            </span>
            <span className="text-sm font-medium">{session.user.displayName}</span>
          </div>
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
