import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const HEADER_NAME = 'X-Request-Id';

/**
 * Bounded, safe correlation-id shape: printable ASCII, no whitespace or
 * control characters, capped well under any reasonable header-size limit.
 * An incoming value outside this is untrusted client input and must not
 * reach a log line unfiltered — a newline in it would forge a fake log
 * entry (log injection), and an unbounded length is a small memory/log-
 * volume amplification vector for free.
 */
const SAFE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * Assigns every request a stable id, first in the middleware chain
 * (docs/architecture/03 §6) so every later middleware — the logger, the
 * error handler — can rely on `req.id` already being set.
 *
 * An incoming `X-Request-Id` is reused only if it matches `SAFE_ID_PATTERN`
 * (correlates with an upstream proxy or a caller's own tracing); anything
 * else — including a well-formed value that just happens to arrive with the
 * header unset — gets a freshly generated one. Either way the value is
 * echoed back on the response, and a masked 500 includes it in the error
 * envelope so a report of "it failed" is traceable to one exact log line
 * without ever exposing the failure's detail (docs/architecture/03 §1).
 *
 * `req.id` is typed as pino-http's `ReqId` (`string | number | object`), not
 * `string` — see types/express.d.ts for why. This function only ever
 * assigns a `string`, which is a valid `ReqId`; `getRequestId()` below is how
 * a reader gets that guarantee back.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(HEADER_NAME);
  const id = incoming && SAFE_ID_PATTERN.test(incoming) ? incoming : randomUUID();
  req.id = id;
  res.setHeader(HEADER_NAME, id);
  next();
}

/**
 * Narrows `req.id` back to `string` for a reader (the error handler, a log
 * call) that needs the guarantee this module's own middleware provides.
 * Falls back to `'unknown'` only if `requestId` was somehow never mounted —
 * defensive, not an expected path in normal operation.
 */
export function getRequestId(req: Request): string {
  return typeof req.id === 'string' ? req.id : 'unknown';
}
