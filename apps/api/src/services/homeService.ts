import type { HomeDto } from '@portfolio/shared';
import { NotFoundError } from '../errors/AppError.js';
import { getFeaturedProjects } from './projectService.js';
import { getProfile } from './profileService.js';
import { listSkillCategories } from './skillService.js';
import { getLatestArticles } from './articleService.js';
import { getLatestResearch } from './securityResearchService.js';
import { listTimeline } from './timelineService.js';
import { listSocialLinks } from './socialLinkService.js';
import { getStats } from './statsService.js';

/**
 * `GET /home` (docs/architecture/06 §6): one aggregate call feeding all ten
 * homepage Server Components, instead of nine separate round trips. Each
 * slice's own cap (3 featured projects, 3 latest articles/research, 8
 * timeline entries) is this endpoint's own reasonable choice for "preview"
 * sections, not a documented number — the individual `/projects`,
 * `/articles`, `/security`, `/timeline` endpoints are the uncapped source
 * for their own pages.
 */
const FEATURED_PROJECTS_LIMIT = 3;
const LATEST_ARTICLES_LIMIT = 3;
const LATEST_RESEARCH_LIMIT = 3;
const TIMELINE_LIMIT = 8;

export async function getHome(): Promise<HomeDto> {
  const [
    profile,
    stats,
    featuredProjects,
    skillCategories,
    latestArticles,
    latestResearch,
    timeline,
    socialLinks,
  ] = await Promise.all([
    getProfile(),
    getStats(),
    getFeaturedProjects(FEATURED_PROJECTS_LIMIT),
    listSkillCategories(),
    getLatestArticles(LATEST_ARTICLES_LIMIT),
    getLatestResearch(LATEST_RESEARCH_LIMIT),
    listTimeline(TIMELINE_LIMIT),
    listSocialLinks(),
  ]);

  if (!profile) {
    // The profile row is created once by `db:bootstrap` and never deleted
    // through any endpoint — its absence means the database was never
    // bootstrapped, not that a legitimate caller asked for something that
    // doesn't exist. Still a 404, not a 500: there is genuinely nothing to
    // return, and this is the same "absent" shape doc 03 §1 already defines.
    throw new NotFoundError('Profile is not configured');
  }

  return {
    profile,
    stats,
    featuredProjects,
    skillCategories,
    latestArticles,
    latestResearch,
    timeline,
    socialLinks,
  };
}
