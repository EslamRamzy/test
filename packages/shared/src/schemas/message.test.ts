import { describe, expect, it } from 'vitest';
import { messageStatusUpdateSchema } from './message.js';

describe('messageStatusUpdateSchema', () => {
  it('accepts each valid status', () => {
    for (const status of ['UNREAD', 'READ', 'ARCHIVED'] as const) {
      expect(messageStatusUpdateSchema.parse({ status })).toEqual({ status });
    }
  });

  it('rejects a status outside MESSAGE_STATUSES', () => {
    expect(() => messageStatusUpdateSchema.parse({ status: 'DELETED' })).toThrow();
  });

  it('rejects a missing status', () => {
    expect(() => messageStatusUpdateSchema.parse({})).toThrow();
  });

  it('rejects an unknown field (mass-assignment style)', () => {
    expect(() => messageStatusUpdateSchema.parse({ status: 'READ', message: 'edited' })).toThrow();
  });
});
