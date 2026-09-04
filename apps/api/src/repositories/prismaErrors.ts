import { Prisma } from '../../generated/prisma/client.js';

/**
 * True for a unique-constraint violation (Prisma error code P2002) — e.g. a
 * duplicate slug or name. Every admin CRUD repository's `create`/`update`
 * catches this and rethrows `ConflictError` (`errors/AppError.ts`) instead
 * of letting the raw Prisma error fall through to `errorHandler.ts`'s
 * generic `InternalError` (500) — a duplicate slug is a 409 a caller can
 * act on, not an unexpected server bug. Kept in `repositories/` (not
 * `lib/`) because only this directory (plus `config/prisma.ts`) may import
 * from the generated Prisma client at all (enforced by ESLint).
 */
export function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
