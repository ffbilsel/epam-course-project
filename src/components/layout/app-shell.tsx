import type { ReactNode } from "react";
import { Header } from "@/components/layout/header";

/**
 * Phase-4 shared chrome wrapper (ADR-0022). Provides a consistent
 * full-height surface, the top navigation header, and an optional
 * sidebar slot. Pages mount inside `<main>` so the makeover-token
 * background applies.
 */
export function AppShell({
  children,
  sidebar,
}: {
  children: ReactNode;
  sidebar?: ReactNode;
}): JSX.Element {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex flex-1">
        {sidebar ? <>{sidebar}</> : null}
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
