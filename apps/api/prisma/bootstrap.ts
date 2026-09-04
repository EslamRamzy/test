/**
 * Bootstrap — runs in EVERY environment, including production, and is
 * idempotent (docs/architecture/02 §10). It creates only what the platform
 * needs to be usable at all:
 *
 *   - the one admin account (from ADMIN_EMAIL / ADMIN_INITIAL_PASSWORD)
 *   - the 7 fixed skill categories from the brief (§10)
 *   - a minimal set of default site_settings
 *   - the singleton profiles row, seeded with the real name and photo
 *     supplied for this project — never fabricated biographical content
 *
 * It never creates demo projects, articles, or research — that is
 * `prisma/seed.ts`, which refuses to run in production. Re-running this
 * script is always safe: every write is an upsert keyed by a unique field.
 *
 * Usage: npm run db:bootstrap -w @portfolio/api
 */
import { copyFile, mkdir, readFile, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { z } from 'zod';
import { hashPassword } from '../src/lib/password.js';
import { computeSha256, generateStoredFilename } from '../src/lib/storage.js';
import { applyDatabasePragmas, disconnectDatabase, prisma } from '../src/config/prisma.js';

// Bootstrap-only inputs, validated here rather than in the shared env.ts —
// the running server never needs these after the first successful run, so
// they are not part of its required-to-boot schema (docs/architecture/08 §5).
const bootstrapEnvSchema = z.object({
  ADMIN_EMAIL: z.email('ADMIN_EMAIL must be a valid email address').toLowerCase(),
  ADMIN_INITIAL_PASSWORD: z
    .string()
    .min(12, 'ADMIN_INITIAL_PASSWORD must be at least 12 characters (docs/architecture/04 §4)'),
  // `.env.example` ships this blank ("ADMIN_NAME="), and Zod's `.default()`
  // only applies to an *absent* key, not a present-but-empty string — so an
  // untouched copy of the example file would otherwise fail validation
  // instead of falling back to "Admin". Treat blank as unset.
  ADMIN_NAME: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().trim().min(1).default('Admin'),
  ),
  UPLOAD_DIR: z.string().trim().min(1).default('./uploads'),
});

const SKILL_CATEGORIES = [
  'Frontend',
  'Backend',
  'Database',
  'Security',
  'DevOps',
  'Tools',
  'Other',
] as const;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function bootstrapAdmin(env: z.infer<typeof bootstrapEnvSchema>): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { email: env.ADMIN_EMAIL } });
  if (existing) {
    console.log(`✓ Admin user already exists (${env.ADMIN_EMAIL}) — leaving it untouched.`);
    return;
  }

  const passwordHash = await hashPassword(env.ADMIN_INITIAL_PASSWORD);
  await prisma.user.create({
    data: {
      email: env.ADMIN_EMAIL,
      passwordHash,
      name: env.ADMIN_NAME,
      role: 'ADMIN',
      mustChangePassword: true,
    },
  });
  console.log(`✓ Created admin user ${env.ADMIN_EMAIL} (must change password on first login)`);
}

async function bootstrapSkillCategories(): Promise<void> {
  for (const [index, name] of SKILL_CATEGORIES.entries()) {
    await prisma.skillCategory.upsert({
      where: { slug: slugify(name) },
      update: {},
      create: { name, slug: slugify(name), displayOrder: index },
    });
  }
  console.log(`✓ Skill categories ready (${SKILL_CATEGORIES.length})`);
}

const DEFAULT_SITE_SETTINGS: Array<{
  key: string;
  value: string;
  valueType: 'STRING';
  groupName: string;
  isPublic: boolean;
}> = [
  {
    key: 'site.title',
    value: 'Eslam Ramzy',
    valueType: 'STRING',
    groupName: 'general',
    isPublic: true,
  },
  {
    // Placeholder — replace from Admin → Settings. Never a fabricated claim.
    key: 'seo.default_description',
    value: 'Full-stack development and application security portfolio.',
    valueType: 'STRING',
    groupName: 'seo',
    isPublic: true,
  },
];

async function bootstrapSiteSettings(): Promise<void> {
  for (const setting of DEFAULT_SITE_SETTINGS) {
    await prisma.siteSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }
  console.log(`✓ Default site settings ready (${DEFAULT_SITE_SETTINGS.length})`);
}

/**
 * Stores the staged profile photo as a `media` row, reusing an existing row
 * if this exact file was already bootstrapped (matched by checksum, so
 * re-running bootstrap never duplicates the file on disk).
 */
async function bootstrapAvatarMedia(env: z.infer<typeof bootstrapEnvSchema>): Promise<number> {
  const sourcePath = join(import.meta.dirname, 'seed-assets', 'profile-photo.jpg');
  const fileBuffer = await readFile(sourcePath);
  const checksum = computeSha256(fileBuffer);

  const existing = await prisma.media.findFirst({ where: { checksumSha256: checksum } });
  if (existing) {
    console.log('✓ Profile photo already stored — reusing existing media row.');
    return existing.id;
  }

  const filename = generateStoredFilename(checksum, extname(sourcePath));
  const uploadDir = join(process.cwd(), env.UPLOAD_DIR);
  await mkdir(uploadDir, { recursive: true });
  const destinationPath = join(uploadDir, filename);
  await copyFile(sourcePath, destinationPath);
  const fileStat = await stat(destinationPath);

  const media = await prisma.media.create({
    data: {
      filename,
      originalName: 'profile-photo.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: fileStat.size,
      checksumSha256: checksum,
      storagePath: filename,
      altText: 'Eslam Ramzy',
      kind: 'AVATAR',
    },
  });
  console.log(`✓ Stored profile photo as media #${String(media.id)} (${filename})`);
  return media.id;
}

async function bootstrapProfile(avatarMediaId: number): Promise<void> {
  const existing = await prisma.profile.findUnique({ where: { id: 1 } });
  if (existing) {
    // Never overwrite fields an admin may already have edited — only fill in
    // the avatar if one is still missing.
    if (existing.avatarMediaId === null) {
      await prisma.profile.update({ where: { id: 1 }, data: { avatarMediaId } });
      console.log('✓ Profile row updated with the avatar (was previously unset)');
    } else {
      console.log('✓ Profile row already exists — leaving its content untouched.');
    }
    return;
  }

  await prisma.profile.create({
    data: {
      fullName: 'Eslam Ramzy',
      avatarMediaId,
      // headline / bio intentionally left unset: no fabricated biographical
      // content ships in a production bootstrap. Edit from Admin → Settings.
    },
  });
  console.log('✓ Created the profile row for Eslam Ramzy');
}

async function main(): Promise<void> {
  const parsed = bootstrapEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    console.error(`Bootstrap cannot run — invalid configuration:\n${issues}`);
    process.exitCode = 1;
    return;
  }

  await applyDatabasePragmas();

  await bootstrapAdmin(parsed.data);
  await bootstrapSkillCategories();
  await bootstrapSiteSettings();
  const avatarMediaId = await bootstrapAvatarMedia(parsed.data);
  await bootstrapProfile(avatarMediaId);

  console.log('\nBootstrap complete.');
}

main()
  .catch((error: unknown) => {
    console.error('Bootstrap failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void disconnectDatabase();
  });
