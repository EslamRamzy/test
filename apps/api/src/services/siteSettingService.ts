import type { ApiFieldError, SiteSettingBulkUpdateInput } from '@portfolio/shared';
import { prisma } from '../config/prisma.js';
import { ValidationError } from '../errors/AppError.js';
import * as auditLogRepository from '../repositories/auditLogRepository.js';
import * as siteSettingRepository from '../repositories/siteSettingRepository.js';
import type { AdminCrudActor } from './adminCrudFactory.js';

/**
 * `GET|PATCH /admin/settings` (doc03 §5). Every settings row is stored as
 * `TEXT` regardless of `valueType` (`schema.prisma`'s own comment); this
 * layer is what turns that back into "the string must actually parse as
 * what `valueType` claims" before it is written.
 *
 * `PATCH` upserts rather than requiring a setting to already exist — doc03
 * §5 lists no separate "create a setting" endpoint, and nothing seeds this
 * table (confirmed: no `siteSetting` calls anywhere in `prisma/seed.ts`), so
 * a strict "must already exist" rule would make the very first setting
 * uncreatable. A brand-new key gets `valueType: 'STRING'` and
 * `isPublic: false` (`siteSettingRepository.upsertOne`'s own comment) —
 * the safe defaults, never assumed public.
 */

export interface SettingsGroup {
  groupName: string;
  settings: Awaited<ReturnType<typeof siteSettingRepository.findAllForAdmin>>;
}

export async function listSettingsForAdmin(): Promise<SettingsGroup[]> {
  const rows = await siteSettingRepository.findAllForAdmin();
  const groups = new Map<string, SettingsGroup['settings']>();
  for (const row of rows) {
    const groupName = row.groupName ?? 'general';
    const existing = groups.get(groupName);
    if (existing) existing.push(row);
    else groups.set(groupName, [row]);
  }
  return Array.from(groups.entries()).map(([groupName, settings]) => ({ groupName, settings }));
}

/** `null` always clears a setting back to unset, regardless of `valueType` — the column itself is nullable. */
function validateValueForType(value: string | null, valueType: string): string | undefined {
  if (value === null) return undefined;
  switch (valueType) {
    case 'NUMBER':
      return Number.isFinite(Number(value)) ? undefined : 'must be a valid number';
    case 'BOOLEAN':
      return value === 'true' || value === 'false' ? undefined : 'must be "true" or "false"';
    case 'JSON':
      try {
        JSON.parse(value);
        return undefined;
      } catch {
        return 'must be valid JSON';
      }
    default:
      return undefined; // STRING — any string is valid.
  }
}

export async function bulkUpdateSettings(input: SiteSettingBulkUpdateInput, actor: AdminCrudActor) {
  const existingRows = await Promise.all(
    input.map((entry) => siteSettingRepository.findByKey(entry.key)),
  );

  const errors: ApiFieldError[] = [];
  input.forEach((entry, index) => {
    const existing = existingRows[index];
    if (!existing) return; // new key — defaults to STRING, so any value is valid
    const error = validateValueForType(entry.value, existing.valueType);
    if (error) errors.push({ field: `${index}.value`, message: `"${entry.key}" ${error}` });
  });
  if (errors.length > 0) throw new ValidationError(errors);

  return prisma.$transaction(async (tx) => {
    const rows = [];
    for (const entry of input) {
      rows.push(await siteSettingRepository.upsertOne(entry.key, entry.value, tx));
    }
    await auditLogRepository.record(
      {
        userId: actor.id,
        action: 'SETTINGS_UPDATE',
        entityType: 'SETTINGS',
        metadata: { keys: input.map((entry) => entry.key) },
      },
      tx,
    );
    return rows;
  });
}
