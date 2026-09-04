import { z } from 'zod';
import { emailSchema } from './primitives.js';

/**
 * Public contact form (docs/architecture/09 §8, T7): validation bounds match
 * that section exactly (name 2–100, subject 3–150, message 10–5000).
 *
 * `website` is the honeypot: a field real users never see (CSS-hidden in the
 * rendered form) or fill, but an unsophisticated scraping bot fills every
 * input it finds. A non-empty value here means "silently accept, store
 * nothing" (doc 10 §3) — the response must look identical to a real
 * submission, or the honeypot becomes a detectable probe itself.
 *
 * `renderedAt` is a soft anti-bot signal, not a security boundary: the
 * client records `Date.now()` when the form mounts and sends it back here;
 * the server rejects a submission under ~3 seconds after that (doc 09 §8:
 * "almost certainly a bot"). A bot that bothers to fake a plausible delay
 * defeats this trivially — it exists to filter the much larger volume of
 * bots that don't bother, at zero cost to a real user.
 */
export const contactSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: emailSchema,
    subject: z.string().trim().min(3).max(150).optional(),
    message: z.string().trim().min(10).max(5000),
    website: z.string().max(200).optional(),
    renderedAt: z.number().int().positive(),
  })
  .strict();
export type ContactInput = z.infer<typeof contactSchema>;
