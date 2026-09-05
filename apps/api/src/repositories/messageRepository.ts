import type { MessageStatus } from '@portfolio/shared';
import { prisma } from '../config/prisma.js';
import type { PrismaClientOrTx } from '../config/prisma.js';

/**
 * The contact-message inbox (doc03 §5, doc07 §3). Unlike every other admin
 * module, there is no `create` here at all — a row only ever arrives via
 * the public contact form (`contactMessageRepository.ts`'s own `create`),
 * so this file only ever reads, transitions status, and deletes.
 */

export interface MessageListParams {
  page: number;
  pageSize: number;
  q?: string | undefined;
  status?: MessageStatus | undefined;
}

export async function list(params: MessageListParams) {
  const where = {
    ...(params.status ? { status: params.status } : {}),
    ...(params.q
      ? {
          OR: [
            { name: { contains: params.q } },
            { email: { contains: params.q } },
            { subject: { contains: params.q } },
            { message: { contains: params.q } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.contactMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    prisma.contactMessage.count({ where }),
  ]);
  return { items, total };
}

export function findById(id: number, client: PrismaClientOrTx = prisma) {
  return client.contactMessage.findUnique({ where: { id } });
}

/**
 * `readAt` tracks whether the message is CURRENTLY read, not merely
 * "was ever read": transitioning to READ stamps it with now, transitioning
 * back to UNREAD clears it, and ARCHIVED leaves it exactly as it already
 * was (an archived message's read history doesn't change just because it
 * moved out of the inbox).
 */
export function updateStatus(id: number, status: MessageStatus, client: PrismaClientOrTx = prisma) {
  const data =
    status === 'READ'
      ? { status, readAt: new Date() }
      : status === 'UNREAD'
        ? { status, readAt: null }
        : { status };
  return client.contactMessage.update({ where: { id }, data });
}

export function remove(id: number, client: PrismaClientOrTx = prisma) {
  return client.contactMessage.delete({ where: { id } });
}
