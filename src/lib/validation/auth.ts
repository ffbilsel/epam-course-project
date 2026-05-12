import { z } from "zod";
import { ERROR_CODES } from "@/lib/errors/codes";
import { errorMessages } from "@/lib/errors/error-messages";

const policy = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

/**
 * Body schema for `POST /api/auth/register` (FR-001, FR-002).
 */
export const RegisterSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().regex(policy, { message: errorMessages.USER_PASSWORD_POLICY }),
  displayName: z.string().trim().min(1).max(80),
});
/** Inferred TypeScript type for {@link RegisterSchema}. */
export type RegisterInput = z.infer<typeof RegisterSchema>;

/**
 * Body schema for sign-in via NextAuth Credentials provider.
 */
export const LoginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});
/** Inferred TypeScript type for {@link LoginSchema}. */
export type LoginInput = z.infer<typeof LoginSchema>;

// Re-export to make codes discoverable for `check:error-codes`
export const _registryRef = ERROR_CODES;
