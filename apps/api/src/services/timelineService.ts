import type { TimelineEntryDto } from '@portfolio/shared';
import * as timelineRepository from '../repositories/timelineRepository.js';
import { findVisible } from '../repositories/timelineRepository.js';
import { createAdminCrudService } from './adminCrudFactory.js';

export async function listTimeline(limit?: number): Promise<TimelineEntryDto[]> {
  const rows = await findVisible(limit);
  return rows.map((row) => ({
    id: row.id,
    entryDate: row.entryDate.toISOString(),
    yearLabel: row.yearLabel,
    title: row.title,
    description: row.description,
    category: row.category,
  }));
}

// --- Admin CRUD (docs/architecture/03 §5) -----------------------------------

type TimelineRow = NonNullable<Awaited<ReturnType<typeof timelineRepository.findById>>>;

export const timelineAdminService = createAdminCrudService<
  TimelineRow,
  Parameters<typeof timelineRepository.create>[0],
  Parameters<typeof timelineRepository.update>[1],
  timelineRepository.TimelineListParams
>({
  entityName: 'TIMELINE_ENTRY',
  repository: timelineRepository,
  getRowId: (row) => row.id,
});
