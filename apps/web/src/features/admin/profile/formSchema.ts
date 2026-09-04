import { profileUpdateSchema } from '@portfolio/shared';
import type { z } from 'zod';
import {
  emptyStringsToUndefined,
  optionalPositiveIntStringSchema,
  parseOptionalPositiveInt,
  withFieldOverrides,
} from '@/features/admin/lib/formValues';

const profileOverriddenSchema = withFieldOverrides(profileUpdateSchema, {
  avatarMediaId: optionalPositiveIntStringSchema,
  resumeMediaId: optionalPositiveIntStringSchema,
});

export type ProfileFormValues = z.input<typeof profileOverriddenSchema>;

export const profileFormSchema = emptyStringsToUndefined(profileOverriddenSchema);

export type ProfileWirePayload = z.input<typeof profileUpdateSchema>;

export function toProfileWirePayload(values: ProfileFormValues): ProfileWirePayload {
  const { avatarMediaId, resumeMediaId, ...rest } = values;
  return {
    ...rest,
    avatarMediaId: parseOptionalPositiveInt(avatarMediaId),
    resumeMediaId: parseOptionalPositiveInt(resumeMediaId),
  };
}
