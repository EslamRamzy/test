import { describe, expect, it } from 'vitest';
import { certificationFormSchema, toCertificationWirePayload } from './formSchema';

describe('certificationFormSchema', () => {
  it('accepts an empty certificateMediaId, issueDate, and expirationDate', () => {
    const result = certificationFormSchema.safeParse({
      name: 'OSCP',
      issuer: 'Offensive Security',
      certificateMediaId: '',
      issueDate: '',
      expirationDate: '',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a non-numeric certificateMediaId', () => {
    const result = certificationFormSchema.safeParse({
      name: 'OSCP',
      issuer: 'Offensive Security',
      certificateMediaId: 'not-a-number',
    });
    expect(result.success).toBe(false);
  });
});

describe('toCertificationWirePayload', () => {
  it('converts a numeric certificateMediaId string to a number', () => {
    const payload = toCertificationWirePayload({
      name: 'OSCP',
      issuer: 'Offensive Security',
      certificateMediaId: '7',
    });
    expect(payload.certificateMediaId).toBe(7);
  });

  it('leaves an empty certificateMediaId as undefined', () => {
    const payload = toCertificationWirePayload({
      name: 'OSCP',
      issuer: 'Offensive Security',
      certificateMediaId: '',
    });
    expect(payload.certificateMediaId).toBeUndefined();
  });
});
