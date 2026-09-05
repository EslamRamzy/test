import multer from 'multer';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { PayloadTooLargeError, ValidationError } from '../errors/AppError.js';

/**
 * `memoryStorage` — the raw bytes need to reach `lib/mediaProcessing.ts` as
 * a `Buffer` (magic-byte detection, then `sharp`) before anything is ever
 * written to disk under its final, checksum-derived name; there is no
 * intermediate temp-file stage to clean up either way. `limits.files: 1`
 * is doc09 §7's "one file per request", enforced by multer itself rather
 * than left to the controller to check after the fact.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_BYTES, files: 1 },
});

const singleFile = upload.single('file');

/**
 * Wraps multer's own callback-style middleware so every failure — oversized
 * file, more than one file, no file at all — becomes a typed `AppError`
 * instead of an uncaught `MulterError` that `errorHandler.ts` would
 * otherwise mask as a generic 500 (it only recognises `AppError` subclasses,
 * docs/architecture/09 §11).
 */
export function mediaUploadMiddleware(req: Request, res: Response, next: NextFunction): void {
  singleFile(req, res, (error: unknown) => {
    if (error) {
      if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        next(
          new PayloadTooLargeError(
            `File exceeds the ${String(env.MAX_UPLOAD_BYTES)}-byte upload limit`,
          ),
        );
        return;
      }
      next(
        new ValidationError([
          { field: 'file', message: error instanceof Error ? error.message : 'Upload failed' },
        ]),
      );
      return;
    }

    if (!req.file) {
      next(new ValidationError([{ field: 'file', message: 'A file is required' }]));
      return;
    }

    next();
  });
}
