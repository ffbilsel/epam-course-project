import { Badge, type BadgeProps } from "@/components/ui/badge";

const STATUS_VARIANT: Record<string, BadgeProps["variant"]> = {
  SUBMITTED: "info",
  UNDER_REVIEW: "warning",
  APPROVED: "success",
  IMPLEMENTED: "success",
  REJECTED: "destructive",
};

/**
 * Renders an idea status as a color-coded badge.
 */
export function StatusBadge({ status }: { status: string }): JSX.Element {
  const variant = STATUS_VARIANT[status] ?? "secondary";
  return <Badge variant={variant}>{status.replace(/_/g, " ")}</Badge>;
}
