import { auth } from "@/server/auth-options";
import { AppError } from "@/lib/errors/AppError";
import type { Role } from "@/db/schema";

/**
 * Authenticated session shape, narrowed to what the app actually uses.
 */
export interface AppSession {
  user: { id: string; email: string; displayName: string; role: Role };
}

/**
 * Returns the active session or throws `AUTH_SESSION_EXPIRED`.
 */
export async function requireSession(): Promise<AppSession> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new AppError("AUTH_SESSION_EXPIRED");
  }
  return session as unknown as AppSession;
}

/**
 * Returns the active session if the caller has at least one of the
 * allowed roles; otherwise throws `AUTH_FORBIDDEN_ROLE`.
 */
export async function requireRole(allowed: Role | Role[]): Promise<AppSession> {
  const session = await requireSession();
  const allow = Array.isArray(allowed) ? allowed : [allowed];
  if (!allow.includes(session.user.role)) {
    throw new AppError("AUTH_FORBIDDEN_ROLE");
  }
  return session;
}
