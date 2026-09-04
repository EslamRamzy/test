import type {
  SocialLinkCreateInput,
  SocialLinkRow,
  SocialLinkUpdateInput,
} from '@portfolio/shared';
import { createAdminResourceClient } from '@/lib/api/adminResource';
import { createAdminResourceHooks } from '@/features/admin/lib/adminResourceHooks';

export const socialLinksClient = createAdminResourceClient<
  SocialLinkRow,
  SocialLinkCreateInput,
  SocialLinkUpdateInput
>('/api/v1/admin/social-links', { reorder: true });

export const socialLinksHooks = createAdminResourceHooks(socialLinksClient, 'admin-social-links');
