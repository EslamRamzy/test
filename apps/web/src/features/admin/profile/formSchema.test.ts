import { describe, expect, it } from 'vitest';
import { profileFormSchema, toProfileWirePayload } from './formSchema';

describe('profileFormSchema', () => {
  it('accepts every field empty (a PATCH-shaped schema, every field optional)', () => {
    expect(
      profileFormSchema.safeParse({
        fullName: '',
        avatarMediaId: '',
        resumeMediaId: '',
      }).success,
    ).toBe(true);
  });

  it('validates publicEmail as a real email when present', () => {
    expect(profileFormSchema.safeParse({ publicEmail: 'not-an-email' }).success).toBe(false);
    expect(profileFormSchema.safeParse({ publicEmail: 'me@example.com' }).success).toBe(true);
  });
});

describe('toProfileWirePayload', () => {
  it('converts avatarMediaId/resumeMediaId strings to numbers', () => {
    const payload = toProfileWirePayload({ avatarMediaId: '3', resumeMediaId: '7' });
    expect(payload.avatarMediaId).toBe(3);
    expect(payload.resumeMediaId).toBe(7);
  });

  it('leaves empty ids as undefined', () => {
    const payload = toProfileWirePayload({ avatarMediaId: '', resumeMediaId: '' });
    expect(payload.avatarMediaId).toBeUndefined();
    expect(payload.resumeMediaId).toBeUndefined();
  });
});
