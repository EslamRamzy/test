import type { SocialLinkDto } from '@portfolio/shared';
import { findEnabled } from '../repositories/socialLinkRepository.js';

export async function listSocialLinks(): Promise<SocialLinkDto[]> {
  const rows = await findEnabled();
  return rows.map((row) => ({
    id: row.id,
    platform: row.platform,
    label: row.label,
    url: row.url,
    icon: row.icon,
  }));
}
