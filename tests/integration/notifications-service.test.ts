import { beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { categories, users, notificationEvents, emailDeliveries } from "@/db/schema";
import { hashPassword } from "@/server/password";
import { createIdea, applyTransition } from "@/server/idea-service";
import {
  enqueue,
  listForUser,
  markNotificationRead,
} from "@/server/notification-service";
import { dispatchPending } from "@/server/email-dispatcher";
import {
  getPreferences,
  updatePreferences,
} from "@/server/email-preference-service";
import { FakeEmailTransport } from "../helpers/fake-email-transport";

let authorId: string;
let evaluatorId: string;
let ideaId: string;

async function activeCategoryId(): Promise<string> {
  const rows = await db
    .select()
    .from(categories)
    .where(sql`${categories.name} = 'Other'`)
    .limit(1);
  return rows[0]!.id;
}

beforeEach(async () => {
  const now = Date.now();
  authorId = crypto.randomUUID();
  evaluatorId = crypto.randomUUID();
  await db.insert(users).values([
    {
      id: authorId,
      email: `notify-a-${now}@x.io`,
      passwordHash: await hashPassword("Passw0rd!"),
      displayName: "A",
      role: "EMPLOYEE",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: evaluatorId,
      email: `notify-e-${now}@x.io`,
      passwordHash: await hashPassword("Passw0rd!"),
      displayName: "E",
      role: "EVALUATOR",
      createdAt: now,
      updatedAt: now,
    },
  ]);
  const cat = await activeCategoryId();
  const idea = await createIdea({ title: "Demo", description: "D", categoryId: cat }, authorId);
  ideaId = idea.id;
});

describe("notification-service", () => {
  it("enqueue writes one in-app row + one pending delivery", async () => {
    await enqueue([
      {
        recipientId: authorId,
        recipientRole: "EMPLOYEE",
        actorId: evaluatorId,
        ideaId,
        kind: "STATUS_CHANGED",
        payload: {
          kind: "STATUS_CHANGED",
          ideaTitle: "Demo",
          fromState: "SUBMITTED",
          toState: "UNDER_REVIEW",
          actorDisplayName: "E",
        },
        ideaAnonymous: false,
        actorIsAuthor: false,
        preferenceKey: "statusChanges",
      },
    ]);
    const list = await listForUser(authorId);
    expect(list.unreadCount).toBe(1);
    expect(list.items[0]!.kind).toBe("STATUS_CHANGED");
    const deliveries = await db.select().from(emailDeliveries);
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]!.status).toBe("pending");
  });

  it("preference off → delivery row is suppressed but in-app row still lands", async () => {
    await updatePreferences(authorId, { statusChanges: false });
    await enqueue([
      {
        recipientId: authorId,
        recipientRole: "EMPLOYEE",
        actorId: evaluatorId,
        ideaId,
        kind: "STATUS_CHANGED",
        payload: {
          kind: "STATUS_CHANGED",
          ideaTitle: "Demo",
          fromState: "SUBMITTED",
          toState: "UNDER_REVIEW",
          actorDisplayName: "E",
        },
        ideaAnonymous: false,
        actorIsAuthor: false,
        preferenceKey: "statusChanges",
      },
    ]);
    const list = await listForUser(authorId);
    expect(list.unreadCount).toBe(1);
    const deliveries = await db.select().from(emailDeliveries);
    expect(deliveries[0]!.status).toBe("suppressed");
  });

  it("markNotificationRead is idempotent and enforces recipient", async () => {
    await enqueue([
      {
        recipientId: authorId,
        recipientRole: "EMPLOYEE",
        actorId: evaluatorId,
        ideaId,
        kind: "COMMENT_ADDED",
        payload: {
          kind: "COMMENT_ADDED",
          ideaTitle: "Demo",
          snippet: "hi",
          actorDisplayName: "E",
        },
        ideaAnonymous: false,
        actorIsAuthor: false,
        preferenceKey: "commentsOnMyIdeas",
      },
    ]);
    const list = await listForUser(authorId);
    const id = list.items[0]!.id;
    await markNotificationRead(id, authorId);
    await markNotificationRead(id, authorId); // idempotent
    await expect(markNotificationRead(id, evaluatorId)).rejects.toMatchObject({
      code: "NOTIFICATION_FORBIDDEN",
    });
  });
});

describe("email-dispatcher", () => {
  it("sends pending deliveries via the transport and marks them sent", async () => {
    await enqueue([
      {
        recipientId: authorId,
        recipientRole: "EMPLOYEE",
        actorId: evaluatorId,
        ideaId,
        kind: "STATUS_CHANGED",
        payload: {
          kind: "STATUS_CHANGED",
          ideaTitle: "Demo",
          fromState: "SUBMITTED",
          toState: "UNDER_REVIEW",
          actorDisplayName: "E",
        },
        ideaAnonymous: false,
        actorIsAuthor: false,
        preferenceKey: "statusChanges",
      },
    ]);
    const transport = new FakeEmailTransport();
    const result = await dispatchPending(Date.now(), { transport });
    expect(result.sent).toBe(1);
    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0]!.subject).toContain("UNDER_REVIEW");
    const deliveries = await db.select().from(emailDeliveries);
    expect(deliveries[0]!.status).toBe("sent");
  });

  it("retries after transport failure with back-off and does not throw", async () => {
    await enqueue([
      {
        recipientId: authorId,
        recipientRole: "EMPLOYEE",
        actorId: evaluatorId,
        ideaId,
        kind: "STATUS_CHANGED",
        payload: {
          kind: "STATUS_CHANGED",
          ideaTitle: "Demo",
          fromState: "SUBMITTED",
          toState: "UNDER_REVIEW",
          actorDisplayName: "E",
        },
        ideaAnonymous: false,
        actorIsAuthor: false,
        preferenceKey: "statusChanges",
      },
    ]);
    const transport = new FakeEmailTransport();
    transport.throwOnNextSend = new Error("smtp boom");
    const t0 = Date.now();
    const result = await dispatchPending(t0, { transport });
    expect(result.sent).toBe(0);
    const [row] = await db.select().from(emailDeliveries);
    expect(row!.status).toBe("pending");
    expect(row!.attemptCount).toBe(1);
    expect(row!.nextAttemptAt).toBeGreaterThan(t0);
    expect(row!.lastError).toContain("smtp boom");
  });
});

describe("email-preference-service", () => {
  it("returns defaults all-on when no row exists", async () => {
    const p = await getPreferences(authorId);
    expect(p.statusChanges).toBe(true);
    expect(p.commentsOnMyIdeas).toBe(true);
  });

  it("upserts preferences and rejects unknown keys", async () => {
    const next = await updatePreferences(authorId, { commentsOnMyIdeas: false });
    expect(next.commentsOnMyIdeas).toBe(false);
    expect(next.statusChanges).toBe(true);
    // strict() reject — call directly with cast to bypass TS
    await expect(
      updatePreferences(authorId, { unknown: true } as unknown as Record<string, never>),
    ).rejects.toMatchObject({ code: "EMAIL_PREFERENCE_INVALID" });
  });
});

describe("applyTransition wiring (T050)", () => {
  it("fires STATUS_CHANGED notification to the author when a reviewer transitions", async () => {
    await applyTransition(ideaId, "START_REVIEW", null, {
      id: evaluatorId,
      role: "EVALUATOR",
    });
    const list = await listForUser(authorId);
    expect(list.unreadCount).toBe(1);
    expect(list.items[0]!.kind).toBe("STATUS_CHANGED");
    if (list.items[0]!.payload.kind === "STATUS_CHANGED") {
      expect(list.items[0]!.payload.toState).toBe("UNDER_REVIEW");
    }
    const rows = await db.select().from(notificationEvents);
    expect(rows).toHaveLength(1);
  });
});
