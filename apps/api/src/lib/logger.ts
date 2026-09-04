import pino from 'pino';
import type { LoggerOptions } from 'pino';
import { env, isProduction } from '../config/env.js';

/**
 * The single structured logger for the whole API (docs/architecture/01 §6).
 *
 * Redaction is the load-bearing part of this file, not the formatting: a
 * secret that reaches a log line is a leak regardless of how pretty the line
 * looks. The paths below are censored wherever they appear, at any nesting
 * depth (the trailing `*` glob), covering both a plain field and the shape
 * pino-http passes in (`req.headers.authorization`, `res.headers['set-cookie']`).
 *
 * `NODE_ENV=test` gets `level: 'silent'` on the exported singleton — this
 * file is imported transitively by nearly everything, and a test run is not
 * the place for the API's own request logs to interleave with `vitest`'s
 * output. That same "silent" level makes the singleton unusable for
 * `logger.test.ts` to assert against, which is why `REDACTED_PATHS` and
 * `createLogger` are exported: the test builds its own instance with the
 * identical redaction config, pointed at a stream it can actually read,
 * rather than duplicating the path list and only hoping it matches.
 */
export const SENSITIVE_FIELDS = [
  'password',
  'passwordHash',
  'token',
  'refreshToken',
  'authorization',
  'cookie',
  'set-cookie',
  'x-csrf-token',
];

export const REDACTED_PATHS = SENSITIVE_FIELDS.flatMap((field) => [
  // A field logged directly on the log object, e.g. logger.info({ token }).
  field,
  // pino-http nests the request/response it logs under `req`/`res`, with
  // headers a level below that (`req.headers.authorization`,
  // `res.headers["set-cookie"]`) — verified against the actual shape in
  // logger.test.ts rather than assumed from pino-http's docs alone.
  `req.headers.${field}`,
  `req.headers["${field}"]`,
  `res.headers.${field}`,
  `res.headers["${field}"]`,
  // One level of arbitrary nesting for application-level log calls, e.g.
  // logger.info({ user: { password } }).
  `*.${field}`,
]);

/**
 * Builds the logger options shared by the real singleton and by tests.
 * `pretty` is separated out (rather than derived from `env` internally)
 * so a test can request a plain-JSON logger even when run with
 * `NODE_ENV=development` locally.
 */
export function buildLoggerOptions(
  level: pino.LevelWithSilentOrString,
  pretty: boolean,
): LoggerOptions {
  return {
    level,
    redact: { paths: REDACTED_PATHS, censor: '[REDACTED]' },
    // Built as a conditionally *present* key, not a key set to `undefined`
    // — `exactOptionalPropertyTypes` treats those differently, and pino's
    // own types reject the latter.
    ...(pretty
      ? {
          transport: {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
          },
        }
      : {}),
  };
}

export const logger = pino(
  buildLoggerOptions(
    env.NODE_ENV === 'test' ? 'silent' : isProduction ? 'info' : 'debug',
    env.NODE_ENV === 'development',
  ),
);
