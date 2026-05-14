import Link from "next/link";
import { auth, signOut } from "@/server/auth-options";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";

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
  const displayName =
    session.user.displayName ?? session.user.name ?? session.user.email ?? "User";
  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex w-full max-w-screen-2xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6 lg:px-10">
        <nav className="flex min-w-0 flex-wrap items-center gap-1 sm:gap-2">
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
          <Link
            href="/dashboard"
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Dashboard
          </Link>
          <Link
            href="/categories/propose"
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Propose category
          </Link>
          {(role === "EVALUATOR" || role === "ADMIN") && (
            <Link
              href="/queue"
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Review Queue
            </Link>
          )}
          {(role === "EVALUATOR" || role === "ADMIN") && (
            <Link
              href="/insights"
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Insights
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
          <ThemeToggle />
          <div className="hidden items-center gap-2 sm:flex">
            <span
              aria-hidden="true"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-xs font-semibold text-white"
            >
              {initials || "?"}
            </span>
            <span className="text-sm font-medium">{displayName}</span>
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
