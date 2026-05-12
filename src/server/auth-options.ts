import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { LoginSchema } from "@/lib/validation/auth";
import { verifyPassword } from "@/server/password";
import { logSecurityEvent } from "@/server/infra/logger";
import type { Role } from "@/db/schema";

const SESSION_MAX_AGE_SEC = 24 * 60 * 60;

const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db) as never,
  session: { strategy: "database", maxAge: SESSION_MAX_AGE_SEC, updateAge: 0 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = LoginSchema.safeParse(raw);
        if (!parsed.success) {
          logSecurityEvent({
            event: "login_failure",
            userId: null,
            actorRole: null,
            ip: null,
            requestId: null,
            details: { reason: "validation" },
          });
          return null;
        }
        const { email, password } = parsed.data;
        const lookup = await db
          .select()
          .from(users)
          .where(sql`lower(${users.email}) = lower(${email})`)
          .limit(1);
        const u = lookup[0];
        if (!u) {
          logSecurityEvent({
            event: "login_failure",
            userId: null,
            actorRole: null,
            ip: null,
            requestId: null,
            details: { email },
          });
          return null;
        }
        const ok = await verifyPassword(password, u.passwordHash);
        if (!ok) {
          logSecurityEvent({
            event: "login_failure",
            userId: u.id,
            actorRole: u.role,
            ip: null,
            requestId: null,
          });
          return null;
        }
        logSecurityEvent({
          event: "login_success",
          userId: u.id,
          actorRole: u.role,
          ip: null,
          requestId: null,
        });
        return { id: u.id, email: u.email, name: u.displayName, role: u.role };
      },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user && user) {
        const dbUser = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
        const u = dbUser[0];
        if (u) {
          (session.user as { id: string }).id = u.id;
          (session.user as { role: Role }).role = u.role;
          (session.user as { displayName: string }).displayName = u.displayName;
          session.user.email = u.email;
          session.user.name = u.displayName;
        }
        // Sliding expiry: bump expires by 24h on each touch (FR-027)
        session.expires = new Date(
          Date.now() + SESSION_MAX_AGE_SEC * 1000,
        ).toISOString() as unknown as typeof session.expires;
      }
      return session;
    },
  },
});

export { handlers, auth, signIn, signOut };

/**
 * Backwards-compatible alias used throughout the app.
 */
export const getServerSession = auth;
