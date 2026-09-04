import { z } from 'zod';

/**
 * `PATCH /admin/settings` — "bulk `[{key,value}]`" (doc 03 §5). `value` is
 * always a string on the wire, whatever `SiteSetting.valueType` says the
 * setting logically holds (`NUMBER`/`BOOLEAN`/`JSON` are still stored as
 * `TEXT`, per the model's own comment) — the service layer validates the
 * string against the row's existing `valueType` before writing, not this
 * schema, since that check depends on which row a given key already is.
 * `null` clears a setting back to unset, matching the column's own
 * nullable `value`.
 */
export const siteSettingBulkUpdateSchema = z
  .array(
    z
      .object({
        key: z.string().trim().min(1).max(100),
        value: z.string().max(10_000).nullable(),
      })
      .strict(),
  )
  .min(1)
  .max(200);
export type SiteSettingBulkUpdateInput = z.infer<typeof siteSettingBulkUpdateSchema>;
