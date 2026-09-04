import { describe, expect, it } from 'vitest';
import { generateDuplicateSlug } from './slug.js';

describe('generateDuplicateSlug', () => {
  it('returns "{base}-copy" when it is free', async () => {
    const slug = await generateDuplicateSlug('my-post', async () => false);
    expect(slug).toBe('my-post-copy');
  });

  it('tries "-copy-2", "-copy-3", ... until a free one is found', async () => {
    const taken = new Set(['my-post-copy', 'my-post-copy-2', 'my-post-copy-3']);
    const slug = await generateDuplicateSlug('my-post', async (candidate) => taken.has(candidate));
    expect(slug).toBe('my-post-copy-4');
  });

  it('checks each candidate exactly once, in order, stopping at the first free one', async () => {
    const checked: string[] = [];
    const taken = new Set(['my-post-copy']);
    const slug = await generateDuplicateSlug('my-post', async (candidate) => {
      checked.push(candidate);
      return taken.has(candidate);
    });
    expect(slug).toBe('my-post-copy-2');
    expect(checked).toEqual(['my-post-copy', 'my-post-copy-2']);
  });
});
