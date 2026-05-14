"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/db/schema";

interface SidebarLink {
  href: string;
  label: string;
  roles: ReadonlyArray<Role>;
  badge?: number;
}

const LINKS: SidebarLink[] = [
  { href: "/my-ideas", label: "My Ideas", roles: ["EMPLOYEE", "EVALUATOR", "ADMIN"] },
  { href: "/drafts", label: "My Drafts", roles: ["EMPLOYEE", "EVALUATOR", "ADMIN"] },
  { href: "/dashboard", label: "Dashboard", roles: ["EMPLOYEE", "EVALUATOR", "ADMIN"] },
  { href: "/categories/propose", label: "Propose category", roles: ["EMPLOYEE", "EVALUATOR", "ADMIN"] },
  { href: "/ideas/new", label: "Submit idea", roles: ["EMPLOYEE", "EVALUATOR", "ADMIN"] },
  { href: "/queue", label: "Review queue", roles: ["EVALUATOR", "ADMIN"] },
  { href: "/insights", label: "Insights", roles: ["EVALUATOR", "ADMIN"] },
  { href: "/admin/users", label: "Users", roles: ["ADMIN"] },
  { href: "/admin/categories", label: "Categories", roles: ["ADMIN"] },
];

/**
 * Role-aware sidebar. Filters links by `role` and highlights the
 * active route using `usePathname`.
 */
export function Sidebar({ role, draftCount }: { role: Role; draftCount?: number }): JSX.Element {
  const pathname = usePathname() ?? "";
  const visible = LINKS.filter((l) => l.roles.includes(role));
  return (
    <aside
      className="hidden w-56 shrink-0 border-r border-border/60 bg-card/40 px-3 py-4 md:block"
      aria-label="Primary"
    >
      <nav className="space-y-1">
        {visible.map((link) => {
          const active =
            pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
          const badge = link.href === "/drafts" ? draftCount : undefined;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={
                "flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors " +
                (active
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground")
              }
            >
              <span>{link.label}</span>
              {badge !== undefined && badge > 0 ? (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                  {badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
