import type { ProfileDto } from '@portfolio/shared';
import { toPublicMediaRefOrNull } from '../lib/mediaUrl.js';
import { findProfile } from '../repositories/profileRepository.js';
import { findPublicSettings } from '../repositories/siteSettingRepository.js';
import { findEnabled as findEnabledSocialLinks } from '../repositories/socialLinkRepository.js';

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
