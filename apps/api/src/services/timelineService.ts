import type { TimelineEntryDto } from '@portfolio/shared';
import { findVisible } from '../repositories/timelineRepository.js';

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
