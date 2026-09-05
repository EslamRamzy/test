import { join, resolve } from 'node:path';
import { env } from '../config/env.js';

/**
 * `env.UPLOAD_DIR` is relative to `process.cwd()` — `apps/api/` locally, the
 * container's `/app` in production — same convention `prisma/bootstrap.ts`
 * already uses for the one file it stages before this module existed. One
 * place both `mediaService.ts` (writes) and the `/uploads/*` serving route
 * (reads) resolve it from, so they can never disagree about where a file
 * actually lives.
 */
export function resolveUploadDir(): string {
  return resolve(process.cwd(), env.UPLOAD_DIR);
}

export function resolveMediaFilePath(filename: string): string {
  return join(resolveUploadDir(), filename);
}
