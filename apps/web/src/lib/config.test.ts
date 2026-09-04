import { afterEach, describe, expect, it, vi } from 'vitest';
import { getApiBaseUrl } from './config';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getApiBaseUrl', () => {
  it('uses the configured public API origin', () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.local.eslamramzy.dev');

    expect(getApiBaseUrl()).toBe('https://api.local.eslamramzy.dev');
  });

  it('falls back to the local API when unset', () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', '');

    expect(getApiBaseUrl()).toBe('http://localhost:4000');
  });
});
