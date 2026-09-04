import { createHash, randomBytes } from 'node:crypto';

/**
 * Filename and integrity helpers for the media store (docs/architecture/09 §7).
 *
 * The full upload pipeline — MIME allow-list, magic-byte verification, size
 * caps, image re-encoding and EXIF stripping via `sharp` — is Phase 9's
 * responsibility, applied to untrusted admin uploads. This module is the
 * small slice of it needed earlier: `prisma/bootstrap.ts` places one
 * developer-supplied, already-trusted file (the profile photo) into the
 * media store in Phase 2, and it must use the exact same naming convention
 * so every `media` row — however it was created — looks identical to the
 * rest of the system.
 */

export function computeSha256(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Server-generated, content-hashed filename: `{sha256[:16]}-{random}.{ext}`.
 *
 * Never derived from the client-supplied filename — that is what makes path
 * traversal and filename-based attacks structurally impossible rather than
 * merely filtered (docs/architecture/09 §7).
 */
export function generateStoredFilename(checksumSha256: string, extension: string): string {
  // Strip everything but letters and digits — not just a leading dot. The
  // caller's `extension` argument must never be trusted to already be safe:
  // a value like `../../etc/passwd` collapses to `etcpasswd` here rather
  // than reaching the filesystem path as a directory traversal.
  const normalizedExt = extension.toLowerCase().replace(/[^a-z0-9]/g, '');
  const safeExt = normalizedExt.length > 0 ? normalizedExt : 'bin';
  const randomSuffix = randomBytes(8).toString('hex');
  return `${checksumSha256.slice(0, 16)}-${randomSuffix}.${safeExt}`;
}
