import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { getAccessTokenFromRequest } from '../lib/cookies.js';
import { verifyAccessToken } from '../lib/jwt.js';
import { resolveMediaFilePath } from '../lib/uploadPath.js';
import { findByFilename, isPubliclyVisible } from '../repositories/mediaRepository.js';
import { findByIdSafe } from '../repositories/userRepository.js';

/**
 * `GET /uploads/:filename` — the ONLY place a media file's bytes are ever
 * served (docs/architecture/01 §3: same origin as the API, no `/api/v1`
 * prefix — `lib/mediaUrl.ts`'s `toPublicMediaRef` builds exactly this path).
 *
 * Access control (doc09 §7: "reads are public but only for files referenced
 * by published content"): a valid, currently-active admin session (the same
 * cookie `middleware/authenticate.ts` checks, verified inline here rather
 * than reusing that middleware — which throws on a missing/invalid token
 * instead of falling through to the public check this route also needs)
 * bypasses the restriction entirely, so the admin can preview a draft's
 * cover image before it is ever public. Every other caller only gets the
 * file if `mediaRepository.isPubliclyVisible` says so. A media row that
 * does not exist and one that exists but is not yet public return the
 * identical 404 — the same "draft leakage rule" `NotFoundError` documents
 * elsewhere: a 403 here would itself confirm the file exists.
 *
 * Headers follow doc09 §7's table exactly: `Content-Type` from the STORED
 * value (never re-derived from the extension), `nosniff`, and
 * `Content-Disposition: attachment` for a PDF vs `inline` for an image.
 *
 * `Cross-Origin-Resource-Policy: cross-origin` overrides `app.ts`'s global
 * helmet default (`same-origin`) on this route alone. That default is
 * correct everywhere else — every other response here is JSON the API's own
 * origin has no reason to hand another site — but decision D1 puts the web
 * app on a *different* origin from the API on purpose, and this is the one
 * route the web app's own `<img>`/`next/image` tags embed directly. Left at
 * `same-origin`, a real browser blocks every such request outright
 * (`ERR_BLOCKED_BY_RESPONSE.NotSameOrigin`) even though the request itself
 * succeeds — invisible in any test that only reads the HTTP status, which is
 * exactly how this went unnoticed until a real cross-origin browser session
 * caught it.
 */
export const uploadsRouter: Router = Router();

async function isActiveAdminRequest(req: Request): Promise<boolean> {
  const token = getAccessTokenFromRequest(req);
  if (!token) return false;

  const result = verifyAccessToken(token);
  if (result.outcome !== 'valid') return false;

  const userId = Number(result.claims.sub);
  if (!Number.isInteger(userId)) return false;

  const user = await findByIdSafe(userId);
  return Boolean(user && user.isActive && user.tokenVersion === result.claims.tokenVersion);
}

uploadsRouter.get(
  '/:filename',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rawFilename = req.params['filename'];
      const filename = typeof rawFilename === 'string' ? rawFilename : '';
      const media = await findByFilename(filename);
      if (!media) {
        res.status(404).end();
        return;
      }

      const isAdmin = await isActiveAdminRequest(req);
      if (!isAdmin) {
        const visible = await isPubliclyVisible(media.id);
        if (!visible) {
          res.status(404).end();
          return;
        }
      }

      const filePath = resolveMediaFilePath(media.filename);
      try {
        await stat(filePath);
      } catch {
        // A DB row with no file on disk — should not happen, but "the row
        // says it exists" is not the same guarantee as "the bytes are
        // still there" (e.g. a manual ops mistake). 404, not 500: from the
        // caller's perspective this is indistinguishable from "not found".
        res.status(404).end();
        return;
      }

      res.setHeader('Content-Type', media.mimeType);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader(
        'Content-Disposition',
        media.mimeType === 'application/pdf' ? 'attachment' : 'inline',
      );
      // Filenames are content-hashed and never reused for different bytes
      // (storage.ts) — safe to cache forever.
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      createReadStream(filePath).pipe(res);
    } catch (error) {
      next(error);
    }
  },
);
