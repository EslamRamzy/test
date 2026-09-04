import type { StatsDto } from '@portfolio/shared';
import { findEarliestStartDate } from '../repositories/experienceRepository.js';
import { countPublished as countPublishedArticles } from '../repositories/articleRepository.js';
import { countPublished as countPublishedProjects } from '../repositories/projectRepository.js';
import { count as countTechnologies } from '../repositories/technologyRepository.js';

/**
 * `GET /stats` (docs/architecture/03 §3, docs/architecture/06 §6):
 * "No hardcoded numbers anywhere" — every counter is a live `COUNT(*)`
 * (or `MIN(startDate)`) over the current data, computed fresh on every call
 * (this endpoint's own 5-minute cache, per doc 03 §3, is an HTTP-level
 * concern for a later phase, not something this function does itself).
 *
 * The exact counters here (projects, articles, technologies, years of
 * experience) are this implementation's own reasonable reading of "homepage
 * counters" (doc 03 §3, §6.2) — the original brief's literal §6.2 wording
 * was not preserved as a file for this phase to consult directly, so this
 * is a documented interpretation, not a verbatim requirement.
 */
export async function getStats(): Promise<StatsDto> {
  const [projectsCount, articlesCount, technologiesCount, earliestStartDate] = await Promise.all([
    countPublishedProjects(),
    countPublishedArticles(),
    countTechnologies(),
    findEarliestStartDate(),
  ]);

  const yearsOfExperience = earliestStartDate
    ? Math.max(
        0,
        Math.floor((Date.now() - earliestStartDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)),
      )
    : 0;

  return { projectsCount, articlesCount, technologiesCount, yearsOfExperience };
}
