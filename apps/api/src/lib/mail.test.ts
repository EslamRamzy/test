import { describe, expect, it, vi } from 'vitest';
import type * as EnvModule from '../config/env.js';

const sendMailMock = vi.fn();

vi.mock('nodemailer', () => ({
  default: { createTransport: vi.fn(() => ({ sendMail: sendMailMock })) },
}));

vi.mock('../config/env.js', async (importOriginal) => {
  const actual = await importOriginal<typeof EnvModule>();
  return {
    ...actual,
    env: {
      ...actual.env,
      EMAIL_HOST: 'smtp.example.com',
      EMAIL_PORT: 587,
      EMAIL_USER: 'admin@example.com',
      EMAIL_PASSWORD: 'app-password',
      EMAIL_FROM: 'noreply@example.com',
    },
  };
});

/**
 * `env` is mocked with SMTP configured for this whole file — the "disabled"
 * path (EMAIL_HOST unset) is already exercised for real, unmocked, by every
 * test in `tests/contact.test.ts`: the ambient test environment never sets
 * EMAIL_HOST, so every one of those submissions already goes through
 * `sendContactNotification` returning `false` without attempting anything,
 * and none of them fail — that IS the "disabled" regression check.
 */
describe('sendContactNotification (SMTP configured)', () => {
  it('sends the notification with From/Reply-To/Subject built from safe, structured fields', async () => {
    sendMailMock.mockResolvedValueOnce({});
    const { sendContactNotification } = await import('./mail.js');

    const result = await sendContactNotification({
      name: 'Jane Doe',
      email: 'jane@example.com',
      subject: 'Project inquiry',
      message: 'Hello, I would like to discuss a project.',
    });

    expect(result).toBe(true);
    expect(sendMailMock).toHaveBeenCalledWith({
      from: 'noreply@example.com',
      to: 'admin@example.com',
      replyTo: 'jane@example.com',
      subject: 'New contact form message: Project inquiry',
      text: expect.stringContaining('Hello, I would like to discuss a project.') as string,
    });
  });

  it('omits the subject suffix when the submission had none', async () => {
    sendMailMock.mockResolvedValueOnce({});
    const { sendContactNotification } = await import('./mail.js');

    await sendContactNotification({
      name: 'Jane Doe',
      email: 'jane@example.com',
      subject: null,
      message: 'No subject given.',
    });

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'New contact form message' }),
    );
  });

  it('passes the submitter email only through the structured replyTo field, never concatenated into a raw header string — the actual defence against header injection', async () => {
    sendMailMock.mockResolvedValueOnce({});
    const { sendContactNotification } = await import('./mail.js');

    // A subject containing a raw CRLF — if this file's own code ever
    // regressed to building a header string by hand, this is exactly the
    // payload that would prove it. Passed straight through to nodemailer's
    // own `subject` option either way; nodemailer's structured field
    // encoding (not any sanitization in this file) is what actually
    // neutralises it.
    const injectionAttempt = 'Hi\r\nBcc: attacker@evil.example';
    await sendContactNotification({
      name: 'Jane Doe',
      email: 'jane@example.com',
      subject: injectionAttempt,
      message: 'Body',
    });

    const call = sendMailMock.mock.calls[0]?.[0] as { subject: string; replyTo: string };
    // The raw value reaches nodemailer's `subject` OPTION — never assembled
    // into a hand-built header string this file constructs itself.
    expect(call.subject).toBe(`New contact form message: ${injectionAttempt}`);
    expect(call.replyTo).toBe('jane@example.com');
  });

  it('never throws when the transport rejects — the submission must never fail because mail is down', async () => {
    sendMailMock.mockRejectedValueOnce(new Error('Connection timed out'));
    const { sendContactNotification } = await import('./mail.js');

    await expect(
      sendContactNotification({
        name: 'Jane Doe',
        email: 'jane@example.com',
        subject: 'Test',
        message: 'Body',
      }),
    ).resolves.toBe(false);
  });
});
