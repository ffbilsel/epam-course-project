"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * US1: Edit-idea trigger. Server decides visibility via
 * `canAuthorEdit`; this component just renders the link when the
 * caller has decided to show it.
 */
export function EditIdeaButton({ ideaId }: { ideaId: string }): JSX.Element {
  return (
    <Button asChild variant="outline">
      <Link href={`/ideas/${ideaId}/edit`}>Edit idea</Link>
    </Button>
  );
}
