import type { ContactInput } from '@portfolio/shared';
import { sendContactNotification } from '../lib/mail.js';
import * as contactMessageRepository from '../repositories/contactMessageRepository.js';

export interface ContactContext {
  ipHash: string | undefined;
  userAgent: string | undefined;
}

const MIN_ELAPSED_MS = 3000; // doc 09 §8: "under 3 seconds ... is almost certainly a bot"
const DAILY_GLOBAL_CAP = 10; // doc 09 §4: "+10/day global cap"

/**
 * Returns whether the submission was actually stored. A `false` return is
 * NOT an error — the honeypot, the timing check, and the daily cap all fail
 * the exact same way from the caller's point of view, and the controller
 * reports the identical generic success regardless (doc 09 §8: "the
 * response is always a generic success ... so the endpoint is not a probe
 * for anything"). Distinguishing WHY nothing was stored, even internally in
 * a way that could leak through timing, would turn this endpoint back into
 * exactly the probe that principle rules out — so every rejection path
 * here does the same amount of work (one cheap check, no DB write) rather
 * than the honeypot/timing checks short-circuiting before a slower check
 * that legitimate traffic would still pay for.
 */
export async function submitContact(input: ContactInput, ctx: ContactContext): Promise<boolean> {
  const isHoneypotFilled = input.website !== undefined && input.website.length > 0;
  const isTooFast = Date.now() - input.renderedAt < MIN_ELAPSED_MS;

  const startOfDayUtc = new Date();
  startOfDayUtc.setUTCHours(0, 0, 0, 0);
  const submittedToday = await contactMessageRepository.countSince(startOfDayUtc);
  const isOverDailyCap = submittedToday >= DAILY_GLOBAL_CAP;

  if (isHoneypotFilled || isTooFast || isOverDailyCap) {
    return false;
  }

  await contactMessageRepository.create({
    name: input.name,
    email: input.email,
    subject: input.subject,
    message: input.message,
    ipHash: ctx.ipHash,
    userAgent: ctx.userAgent,
    spamScore: 0,
  });

  // Best-effort (doc09 §8: "Email failure never fails the request; the
  // message is already persisted") — `sendContactNotification` itself
  // never throws (see its own header comment), so `await`ing it here only
  // sequences the attempt, exactly like `revalidateTags` elsewhere in this
  // codebase; it can never turn a stored submission into a failed request.
  await sendContactNotification({
    name: input.name,
    email: input.email,
    subject: input.subject ?? null,
    message: input.message,
  });

  return true;
}
