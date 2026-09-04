import { prisma } from '../config/prisma.js';

export interface CreatePageViewInput {
  path: string;
  entityType: 'PROJECT' | 'ARTICLE' | 'RESEARCH' | 'PAGE' | undefined;
  entityId: number | undefined;
  referrerHost: string | undefined;
  visitorHash: string;
}

export function create(input: CreatePageViewInput) {
  return prisma.pageView.create({
    data: {
      path: input.path,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      referrerHost: input.referrerHost ?? null,
      visitorHash: input.visitorHash,
    },
  });
}
