import { Writable } from 'node:stream';
import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { buildLoggerOptions } from './logger.js';

/** Captures every line written to it, parsed as JSON — pino's default format. */
function createCapturingLogger() {
  const lines: Record<string, unknown>[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _enc, callback) {
      for (const line of chunk.toString('utf8').split('\n')) {
        if (line.trim().length > 0) lines.push(JSON.parse(line) as Record<string, unknown>);
      }
      callback();
    },
  });
  // `pretty: false` — the pretty-print transport runs on a worker thread and
  // cannot be captured synchronously in a test; plain JSON is pino's normal
  // production format anyway, and the property under test (redaction) is
  // identical either way.
  const logger = pino(buildLoggerOptions('info', false), stream);
  return { logger, lines };
}

describe('logger redaction (docs/architecture/01 §6, docs/architecture/09 §9)', () => {
  it('redacts a top-level sensitive field', () => {
    const { logger, lines } = createCapturingLogger();

    logger.info({ password: 'hunter2', username: 'eslam' }, 'login attempt');

    expect(lines[0]?.['password']).toBe('[REDACTED]');
    expect(lines[0]?.['username']).toBe('eslam');
  });

  it('redacts a token field wherever it appears', () => {
    const { logger, lines } = createCapturingLogger();

    logger.info({ token: 'secret-jwt-value' }, 'issued token');

    expect(lines[0]?.['token']).toBe('[REDACTED]');
  });

  it('redacts an Authorization header nested under req, as pino-http logs it', () => {
    const { logger, lines } = createCapturingLogger();

    logger.info(
      { req: { headers: { authorization: 'Bearer secret-token', 'user-agent': 'vitest' } } },
      'request received',
    );

    const req = lines[0]?.['req'] as { headers: Record<string, string> };
    expect(req.headers.authorization).toBe('[REDACTED]');
    expect(req.headers['user-agent']).toBe('vitest');
  });

  it('redacts a Set-Cookie header nested under res', () => {
    const { logger, lines } = createCapturingLogger();

    logger.info(
      { res: { headers: { 'set-cookie': '__Secure-at=abc123; HttpOnly' } } },
      'request completed',
    );

    const res = lines[0]?.['res'] as { headers: Record<string, string> };
    expect(res.headers['set-cookie']).toBe('[REDACTED]');
  });

  it('redacts a cookie header on the request', () => {
    const { logger, lines } = createCapturingLogger();

    logger.info({ req: { headers: { cookie: '__Secure-at=abc123' } } }, 'request received');

    const req = lines[0]?.['req'] as { headers: Record<string, string> };
    expect(req.headers.cookie).toBe('[REDACTED]');
  });

  it('redacts a sensitive field nested one level under an application object', () => {
    const { logger, lines } = createCapturingLogger();

    logger.info({ user: { passwordHash: '$argon2id$...' } }, 'user created');

    const user = lines[0]?.['user'] as { passwordHash: string };
    expect(user.passwordHash).toBe('[REDACTED]');
  });

  it('does not redact unrelated fields with a similar name', () => {
    const { logger, lines } = createCapturingLogger();

    logger.info({ tokenCount: 5, passwordPolicy: 'min-12-chars' }, 'stats');

    // Exact-field redaction only — a field whose name merely contains a
    // sensitive word must not be swept up, or genuinely useful log data
    // disappears for no security benefit.
    expect(lines[0]?.['tokenCount']).toBe(5);
    expect(lines[0]?.['passwordPolicy']).toBe('min-12-chars');
  });

  it('honours the configured level — a debug call is silent at info level', () => {
    const { logger, lines } = createCapturingLogger();

    logger.debug({ password: 'hunter2' }, 'should not appear');

    expect(lines).toHaveLength(0);
  });
});
