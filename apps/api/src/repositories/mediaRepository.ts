import type { MediaKind, MediaUsageRef } from '@portfolio/shared';
import { prisma } from '../config/prisma.js';
import type { PrismaClientOrTx } from '../config/prisma.js';
import { stripUndefined } from '../lib/stripUndefined.js';

/**
 * The media library's repository (doc07 §3, doc09 §7). Unlike the other 13
 * admin modules, this one is NOT built on `services/adminCrudFactory.ts`:
 * `create` here is an upload with side effects (a real file write, magic-byte
 * validation) rather than a plain insert, and `remove` must first check
 * every other table for a reference — the factory's generic shape doesn't
 * fit either, so `mediaService.ts` orchestrates these functions directly
 * instead (same reasoning as Projects' tabbed-editor services).
 */

export interface MediaListParams {
  page: number;
  pageSize: number;
  q?: string | undefined;
  kind?: MediaKind | undefined;
}

export async function list(params: MediaListParams) {
  const where = {
    ...(params.kind ? { kind: params.kind } : {}),
    ...(params.q
      ? {
          OR: [{ originalName: { contains: params.q } }, { altText: { contains: params.q } }],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.media.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    prisma.media.count({ where }),
  ]);
  return { items, total };
}

export function findById(id: number, client: PrismaClientOrTx = prisma) {
  return client.media.findUnique({ where: { id } });
}

/** The `/uploads/:filename` serving route's only lookup — `filename` is the generated, checksum-derived name (`storage.ts`'s `generateStoredFilename`), never a client-supplied path. */
export function findByFilename(filename: string, client: PrismaClientOrTx = prisma) {
  return client.media.findUnique({ where: { filename } });
}

/** Upload dedup (same convention as `prisma/bootstrap.ts`'s own `bootstrapAvatarMedia`): re-running an upload of bytes already stored reuses the existing row rather than writing the file twice. */
export function findByChecksum(checksumSha256: string, client: PrismaClientOrTx = prisma) {
  return client.media.findFirst({ where: { checksumSha256 } });
}

export interface CreateMediaInput {
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  checksumSha256: string;
  storagePath: string;
  altText: string | null;
  kind: MediaKind;
  uploadedBy: number;
}

export function create(data: CreateMediaInput, client: PrismaClientOrTx = prisma) {
  return client.media.create({ data });
}

export interface UpdateMediaInput {
  altText?: string | null | undefined;
  kind?: MediaKind | undefined;
}

/** `PATCH /admin/media/:id` — doc03's own documented shape ("alt text, kind"): altText and/or kind, either independently updatable. */
export function update(id: number, data: UpdateMediaInput, client: PrismaClientOrTx = prisma) {
  return client.media.update({ where: { id }, data: stripUndefined(data) });
}

export async function remove(id: number, client: PrismaClientOrTx = prisma): Promise<void> {
  await client.media.delete({ where: { id } });
}

export async function totalStorageBytes(client: PrismaClientOrTx = prisma): Promise<number> {
  const result = await client.media.aggregate({ _sum: { sizeBytes: true } });
  return result._sum.sizeBytes ?? 0;
}

/**
 * Every place a media row is referenced (doc07 §3's "usage list", doc09 §7's
 * reference-blocked deletion). Six parallel queries, one per relation —
 * there is no single FK to walk since a `Media` row can be pointed at from
 * six different tables (`Media.*Of` reverse relations in schema.prisma).
 */
export async function findUsage(
  mediaId: number,
  client: PrismaClientOrTx = prisma,
): Promise<MediaUsageRef[]> {
  const [profile, projectCovers, projectImages, articleCovers, researchCovers, certifications] =
    await Promise.all([
      client.profile.findUnique({
        where: { id: 1 },
        select: { id: true, fullName: true, avatarMediaId: true, resumeMediaId: true },
      }),
      client.project.findMany({
        where: { coverMediaId: mediaId },
        select: { id: true, title: true },
      }),
      client.projectImage.findMany({
        where: { mediaId },
        select: { projectId: true, project: { select: { title: true } } },
      }),
      client.article.findMany({
        where: { coverMediaId: mediaId },
        select: { id: true, title: true },
      }),
      client.securityResearch.findMany({
        where: { coverMediaId: mediaId },
        select: { id: true, title: true },
      }),
      client.certification.findMany({
        where: { certificateMediaId: mediaId },
        select: { id: true, name: true },
      }),
    ]);

  const usage: MediaUsageRef[] = [];
  if (profile?.avatarMediaId === mediaId) {
    usage.push({ entityType: 'PROFILE_AVATAR', entityId: profile.id, label: profile.fullName });
  }
  if (profile?.resumeMediaId === mediaId) {
    usage.push({ entityType: 'PROFILE_RESUME', entityId: profile.id, label: profile.fullName });
  }
  for (const project of projectCovers) {
    usage.push({ entityType: 'PROJECT_COVER', entityId: project.id, label: project.title });
  }
  for (const image of projectImages) {
    usage.push({
      entityType: 'PROJECT_IMAGE',
      entityId: image.projectId,
      label: image.project.title,
    });
  }
  for (const article of articleCovers) {
    usage.push({ entityType: 'ARTICLE_COVER', entityId: article.id, label: article.title });
  }
  for (const research of researchCovers) {
    usage.push({
      entityType: 'SECURITY_RESEARCH_COVER',
      entityId: research.id,
      label: research.title,
    });
  }
  for (const certification of certifications) {
    usage.push({
      entityType: 'CERTIFICATION',
      entityId: certification.id,
      label: certification.name,
    });
  }
  return usage;
}

/**
 * Public read access control for `/uploads/*` (doc09 §7: "reads are public
 * but only for files referenced by published content"). The profile's
 * avatar/resume are always public (the profile has no draft state at all);
 * a project/article/research cover or gallery image only once its owning
 * entity is actually PUBLISHED (and its `publishedAt` has passed); a
 * certificate only once its certification is `visible`. Six cheap `count`
 * queries rather than one — a media row can be referenced from more than
 * one place at once (unlikely in practice, never disallowed), so this
 * returns true the moment ANY relation would make it public rather than
 * assuming a single owner.
 */
export async function isPubliclyVisible(
  mediaId: number,
  client: PrismaClientOrTx = prisma,
): Promise<boolean> {
  const now = new Date();
  const publishedFilter = { status: 'PUBLISHED', publishedAt: { lte: now } };

  const counts = await Promise.all([
    client.profile.count({
      where: { id: 1, OR: [{ avatarMediaId: mediaId }, { resumeMediaId: mediaId }] },
    }),
    client.project.count({ where: { coverMediaId: mediaId, ...publishedFilter } }),
    client.projectImage.count({ where: { mediaId, project: publishedFilter } }),
    client.article.count({ where: { coverMediaId: mediaId, ...publishedFilter } }),
    client.securityResearch.count({ where: { coverMediaId: mediaId, ...publishedFilter } }),
    client.certification.count({ where: { certificateMediaId: mediaId, visible: true } }),
  ]);
  return counts.some((count) => count > 0);
}
