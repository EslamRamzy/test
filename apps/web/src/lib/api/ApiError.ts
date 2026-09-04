import type { ApiFieldError } from '@portfolio/shared';

/**
 * Thrown by `serverClient.ts` for any non-2xx or `success: false` API
 * response (docs/architecture/06 §4). A Server Component that lets this
 * propagate gets Next's own `error.tsx` boundary; a 404 is the one status a
 * caller is expected to catch itself and turn into `notFound()` instead.
 *
 * `details` (Phase 8) — the API's own `error.details` field-error array on a
 * `VALIDATION_ERROR`, carried through so `<EntityForm>` can map it back onto
 * the individual fields (doc07 §6: "Field-level errors from the API
 * `details` array mapped back onto the form"). `undefined` for every other
 * error shape (a plain string message has nothing to map).
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly details: ApiFieldError[] | undefined;

  constructor(status: number, message: string, code?: string, details?: ApiFieldError[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
