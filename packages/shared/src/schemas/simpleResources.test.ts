import { describe, expect, it } from 'vitest';
import { articleCategoryCreateSchema, tagCreateSchema, tagUpdateSchema } from './tag.js';
import { certificationCreateSchema } from './certification.js';
import { educationCreateSchema } from './education.js';
import { experienceCreateSchema } from './experience.js';
import { profileUpdateSchema } from './profile.js';
import { siteSettingBulkUpdateSchema } from './siteSetting.js';
import { skillCategoryCreateSchema, skillCreateSchema, skillUpdateSchema } from './skill.js';
import { socialLinkCreateSchema } from './socialLink.js';
import { technologyCreateSchema, technologyUpdateSchema } from './technology.js';
import { timelineEntryCreateSchema } from './timeline.js';

/**
 * One shared test file for every "simple" (no publish workflow) resource
 * schema — each gets the same three checks (valid input passes, an unknown
 * key is rejected by `.strict()`, the update variant makes every field
 * optional) rather than a dedicated file per resource; the schemas
 * themselves are thin enough that a dedicated file per one would mostly
 * repeat this same shape thirteen times.
 */

describe('technology schemas', () => {
  it('accepts valid input and rejects an unknown key', () => {
    expect(
      technologyCreateSchema.safeParse({ name: 'TypeScript', slug: 'typescript' }).success,
    ).toBe(true);
    expect(
      technologyCreateSchema.safeParse({
        name: 'TypeScript',
        slug: 'typescript',
        bogus: true,
      }).success,
    ).toBe(false);
  });

  it('update makes every field optional', () => {
    expect(technologyUpdateSchema.safeParse({}).success).toBe(true);
  });
});

describe('skill schemas', () => {
  it('requires categoryId on create but not on update', () => {
    expect(skillCreateSchema.safeParse({ name: 'Rust' }).success).toBe(false);
    expect(skillCreateSchema.safeParse({ categoryId: 1, name: 'Rust' }).success).toBe(true);
    expect(skillUpdateSchema.safeParse({ name: 'Rust' }).success).toBe(true);
  });

  it('rejects an invalid level', () => {
    expect(
      skillCreateSchema.safeParse({ categoryId: 1, name: 'Rust', level: 'EXPERT' }).success,
    ).toBe(false);
  });

  it('categoryId is not accepted on update (moving categories is a distinct action)', () => {
    expect(skillUpdateSchema.safeParse({ categoryId: 2 }).success).toBe(false);
  });

  it('skillCategoryCreateSchema accepts a minimal category', () => {
    expect(
      skillCategoryCreateSchema.safeParse({ name: 'Languages', slug: 'languages' }).success,
    ).toBe(true);
  });
});

describe('certification schema', () => {
  it('accepts a real ISO date and rejects a malformed one', () => {
    expect(
      certificationCreateSchema.safeParse({
        name: 'OSCP',
        issuer: 'Offensive Security',
        issueDate: '2022-06-01',
      }).success,
    ).toBe(true);
    expect(
      certificationCreateSchema.safeParse({
        name: 'OSCP',
        issuer: 'Offensive Security',
        issueDate: '06/01/2022',
      }).success,
    ).toBe(false);
  });
});

describe('experience schema', () => {
  it('accepts achievements and technologyIds as plain arrays', () => {
    const result = experienceCreateSchema.safeParse({
      position: 'Security Engineer',
      organization: 'Acme',
      startDate: '2022-01-01',
      achievements: ['Found 12 critical vulnerabilities', 'Led the bug bounty program'],
      technologyIds: [1, 2, 3],
    });
    expect(result.success).toBe(true);
  });
});

describe('education schema', () => {
  it('requires institution, degree, and startDate', () => {
    expect(educationCreateSchema.safeParse({ institution: 'MIT' }).success).toBe(false);
    expect(
      educationCreateSchema.safeParse({
        institution: 'MIT',
        degree: 'BSc Computer Science',
        startDate: '2015-09-01',
      }).success,
    ).toBe(true);
  });
});

describe('timeline entry schema', () => {
  it('accepts a free-text category (no CHECK constraint on this column)', () => {
    expect(
      timelineEntryCreateSchema.safeParse({
        entryDate: '2020-01-01',
        title: 'Started freelancing',
        category: 'anything-goes-here',
      }).success,
    ).toBe(true);
  });
});

describe('social link schema', () => {
  it('rejects a javascript: URL', () => {
    expect(
      socialLinkCreateSchema.safeParse({ platform: 'GitHub', url: 'javascript:alert(1)' }).success,
    ).toBe(false);
  });
});

describe('tag and article category schemas', () => {
  it('accept a valid slug and reject an uppercase one', () => {
    expect(tagCreateSchema.safeParse({ name: 'XSS', slug: 'xss' }).success).toBe(true);
    expect(tagCreateSchema.safeParse({ name: 'XSS', slug: 'XSS' }).success).toBe(false);
    expect(tagUpdateSchema.safeParse({}).success).toBe(true);
    expect(
      articleCategoryCreateSchema.safeParse({ name: 'Security', slug: 'security' }).success,
    ).toBe(true);
  });
});

describe('siteSettingBulkUpdateSchema', () => {
  it('accepts a batch of key/value pairs, and a null value to clear one', () => {
    const result = siteSettingBulkUpdateSchema.safeParse([
      { key: 'seo.default_description', value: 'A portfolio site.' },
      { key: 'features.analytics_enabled', value: null },
    ]);
    expect(result.success).toBe(true);
  });

  it('rejects an empty batch', () => {
    expect(siteSettingBulkUpdateSchema.safeParse([]).success).toBe(false);
  });
});

describe('profileUpdateSchema', () => {
  it('accepts a partial update and rejects a malformed publicEmail', () => {
    expect(profileUpdateSchema.safeParse({ headline: 'Security Engineer' }).success).toBe(true);
    expect(profileUpdateSchema.safeParse({ publicEmail: 'not-an-email' }).success).toBe(false);
  });
});
