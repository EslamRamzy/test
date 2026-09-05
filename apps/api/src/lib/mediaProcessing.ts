import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
import { UnsupportedMediaTypeError } from '../errors/AppError.js';

/**
 * The upload processing pipeline (docs/architecture/09 §7): real magic-byte
 * type detection — never the client's `Content-Type` header and never the
 * uploaded filename — an allow-list of exactly five types, and (for images)
 * a `sharp` re-encode that auto-orients from EXIF and then discards it,
 * along with every other metadata block (GPS, camera model, any polyglot
 * payload riding along in an APP segment). SVG is not on the allow-list and
 * is never detected by `file-type` in the first place (it is XML text, not
 * a magic-byte format) — it fails the same "unrecognised type" path as a
 * `.php`/`.exe` upload, which is the deliberate rejection doc09 §7 calls for.
 */

const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const ALLOWED_MIME_TYPES = new Set([...ALLOWED_IMAGE_MIME_TYPES, 'application/pdf']);

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'application/pdf': 'pdf',
};

export interface ProcessedUpload {
  /** The bytes to actually write to disk — re-encoded for images, untouched for PDFs. */
  buffer: Buffer;
  /** The DETECTED type, never the client-supplied one. */
  mimeType: string;
  extension: string;
  sizeBytes: number;
  /** `null` for PDFs — dimensions are an image-only concept. */
  width: number | null;
  height: number | null;
}

/**
 * Validates and, for images, re-encodes an uploaded file's raw bytes.
 * Throws `UnsupportedMediaTypeError` for anything outside the allow-list —
 * including SVG, `.php`, `.exe`, a truncated/empty buffer, a genuine image
 * format this app doesn't accept (e.g. GIF, BMP), or bytes that merely
 * claim to be an allowed image type but are corrupt enough that `sharp`
 * cannot actually decode them.
 */
export async function processUpload(rawBuffer: Buffer): Promise<ProcessedUpload> {
  const detected = await fileTypeFromBuffer(rawBuffer);

  if (!detected || !ALLOWED_MIME_TYPES.has(detected.mime)) {
    throw new UnsupportedMediaTypeError(
      'Unsupported file type — only JPEG, PNG, WebP, AVIF and PDF are accepted.',
    );
  }

  const extension = EXTENSION_BY_MIME_TYPE[detected.mime] ?? 'bin';

  if (detected.mime === 'application/pdf') {
    return {
      buffer: rawBuffer,
      mimeType: detected.mime,
      extension,
      sizeBytes: rawBuffer.length,
      width: null,
      height: null,
    };
  }

  try {
    // `.rotate()` with no argument auto-orients from the EXIF orientation
    // tag BEFORE that tag (and everything else in EXIF/GPS/ICC) is dropped —
    // never calling `.withMetadata()` is what keeps the output metadata-free;
    // sharp does not embed source metadata unless asked to.
    const pipeline = sharp(rawBuffer, { failOn: 'error' }).rotate();
    const encoded =
      detected.mime === 'image/jpeg'
        ? pipeline.jpeg({ quality: 90 })
        : detected.mime === 'image/png'
          ? pipeline.png()
          : detected.mime === 'image/webp'
            ? pipeline.webp({ quality: 90 })
            : pipeline.avif({ quality: 60 });

    const { data, info } = await encoded.toBuffer({ resolveWithObject: true });
    return {
      buffer: data,
      mimeType: detected.mime,
      extension,
      sizeBytes: data.length,
      width: info.width,
      height: info.height,
    };
  } catch {
    throw new UnsupportedMediaTypeError(
      'The uploaded file could not be processed as a valid image.',
    );
  }
}

/**
 * The client-supplied filename is never used for the storage path (that is
 * `generateStoredFilename`'s job, from a checksum) — but it IS shown back
 * to the admin as `originalName`, so it needs its own sanitisation: strip
 * any path segment (the traversal-relevant part) and any character outside
 * a safe display set, rather than trusting it even for display.
 */
export function sanitizeOriginalName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? '';
  const cleaned = base.replace(/[^\w.\- ]/g, '').trim();
  return cleaned.length > 0 ? cleaned.slice(0, 255) : 'file';
}
