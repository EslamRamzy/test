import { describe, expect, it, vi } from 'vitest';

vi.mock('../repositories/healthRepository.js', () => ({
  ping: vi.fn(),
}));

describe('isDatabaseReady', () => {
  it('resolves to true when the repository ping succeeds', async () => {
    const { ping } = await import('../repositories/healthRepository.js');
    vi.mocked(ping).mockResolvedValueOnce(undefined);

    const { isDatabaseReady } = await import('./healthService.js');
    await expect(isDatabaseReady()).resolves.toBe(true);
  });

  it('resolves to false — never throws — when the repository ping fails', async () => {
    const { ping } = await import('../repositories/healthRepository.js');
    vi.mocked(ping).mockRejectedValueOnce(new Error('no such table: _prisma_migrations'));

    const { isDatabaseReady } = await import('./healthService.js');
    await expect(isDatabaseReady()).resolves.toBe(false);
  });
});
