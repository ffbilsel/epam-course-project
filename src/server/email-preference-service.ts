import {
  findPreferencesByUserId,
  upsertPreferences,
} from "@/db/repositories/email-preference-repo";
import { SystemClock, type Clock } from "@/server/infra/clock";
import { logSecurityEvent } from "@/server/infra/logger";
import {
  EmailPreferenceUpdateSchema,
  type EmailPreferenceUpdateInput,
} from "@/lib/validation/email-preference";
import { AppError } from "@/lib/errors/AppError";

/** Phase 5 — Resolved per-user email preferences (defaults all-on). */
export interface EmailPreferences {
  userId: string;
  statusChanges: boolean;
  commentsOnMyIdeas: boolean;
  ratingsOnMyIdeas: boolean;
  repliesOnIdeasIReview: boolean;
  updatedAt: number;
}

const DEFAULTS = {
  statusChanges: true,
  commentsOnMyIdeas: true,
  ratingsOnMyIdeas: true,
  repliesOnIdeasIReview: true,
} as const;

function rowToPrefs(
  row: {
    userId: string;
    statusChanges: number;
    commentsOnMyIdeas: number;
    ratingsOnMyIdeas: number;
    repliesOnIdeasIReview: number;
    updatedAt: number;
  } | undefined,
  fallbackUserId: string,
): EmailPreferences {
  if (!row) {
    return {
      userId: fallbackUserId,
      ...DEFAULTS,
      updatedAt: 0,
    };
  }
  return {
    userId: row.userId,
    statusChanges: Boolean(row.statusChanges),
    commentsOnMyIdeas: Boolean(row.commentsOnMyIdeas),
    ratingsOnMyIdeas: Boolean(row.ratingsOnMyIdeas),
    repliesOnIdeasIReview: Boolean(row.repliesOnIdeasIReview),
    updatedAt: row.updatedAt,
  };
}

/**
 * Returns the email preferences for a user, defaulting all-on when
 * the row is missing (FR-014).
 */
export async function getPreferences(userId: string): Promise<EmailPreferences> {
  const row = await findPreferencesByUserId(userId);
  return rowToPrefs(row, userId);
}

/**
 * Upserts the email preferences for a user. Unknown keys raise
 * `EMAIL_PREFERENCE_INVALID` via the schema's strict mode.
 */
export async function updatePreferences(
  userId: string,
  patch: EmailPreferenceUpdateInput,
  deps: { clock?: Clock } = {},
): Promise<EmailPreferences> {
  const parsed = EmailPreferenceUpdateSchema.safeParse(patch);
  if (!parsed.success) {
    throw new AppError("EMAIL_PREFERENCE_INVALID");
  }
  const clock = deps.clock ?? SystemClock;
  const current = await getPreferences(userId);
  const merged: EmailPreferences = { ...current };
  for (const [k, v] of Object.entries(parsed.data)) {
    if (typeof v === "boolean") {
      (merged as unknown as Record<string, boolean | number | string>)[k] = v;
    }
  }
  const next: EmailPreferences = { ...merged, updatedAt: clock.now().getTime() };
  await upsertPreferences({
    userId,
    statusChanges: next.statusChanges ? 1 : 0,
    commentsOnMyIdeas: next.commentsOnMyIdeas ? 1 : 0,
    ratingsOnMyIdeas: next.ratingsOnMyIdeas ? 1 : 0,
    repliesOnIdeasIReview: next.repliesOnIdeasIReview ? 1 : 0,
    updatedAt: next.updatedAt,
  });
  logSecurityEvent({
    event: "email_preferences_updated",
    userId,
    actorRole: null,
    ip: null,
    requestId: null,
    details: { ...parsed.data },
  });
  return next;
}
