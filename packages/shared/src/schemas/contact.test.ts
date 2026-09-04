import { describe, expect, it } from 'vitest';
import { contactSchema } from './contact.js';

function baseInput(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    name: 'Jane Doe',
    email: 'jane@example.com',
    message: 'Hello, I would like to get in touch about a project.',
    renderedAt: Date.now() - 5000,
    ...overrides,
  };
}

describe('contactSchema', () => {
  it('accepts a valid submission with no subject and no honeypot value', () => {
    const result = contactSchema.safeParse(baseInput());
    expect(result.success).toBe(true);
  });

  it('accepts a valid submission with a subject', () => {
    const result = contactSchema.safeParse(baseInput({ subject: 'Project inquiry' }));
    expect(result.success).toBe(true);
  });

  it('accepts an empty-string honeypot (a real, untouched hidden field)', () => {
    const result = contactSchema.safeParse(baseInput({ website: '' }));
    expect(result.success).toBe(true);
  });

  it('rejects a name under 2 characters', () => {
    expect(contactSchema.safeParse(baseInput({ name: 'J' })).success).toBe(false);
  });

  it('rejects an invalid email', () => {
    expect(contactSchema.safeParse(baseInput({ email: 'not-an-email' })).success).toBe(false);
  });

  it('rejects a message under 10 characters', () => {
    expect(contactSchema.safeParse(baseInput({ message: 'too short' })).success).toBe(false);
  });

  it('rejects a message over 5000 characters', () => {
    expect(contactSchema.safeParse(baseInput({ message: 'a'.repeat(5001) })).success).toBe(false);
  });

  it('rejects a subject under 3 characters when present', () => {
    expect(contactSchema.safeParse(baseInput({ subject: 'ab' })).success).toBe(false);
  });

  it('rejects an unknown field (mass-assignment defence)', () => {
    expect(contactSchema.safeParse(baseInput({ ipOverride: '1.2.3.4' })).success).toBe(false);
  });

  it('rejects a missing renderedAt', () => {
    const { renderedAt: _renderedAt, ...rest } = baseInput();
    expect(contactSchema.safeParse(rest).success).toBe(false);
  });
});
