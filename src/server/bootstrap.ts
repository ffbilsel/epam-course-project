import { readdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { bootstrapAdminMarker, users } from "@/db/schema";
import { logger, logSecurityEvent } from "@/server/infra/logger";

const STAGING_DIR = join(process.cwd(), "data", "uploads", ".staging");
const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Idempotent application bootstrap: promotes (or marks for promotion)
 * the configured bootstrap-admin email per FR-005b, then sweeps
 * orphan staged uploads older than 1 hour. Safe to invoke multiple
 * times.
 */
export async function bootstrap(): Promise<void> {
  const email = process.env["BOOTSTRAP_ADMIN_EMAIL"]?.trim();
  if (email) {
    try {
      const existing = await db
        .select()
        .from(users)
        .where(sql`lower(${users.email}) = lower(${email})`)
        .limit(1);
      const u = existing[0];
      if (u) {
        if (u.role !== "ADMIN") {
          await db
            .update(users)
            .set({ role: "ADMIN", updatedAt: Date.now() })
            .where(eq(users.id, u.id));
          logSecurityEvent({
            event: "role_change",
            userId: u.id,
            actorRole: "ADMIN",
            ip: null,
            requestId: null,
            details: { reason: "bootstrap", to: "ADMIN" },
          });
        }
        // Marker no longer needed
        await db.delete(bootstrapAdminMarker).where(eq(bootstrapAdminMarker.email, email));
      } else {
        await db
          .insert(bootstrapAdminMarker)
          .values({ email, createdAt: Date.now() })
          .onConflictDoNothing();
      }
    } catch (err) {
      logger.warn({ err }, "[bootstrap] admin promotion step failed");
    }
  }

  // Sweep staging dir
  try {
    const entries = readdirSync(STAGING_DIR);
    const cutoff = Date.now() - ONE_HOUR_MS;
    for (const name of entries) {
      const full = join(STAGING_DIR, name);
      try {
        const st = statSync(full);
        if (st.isFile() && st.mtimeMs < cutoff) {
          unlinkSync(full);
        }
      } catch {
        // ignore per-file failures
      }
    }
  } catch {
    // staging dir may not exist yet
  }
}
