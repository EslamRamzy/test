import type { MessageStatus } from '@portfolio/shared';
import { prisma } from '../config/prisma.js';
import { NotFoundError } from '../errors/AppError.js';
import * as auditLogRepository from '../repositories/auditLogRepository.js';
import * as messageRepository from '../repositories/messageRepository.js';
import type { MessageListParams } from '../repositories/messageRepository.js';

/** One audit action per status transition, verb-shaped like every other module's own action names (`ARTICLE_PUBLISH`, not `ARTICLE_PUBLISHED`) rather than a single generic `MESSAGE_STATUS_UPDATE` that would erase which transition actually happened. */
const ACTION_BY_STATUS: Record<MessageStatus, string> = {
  UNREAD: 'MESSAGE_MARK_UNREAD',
  READ: 'MESSAGE_MARK_READ',
  ARCHIVED: 'MESSAGE_ARCHIVE',
};

export function list(params: MessageListParams) {
  return messageRepository.list(params);
}

export async function updateStatus(id: number, status: MessageStatus, actorId: number) {
  return prisma.$transaction(async (tx) => {
    const existing = await messageRepository.findById(id, tx);
    if (!existing) throw new NotFoundError('Message not found');
    const row = await messageRepository.updateStatus(id, status, tx);
    await auditLogRepository.record(
      { userId: actorId, action: ACTION_BY_STATUS[status], entityType: 'MESSAGE', entityId: id },
      tx,
    );
    return row;
  });
}

export async function remove(id: number, actorId: number): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await messageRepository.findById(id, tx);
    if (!existing) throw new NotFoundError('Message not found');
    await messageRepository.remove(id, tx);
    await auditLogRepository.record(
      { userId: actorId, action: 'MESSAGE_DELETE', entityType: 'MESSAGE', entityId: id },
      tx,
    );
  });
}
