"use client";

import { createContext, useContext, useId, useState } from "react";
import { cn } from "@/lib/utils";

interface TabsContextValue {
  value: string;
  setValue: (v: string) => void;
  idPrefix: string;
}

const TabsCtx = createContext<TabsContextValue | null>(null);

/**
 * Minimal headless Tabs primitive (ARIA tablist / tab / tabpanel).
 * Avoids pulling in another Radix package for a single use site.
 */
export function Tabs({
  defaultValue,
  children,
  className,
}: {
  defaultValue: string;
  children: React.ReactNode;
  className?: string;
}): JSX.Element {
  const [value, setValue] = useState(defaultValue);
  const idPrefix = useId();
  return (
    <TabsCtx.Provider value={{ value, setValue, idPrefix }}>
      <div className={className}>{children}</div>
    </TabsCtx.Provider>
  );
}

export function TabsList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <div
      role="tablist"
      className={cn("inline-flex rounded-md border bg-muted p-1 text-sm", className)}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({
  value: tab,
  children,
}: {
  value: string;
  children: React.ReactNode;
}): JSX.Element {
  const ctx = useContext(TabsCtx);
  if (!ctx) throw new Error("TabsTrigger must be inside <Tabs>");
  const active = ctx.value === tab;
  return (
    <button
      type="button"
      role="tab"
      id={`${ctx.idPrefix}-tab-${tab}`}
      aria-selected={active}
      aria-controls={`${ctx.idPrefix}-panel-${tab}`}
      tabIndex={active ? 0 : -1}
      onClick={() => ctx.setValue(tab)}
      className={cn(
        "rounded-sm px-3 py-1.5 transition-colors",
        active
          ? "bg-background font-medium text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value: tab,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}): JSX.Element | null {
  const ctx = useContext(TabsCtx);
  if (!ctx) throw new Error("TabsContent must be inside <Tabs>");
  if (ctx.value !== tab) return null;
  return (
    <div
      role="tabpanel"
      id={`${ctx.idPrefix}-panel-${tab}`}
      aria-labelledby={`${ctx.idPrefix}-tab-${tab}`}
      className={cn("mt-4", className)}
    >
      {children}
    </div>
  );
}
