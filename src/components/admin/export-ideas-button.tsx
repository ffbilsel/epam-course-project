"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";

/**
 * Admin-only download button. Builds an `/api/ideas/export` URL
 * that mirrors the current listing filters so the CSV matches the
 * on-screen view (ADR-0016).
 */
export function ExportIdeasButton(): JSX.Element {
  const sp = useSearchParams();
  const href = useMemo(() => {
    const next = new URLSearchParams();
    for (const k of ["q", "categoryId", "from", "to"] as const) {
      const v = sp.get(k);
      if (v) next.set(k, v);
    }
    for (const s of sp.getAll("status")) next.append("status", s);
    next.set("scope", "all");
    const qs = next.toString();
    return qs ? `/api/ideas/export?${qs}` : "/api/ideas/export";
  }, [sp]);

  return (
    <Button asChild variant="outline" size="sm">
      <a href={href} download>
        Export CSV
      </a>
    </Button>
  );
}
