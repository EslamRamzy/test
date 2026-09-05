import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../repositories/pageViewRepository.js', () => ({
  create: vi.fn(),
}));
vi.mock('../utils/hashIp.js', () => ({
  hashIp: vi.fn(() => 'a'.repeat(64)),
}));
vi.mock('../config/env.js', () => ({
  env: { ENABLE_ANALYTICS: true },
}));

afterEach(() => {
  vi.resetModules();
});

describe('recordView', () => {
  it('stores the beacon, hashing the IP, when ENABLE_ANALYTICS is on (the default)', async () => {
    const { create } = await import('../repositories/pageViewRepository.js');
    const { recordView } = await import('./analyticsService.js');

    await recordView(
      { path: '/projects/foo', entityType: 'PROJECT', entityId: 1, referrerHost: undefined },
      { ip: '1.2.3.4', userAgent: 'vitest' },
    );

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/projects/foo', visitorHash: 'a'.repeat(64) }),
    );
  });

  it('is a no-op — no repository write at all — when ENABLE_ANALYTICS is off (doc09 §10, Phase 13)', async () => {
    vi.doMock('../config/env.js', () => ({ env: { ENABLE_ANALYTICS: false } }));

    const { create } = await import('../repositories/pageViewRepository.js');
    const { recordView } = await import('./analyticsService.js');

    await recordView({ path: '/projects/foo' }, { ip: '1.2.3.4', userAgent: 'vitest' });

    expect(create).not.toHaveBeenCalled();
  });
});
