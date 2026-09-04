import { pinoHttp } from 'pino-http';
import { logger } from '../lib/logger.js';

/**
 * One structured log line per request/response pair (docs/architecture/01 §6),
 * reusing the id `middleware/requestId.ts` already assigned — `genReqId`
 * returns it instead of letting pino-http mint its own, so there is exactly
 * one id per request, not two independently generated ones that happen to
 * both appear in the logs. No explicit generic parameter is needed here:
 * pino-http's own `IncomingMessage.id: ReqId` augmentation (which
 * `middleware/requestId.ts` assigns a `string` into) already types
 * `req.id` correctly against the default `IncomingMessage`.
 *
 * Redaction itself lives on the shared `logger` instance (lib/logger.ts), not
 * here — pino-http logs through that same instance, so the same paths apply
 * to every request/response log line automatically.
 */
export const requestLogger = pinoHttp({
  logger,
  genReqId: (req) => req.id,
});
