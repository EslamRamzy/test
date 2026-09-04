import type { SocialLinkDto } from '@portfolio/shared';
import * as socialLinkRepository from '../repositories/socialLinkRepository.js';
import { findEnabled } from '../repositories/socialLinkRepository.js';
import { createAdminCrudService } from './adminCrudFactory.js';

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

// --- Admin CRUD (docs/architecture/03 §5) -----------------------------------

type SocialLinkRow = NonNullable<Awaited<ReturnType<typeof socialLinkRepository.findById>>>;

export const socialLinkAdminService = createAdminCrudService<
  SocialLinkRow,
  Parameters<typeof socialLinkRepository.create>[0],
  Parameters<typeof socialLinkRepository.update>[1],
  socialLinkRepository.SocialLinkListParams
>({
  entityName: 'SOCIAL_LINK',
  repository: socialLinkRepository,
  getRowId: (row) => row.id,
});
