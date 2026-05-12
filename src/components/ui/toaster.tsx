"use client";

import { Toaster as SonnerToaster } from "sonner";

/**
 * Single mounted toaster instance for sonner notifications.
 */
export function Toaster() {
  return <SonnerToaster richColors position="top-right" />;
}
