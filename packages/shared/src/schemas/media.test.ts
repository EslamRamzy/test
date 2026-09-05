import { describe, expect, it } from 'vitest';
import { mediaUpdateSchema, mediaUploadFieldsSchema } from './media.js';

describe('mediaUploadFieldsSchema', () => {
  it('accepts a valid kind with no alt text', () => {
    const result = mediaUploadFieldsSchema.parse({ kind: 'PROJECT_COVER' });
    expect(result).toEqual({ kind: 'PROJECT_COVER' });
  });

  it('accepts an alt text alongside the kind', () => {
    const result = mediaUploadFieldsSchema.parse({ kind: 'SCREENSHOT', altText: 'A dashboard' });
    expect(result.altText).toBe('A dashboard');
  });

  it('rejects a kind outside MEDIA_KINDS', () => {
    expect(() => mediaUploadFieldsSchema.parse({ kind: 'NOT_A_KIND' })).toThrow();
  });

  it('rejects a missing kind', () => {
    expect(() => mediaUploadFieldsSchema.parse({})).toThrow();
  });

  it('rejects an unknown field (mass-assignment style)', () => {
    expect(() => mediaUploadFieldsSchema.parse({ kind: 'OTHER', filename: 'evil.exe' })).toThrow();
  });
});

describe('mediaUpdateSchema', () => {
  it('accepts a new alt text string', () => {
    expect(mediaUpdateSchema.parse({ altText: 'A screenshot' })).toEqual({
      altText: 'A screenshot',
    });
  });

  it('accepts null to clear the alt text', () => {
    expect(mediaUpdateSchema.parse({ altText: null })).toEqual({ altText: null });
  });

  it('accepts an empty object — a no-op patch, not an error', () => {
    expect(mediaUpdateSchema.parse({})).toEqual({});
  });

  it('accepts a kind reclassification, with or without altText alongside it', () => {
    expect(mediaUpdateSchema.parse({ kind: 'PROJECT_COVER' })).toEqual({ kind: 'PROJECT_COVER' });
    expect(mediaUpdateSchema.parse({ altText: 'x', kind: 'OTHER' })).toEqual({
      altText: 'x',
      kind: 'OTHER',
    });
  });

  it('rejects a kind outside MEDIA_KINDS', () => {
    expect(() => mediaUpdateSchema.parse({ kind: 'NOT_A_KIND' })).toThrow();
  });

  it('rejects an unknown field (mass-assignment style)', () => {
    expect(() => mediaUpdateSchema.parse({ altText: 'x', filename: 'evil.exe' })).toThrow();
  });
});
