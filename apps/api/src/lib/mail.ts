import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from './logger.js';

/**
 * Optional SMTP notification when a contact-form message is stored
 * (docs/architecture/09 §8, Phase 10). "Optional" is the whole point —
 * `isMailEnabled()` is the feature flag, and it is simply whether
 * `EMAIL_HOST` is configured; there is no separate boolean toggle to keep
 * in sync with it.
 *
 * The mail-header-injection defence doc09 §8 calls out ("From/Reply-To/
 * Subject are built from validated values, never raw string concatenation")
 * is nodemailer's own structured `from`/`to`/`replyTo`/`subject` options —
 * passing user input through THOSE (never building a raw header string by
 * hand) is what actually encodes/folds a value safely regardless of what
 * characters it contains. `nodemailer@10` also carries the fix for the
 * CRLF-header-injection CVE this exact class of bug was reported as
 * (GHSA-268h-hp4c-crq3) — pinned as `^10.0.0`, not left on the vulnerable
 * `<=9.0.0` range `npm audit` flagged when this was first installed.
 */

export function isMailEnabled(): boolean {
  return env.EMAIL_HOST !== undefined;
}

/** A fresh transport per call, not cached — this fires a handful of times a day at most (one per contact submission), so the connection-reuse a cached transporter would buy is not worth the added state. `host` is a required parameter (not read from `env` directly) so its type stays a plain `string` for the caller, who only ever calls this after `isMailEnabled()` has already confirmed it is set. */
function createTransport(host: string) {
  return nodemailer.createTransport({
    host,
    port: env.EMAIL_PORT ?? 587,
    secure: env.EMAIL_PORT === 465,
    ...(env.EMAIL_USER && env.EMAIL_PASSWORD
      ? { auth: { user: env.EMAIL_USER, pass: env.EMAIL_PASSWORD } }
      : {}),
  });
}

export interface ContactNotificationInput {
  name: string;
  email: string;
  subject: string | null;
  message: string;
}

/**
 * Best-effort, exactly like `revalidate.ts`'s own `revalidateTags` (same
 * shape, same reasoning): the message is already persisted by the time this
 * runs, so a mail failure here must never surface as a failed request
 * (doc09 §8: "Email failure never fails the request"). Every failure path
 * is caught and logged, never thrown.
 */
export async function sendContactNotification(input: ContactNotificationInput): Promise<boolean> {
  const host = env.EMAIL_HOST;
  if (host === undefined) return false;

  // The SMTP account's own mailbox is the notification recipient — a
  // personal portfolio site has exactly one admin, and that admin is
  // whoever configured these credentials in the first place. Falls back to
  // EMAIL_FROM only if EMAIL_USER (e.g. an unauthenticated relay) is unset.
  const recipient = env.EMAIL_USER ?? env.EMAIL_FROM;
  if (!recipient) {
    logger.warn(
      'mail: EMAIL_HOST is set but neither EMAIL_USER nor EMAIL_FROM is — skipping the contact notification',
    );
    return false;
  }

  try {
    await createTransport(host).sendMail({
      from: env.EMAIL_FROM ?? recipient,
      to: recipient,
      replyTo: input.email,
      subject: `New contact form message${input.subject ? `: ${input.subject}` : ''}`,
      text: `From: ${input.name} <${input.email}>\n\n${input.message}`,
    });
    return true;
  } catch (error) {
    logger.warn({ error }, 'mail: failed to send the contact notification');
    return false;
  }
}
