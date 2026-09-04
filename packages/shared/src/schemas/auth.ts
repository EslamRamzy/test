import { z } from 'zod';
import { COMMON_PASSWORDS } from '../constants/commonPasswords.js';
import { emailSchema } from './primitives.js';

/**
 * Password policy (docs/architecture/04 §4): minimum 12 characters, checked
 * against a small common-password list, no maximum below 128, no composition
 * rules ("they push users toward `Password1!`"), no truncation.
 *
 * Shared rather than API-only so a future admin UI can give the same
 * feedback client-side — but this is never the only check: the API always
 * re-validates server-side regardless of what the client already checked
 * (docs/architecture/03 §31, "never trust client-side validation alone").
 */
export const newPasswordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(128, 'Password must be at most 128 characters')
  .refine(
    (password) => !COMMON_PASSWORDS.includes(password.toLowerCase().replace(/\s+/g, '')),
    'That password is too common — choose something less predictable',
  );

/**
 * The login credential itself has no length/complexity policy of its own —
 * it is checked against whatever hash is on file, whatever that password
 * was when it was set. Only a generous upper bound guards against a
 * pathological input reaching argon2.
 */
export const loginPasswordSchema = z.string().min(1).max(1024);

export const loginSchema = z
  .object({
    email: emailSchema,
    password: loginPasswordSchema,
  })
  .strict();
export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: loginPasswordSchema,
    newPassword: newPasswordSchema,
  })
  .strict();
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** The shape returned by GET /auth/me and embedded in a successful login response. */
export const authUserSchema = z.object({
  id: z.number().int().positive(),
  email: emailSchema,
  name: z.string(),
  role: z.enum(['ADMIN', 'SUPER_ADMIN', 'EDITOR']),
  mustChangePassword: z.boolean(),
});
export type AuthUser = z.infer<typeof authUserSchema>;
