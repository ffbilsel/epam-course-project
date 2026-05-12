/* eslint-disable no-console */
/**
 * One-shot helper used by CI (and quick local setups) to create the
 * bootstrap admin account. Idempotent: if the email already exists,
 * the script exits 0 without changes. The bootstrap promotion in
 * `src/server/bootstrap.ts` + `applyBootstrapPromotionIfMatch` will
 * elevate the new user to ADMIN as long as `BOOTSTRAP_ADMIN_EMAIL`
 * matches and the marker has not been consumed.
 *
 * Usage:
 *   BOOTSTRAP_ADMIN_EMAIL=admin@example.test \
 *   BOOTSTRAP_ADMIN_PASSWORD=Passw0rd!2024 \
 *   npx tsx scripts/seed-admin.ts
 */
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { bootstrapAdminMarker, users } from "@/db/schema";
import { registerUser } from "@/server/user-service";

async function main(): Promise<void> {
  const email = process.env["BOOTSTRAP_ADMIN_EMAIL"];
  const password = process.env["BOOTSTRAP_ADMIN_PASSWORD"];
  const displayName = process.env["BOOTSTRAP_ADMIN_NAME"] ?? "Bootstrap Admin";
  if (!email || !password) {
    console.error("[seed-admin] BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD are required.");
    process.exit(1);
  }

  const existing = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email})`)
    .limit(1);
  if (existing.length > 0) {
    console.log(`[seed-admin] User ${email} already exists (role=${existing[0]?.role}); skipping.`);
    return;
  }

  await ensureBootstrapMarker(email);
  const created = await registerUser({ email, password, displayName });
  console.log(`[seed-admin] Created ${created.email} as ${created.role} (id=${created.id}).`);
}

async function ensureBootstrapMarker(email: string): Promise<void> {
  await db
    .insert(bootstrapAdminMarker)
    .values({ email, createdAt: Date.now() })
    .onConflictDoNothing();
}

main().catch((err: unknown) => {
  console.error("[seed-admin] failed:", err);
  process.exit(1);
});
