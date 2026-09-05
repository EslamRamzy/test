import { z } from 'zod';
import { MESSAGE_STATUSES } from '../constants/content.js';

/**
 * The contact-message inbox (doc03 §5: `PATCH /admin/messages/:id/status
 * { status: UNREAD|READ|ARCHIVED }`; doc07 §3: "mark read/unread, archive").
 * One shared transition endpoint for all three states — a distinct
 * "mark read" vs. "mark unread" pair would just be this same shape with an
 * enum of two, and archive is exactly as much a status transition as
 * either of those.
 *
 * There is deliberately no message CREATE/UPDATE-content schema here: a row
 * only ever arrives via the public contact form (`contactSchema`), and its
 * own content (name/email/subject/message) is never editable afterward —
 * the admin's only lever on an existing message is its status.
 */
export const messageStatusUpdateSchema = z
  .object({
    status: z.enum(MESSAGE_STATUSES),
  })
  .strict();
export type MessageStatusUpdateInput = z.infer<typeof messageStatusUpdateSchema>;
