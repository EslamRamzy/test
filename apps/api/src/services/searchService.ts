import type { SearchQuery, SearchResultDto } from '@portfolio/shared';
import * as searchRepository from '../repositories/searchRepository.js';

const TYPE_MAP: Record<NonNullable<SearchQuery['type']>, SearchResultDto['entityType']> = {
  projects: 'PROJECT',
  articles: 'ARTICLE',
  research: 'RESEARCH',
  technologies: 'TECHNOLOGY',
};

export function search(query: SearchQuery): Promise<SearchResultDto[]> {
  const entityType = query.type ? TYPE_MAP[query.type] : undefined;
  return searchRepository.search(query.q, entityType, query.limit);
}
