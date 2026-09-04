import type { EducationRow } from '@portfolio/shared';
import { createAdminResourceClient } from '@/lib/api/adminResource';
import { createAdminResourceHooks } from '@/features/admin/lib/adminResourceHooks';
import type { EducationFormValues } from './formSchema';

export const educationClient = createAdminResourceClient<
  EducationRow,
  EducationFormValues,
  EducationFormValues
>('/api/v1/admin/education', { reorder: true });

export const educationHooks = createAdminResourceHooks(educationClient, 'admin-education');
