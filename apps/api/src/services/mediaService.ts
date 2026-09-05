import { mkdir, unlink, writeFile } from 'node:fs/promises';
import type { MediaKind } from '@portfolio/shared';
import { prisma } from '../config/prisma.js';
import { ConflictError, NotFoundError } from '../errors/AppError.js';
import { processUpload, sanitizeOriginalName } from '../lib/mediaProcessing.js';
import { computeSha256, generateStoredFilename } from '../lib/storage.js';
import { resolveMediaFilePath, resolveUploadDir } from '../lib/uploadPath.js';
import * as auditLogRepository from '../repositories/auditLogRepository.js';
import * as mediaRepository from '../repositories/mediaRepository.js';
import type { MediaListParams } from '../repositories/mediaRepository.js';

/**
 * A generous but real ceiling (doc09 §7: "storage exhaustion: upload rate
 * limit + a total-storage check before write"). This is a personal-portfolio
 * VPS volume, not a multi-tenant service — 5 GiB is comfortably above what a
 * few hundred project screenshots, article covers and certificate PDFs will
 * ever reach, while still catching a runaway or abusive upload loop before
 * it fills the same disk the SQLite file lives on (docker-compose.yml's
 * single `portfolio-data` volume, decision D3).
 */
export const MAX_TOTAL_STORAGE_BYTES = 5 * 1024 * 1024 * 1024;

export interface UploadMediaInput {
  buffer: Buffer;
  originalNameRaw: string;
  kind: MediaKind;
  altText: string | null;
  actorId: number;
}

/**
 * Pure arithmetic, exported so it can be unit-tested directly against small
 * numbers — actually driving the real 5 GiB cap end-to-end would mean
 * writing several gigabytes of fixture data in CI, which buys nothing a
 * plain arithmetic check doesn't already prove.
 */
export function wouldExceedStorageCap(
  currentTotalBytes: number,
  incomingBytes: number,
  capBytes: number = MAX_TOTAL_STORAGE_BYTES,
): boolean {
  return currentTotalBytes + incomingBytes > capBytes;
}

/**
 * Checked against the RAW upload size, before `processUpload` re-encodes it
 * — the final on-disk size is usually smaller (re-compression) but is not
 * known until after that step, and this check exists to reject an upload
 * BEFORE doing the expensive processing work at all, not just before the
 * disk write (doc09 §7's "before write" is about the write, not the check
 * timing — checking earlier is strictly more conservative, never less).
 */
export async function upload(input: UploadMediaInput) {
  const currentTotal = await mediaRepository.totalStorageBytes();
  if (wouldExceedStorageCap(currentTotal, input.buffer.length)) {
    throw new ConflictError('Storage is full — delete unused media before uploading more.');
  }

  const processed = await processUpload(input.buffer);
  const checksum = computeSha256(processed.buffer);

  const existing = await mediaRepository.findByChecksum(checksum);
  if (existing) {
    // Same bytes already stored (matches `prisma/bootstrap.ts`'s own dedup
    // convention) — reuse the row rather than writing the file twice, but
    // still record that this admin performed an upload action.
    await auditLogRepository.record({
      userId: input.actorId,
      action: 'MEDIA_UPLOAD',
      entityType: 'MEDIA',
      entityId: existing.id,
    });
    return existing;
  }

  const filename = generateStoredFilename(checksum, processed.extension);

  // The file is written to disk BEFORE the DB row, deliberately: if the DB
  // insert then fails, the result is an orphaned file with no referencing
  // row (harmless — nothing ever links to it, and a retry with the same
  // bytes reuses the identical generated filename). The reverse order would
  // risk a DB row pointing at a file that was never actually written, which
  // 404s forever with no way to self-heal by re-uploading.
  await mkdir(resolveUploadDir(), { recursive: true });
  await writeFile(resolveMediaFilePath(filename), processed.buffer);

  return prisma.$transaction(async (tx) => {
    const created = await mediaRepository.create(
      {
        filename,
        originalName: sanitizeOriginalName(input.originalNameRaw),
        mimeType: processed.mimeType,
        sizeBytes: processed.sizeBytes,
        width: processed.width,
        height: processed.height,
        checksumSha256: checksum,
        storagePath: filename,
        altText: input.altText,
        kind: input.kind,
        uploadedBy: input.actorId,
      },
      tx,
    );
    await auditLogRepository.record(
      { userId: input.actorId, action: 'MEDIA_UPLOAD', entityType: 'MEDIA', entityId: created.id },
      tx,
    );
    return created;
  });
}

export function list(params: MediaListParams) {
  return mediaRepository.list(params);
}

export async function read(id: number) {
  const media = await mediaRepository.findById(id);
  if (!media) throw new NotFoundError('Media not found');
  const usage = await mediaRepository.findUsage(id);
  return { media, usage };
}

export async function update(id: number, altText: string | null, actorId: number) {
  return prisma.$transaction(async (tx) => {
    const existing = await mediaRepository.findById(id, tx);
    if (!existing) throw new NotFoundError('Media not found');
    const row = await mediaRepository.updateAltText(id, altText, tx);
    await auditLogRepository.record(
      { userId: actorId, action: 'MEDIA_UPDATE', entityType: 'MEDIA', entityId: id },
      tx,
    );
    return row;
  });
}

/** Blocked while referenced anywhere (doc09 §7) — the usage check runs BEFORE the delete, never left for a foreign-key error to surface as a generic 500. */
export async function remove(id: number, actorId: number): Promise<void> {
  const existing = await mediaRepository.findById(id);
  if (!existing) throw new NotFoundError('Media not found');

  const usage = await mediaRepository.findUsage(id);
  if (usage.length > 0) {
    const summary = usage.map((ref) => ref.label).join(', ');
    throw new ConflictError(
      `Cannot delete — still referenced by: ${summary}. Remove it from there first.`,
    );
  }

  await prisma.$transaction(async (tx) => {
    await mediaRepository.remove(id, tx);
    await auditLogRepository.record(
      { userId: actorId, action: 'MEDIA_DELETE', entityType: 'MEDIA', entityId: id },
      tx,
    );
  });

  await unlink(resolveMediaFilePath(existing.filename)).catch(() => {
    // The DB row is already gone either way — a leftover file on disk is a
    // cheap, recoverable side effect (nothing references it any more, and
    // re-uploading the same bytes later just reuses the same generated
    // filename). Failing the whole delete over an unlink error would leave
    // the admin unable to remove a row that no longer has any real referent.
  });
}
