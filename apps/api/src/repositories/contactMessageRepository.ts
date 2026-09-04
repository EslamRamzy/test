import { prisma } from '../config/prisma.js';

export interface CreateContactMessageInput {
  name: string;
  email: string;
  subject: string | undefined;
  message: string;
  ipHash: string | undefined;
  userAgent: string | undefined;
  spamScore: number;
}

export function create(input: CreateContactMessageInput) {
  return prisma.contactMessage.create({
    data: {
      name: input.name,
      email: input.email,
      subject: input.subject ?? null,
      message: input.message,
      ipHash: input.ipHash ?? null,
      userAgent: input.userAgent ?? null,
      spamScore: input.spamScore,
    },
  });
}

/** For the 10/day global cap (docs/architecture/09 §4) — a count, not a per-key rate-limit bucket. */
export function countSince(since: Date) {
  return prisma.contactMessage.count({ where: { createdAt: { gte: since } } });
}
