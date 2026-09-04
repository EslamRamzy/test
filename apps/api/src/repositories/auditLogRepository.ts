import { prisma } from '../config/prisma.js';
import type { PrismaClientOrTx } from '../config/prisma.js';

/**
 * Append-only audit trail (docs/architecture/05 §7, docs/architecture/09
 * T8). There is deliberately no `update` or `delete` export in this file —
 * not because nothing calls them, but because writing them would be the
 * mechanism by which the audit trail stops being trustworthy. If a future
 * requirement needs to correct a bad entry, that is a new compensating
 * entry, never a mutation of the old one.
 *
 * `record` takes a `client` (defaulting to the shared singleton) so callers
 * can pass the `tx` from `prisma.$transaction(async (tx) => ...)` and have
 * the audit write commit or roll back atomically with the change it
 * describes — the whole point of "audit coupling" (doc 05 §7): if the write
 * fails, the mutation it would have recorded never happened either.
 */

export interface RecordAuditEventInput {
  /** Null for actions with no acting user — e.g. a failed login for an email that doesn't exist. */
  userId: number | null;
  action: string;
  entityType?: string;
  entityId?: number;
  /** Redacted, secret-free JSON — never a password, token, or hash (doc 09 §9). */
  metadata?: Record<string, unknown>;
  ipHash?: string;
  userAgent?: string;
}

export function record(input: RecordAuditEventInput, client: PrismaClientOrTx = prisma) {
  return client.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
      ipHash: input.ipHash ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}
