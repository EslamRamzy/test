import type { ProfileDto, ProfileUpdateInput } from '@portfolio/shared';
import { prisma } from '../config/prisma.js';
import { NotFoundError } from '../errors/AppError.js';
import { toPublicMediaRefOrNull } from '../lib/mediaUrl.js';
import { revalidateTags } from '../lib/revalidate.js';
import {
  findProfile,
  findProfileForAdmin,
  updateProfile,
} from '../repositories/profileRepository.js';
import { findPublicSettings } from '../repositories/siteSettingRepository.js';
import { findEnabled as findEnabledSocialLinks } from '../repositories/socialLinkRepository.js';
import * as auditLogRepository from '../repositories/auditLogRepository.js';
import type { AdminCrudActor } from './adminCrudFactory.js';

/** `GET /profile` (docs/architecture/03 §3): singleton profile + avatar + social links + public settings, one call. */
export async function getProfile(): Promise<ProfileDto | null> {
  const [profile, socialLinks, settings] = await Promise.all([
    findProfile(),
    findEnabledSocialLinks(),
    findPublicSettings(),
  ]);

  if (!profile) return null;

  return {
    fullName: profile.fullName,
    headline: profile.headline,
    shortBio: profile.shortBio,
    fullBio: profile.fullBio,
    location: profile.location,
    publicEmail: profile.publicEmail,
    availableForWork: profile.availableForWork,
    avatar: toPublicMediaRefOrNull(profile.avatarMedia),
    resume: toPublicMediaRefOrNull(profile.resumeMedia),
    socialLinks: socialLinks.map((link) => ({
      id: link.id,
      platform: link.platform,
      label: link.label,
      url: link.url,
      icon: link.icon,
    })),
    settings: settings.map((setting) => ({
      key: setting.key,
      value: setting.value,
      valueType: setting.valueType as ProfileDto['settings'][number]['valueType'],
      groupName: setting.groupName,
    })),
  };
}

// --- Admin (docs/architecture/03 §5: `GET|PATCH /admin/profile`) -----------

export async function getProfileForAdmin() {
  const profile = await findProfileForAdmin();
  if (!profile) throw new NotFoundError('Profile not found');
  return profile;
}

export async function updateProfileForAdmin(data: ProfileUpdateInput, actor: AdminCrudActor) {
  const row = await prisma.$transaction(async (tx) => {
    const updated = await updateProfile(data, tx);
    await auditLogRepository.record(
      { userId: actor.id, action: 'PROFILE_UPDATE', entityType: 'PROFILE', entityId: 1 },
      tx,
    );
    return updated;
  });

  // The public `GET /profile` fetch is tagged 'profile' (endpoints.ts) —
  // always revalidate, unlike content resources: there is no draft state
  // for a singleton profile, so every edit is already "published."
  await revalidateTags(['profile']);
  return row;
}
