import { afterEach, describe, expect, it, vi } from 'vitest';
import { getApiBaseUrl, getApiInternalUrl, getPublicSiteUrl } from './config';

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

describe('getApiInternalUrl', () => {
  it('uses the configured internal address', () => {
    vi.stubEnv('API_INTERNAL_URL', 'http://api:4000');
    expect(getApiInternalUrl()).toBe('http://api:4000');
  });

  it('falls back to the local API when unset', () => {
    vi.stubEnv('API_INTERNAL_URL', '');
    expect(getApiInternalUrl()).toBe('http://localhost:4000');
  });
});

describe('getPublicSiteUrl', () => {
  it('uses the configured site origin', () => {
    vi.stubEnv('PUBLIC_SITE_URL', 'https://eslamramzy.dev');
    expect(getPublicSiteUrl()).toBe('https://eslamramzy.dev');
  });

  it('falls back to a local default when unset', () => {
    vi.stubEnv('PUBLIC_SITE_URL', '');
    expect(getPublicSiteUrl()).toBe('http://localhost:3000');
  });
});
