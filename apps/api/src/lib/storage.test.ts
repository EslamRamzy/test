import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { computeSha256, generateStoredFilename } from './storage.js';

describe('computeSha256', () => {
  it('matches a hash computed independently', () => {
    const data = Buffer.from('hello world');
    const expected = createHash('sha256').update(data).digest('hex');
    expect(computeSha256(data)).toBe(expected);
  });

  it('is deterministic for the same input', () => {
    const data = Buffer.from('same content');
    expect(computeSha256(data)).toBe(computeSha256(data));
  });

  it('differs for different input', () => {
    expect(computeSha256(Buffer.from('a'))).not.toBe(computeSha256(Buffer.from('b')));
  });
});

describe('generateStoredFilename', () => {
  it('embeds the first 16 characters of the checksum', () => {
    const checksum = 'a'.repeat(64);
    const filename = generateStoredFilename(checksum, 'jpg');
    expect(filename.startsWith('a'.repeat(16))).toBe(true);
  });

  it('normalises the extension to lowercase without a leading dot', () => {
    const filename = generateStoredFilename('a'.repeat(64), '.JPG');
    expect(filename.endsWith('.jpg')).toBe(true);
    expect(filename).not.toContain('..');
  });

  it('never reuses the same name for two calls with the same checksum', () => {
    const checksum = 'b'.repeat(64);
    const a = generateStoredFilename(checksum, 'png');
    const b = generateStoredFilename(checksum, 'png');
    expect(a).not.toBe(b);
  });

  // The whole point of a server-generated name: an attacker-controlled
  // original filename must never reach the filesystem path.
  it('contains no path separators regardless of extension input', () => {
    const filename = generateStoredFilename('c'.repeat(64), '../../etc/passwd');
    expect(filename).not.toMatch(/[/\\]/);
  });
});
