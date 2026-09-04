import type { ContactInput } from '@portfolio/shared';
import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../lib/httpResponse.js';
import * as contactService from '../../services/contactService.js';
import { hashIp } from '../../utils/hashIp.js';

/**
 * No CSRF here — deliberately (docs/architecture/04 §5): the endpoint is
 * unauthenticated, so there is no session to ride a forged request onto.
 * Its own defences are the rate limit, the honeypot, and the timing check
 * (docs/architecture/09 §8), all in `contactService.ts`.
 */
export async function submit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = req.body as ContactInput;
    const userAgent = req.get('user-agent') ?? undefined;
    await contactService.submitContact(input, {
      ipHash: hashIp(req.ip ?? 'unknown', userAgent),
      userAgent,
    });
    // The exact same response whether the message was stored or silently
    // dropped (honeypot / timing / daily cap) — doc 09 §8: "the response is
    // always a generic success ... so the endpoint is not a probe for
    // anything." The boolean `submitContact` returns exists for tests and
    // future admin-side visibility, not to shape this response.
    sendSuccess(res, { received: true }, 201);
  } catch (error) {
    next(error);
  }
}
