import type { ApiPaginatedSuccess, ApiSuccess, PaginationMeta } from '@portfolio/shared';
import type { Response } from 'express';

/**
 * Response envelope helpers (docs/architecture/03 §1). Controllers use these
 * rather than calling `res.json()` directly, so the success shape can only
 * ever be built one way — typed against the same `ApiSuccess`/
 * `ApiPaginatedSuccess` contract the frontend parses responses against
 * (packages/shared/src/types/api.ts).
 */
export function sendSuccess<T>(res: Response, data: T, status = 200): void {
  const body: ApiSuccess<T> = { success: true, data };
  res.status(status).json(body);
}

export function sendPaginatedSuccess<T>(
  res: Response,
  data: T[],
  meta: PaginationMeta,
  status = 200,
): void {
  const body: ApiPaginatedSuccess<T> = { success: true, data, meta };
  res.status(status).json(body);
}

/** Builds pagination metadata from a page/pageSize/total triple, once, in one place. */
export function buildPaginationMeta(page: number, pageSize: number, total: number): PaginationMeta {
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
