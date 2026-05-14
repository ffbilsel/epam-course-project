import type { IdeaHistoryEvent } from "@/server/idea-history";
import { formatDateTime } from "@/lib/format/date";

/**
 * Renders the combined audit timeline for one idea. Each event
 * has a small kind-specific header line (SUBMITTED / EDITED /
 * TRANSITION X → Y) plus the actor, timestamp, and optional
 * comment.
 */
export function IdeaHistoryTab({ events }: { events: IdeaHistoryEvent[] }): JSX.Element {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No history yet.</p>;
  }
  return (
    <ol className="space-y-4 text-sm">
      {events.map((e, i) => (
        <li key={i} className="border-l-2 border-muted pl-3">
          <p className="font-medium">{headline(e)}</p>
          <p className="text-xs text-muted-foreground">
            {e.actorName} • {formatDateTime(new Date(e.at))}
          </p>
          {"comment" in e && e.comment && <p className="mt-1 italic">“{e.comment}”</p>}
        </li>
      ))}
    </ol>
  );
}

function headline(e: IdeaHistoryEvent): string {
  switch (e.kind) {
    case "SUBMITTED":
      return "Submitted";
    case "EDITED":
      return "Edited";
    case "TRANSITION":
      return `${formatStatus(e.from)} → ${formatStatus(e.to)}`;
  }
}

function formatStatus(s: string): string {
  return s.replace(/_/g, " ");
}
