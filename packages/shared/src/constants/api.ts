/** Machine-readable error codes (docs/architecture/03 §1). */
export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'TOKEN_EXPIRED',
  'FORBIDDEN',
  'CSRF_FAILED',
  'NOT_FOUND',
  'METHOD_NOT_ALLOWED',
  'CONFLICT',
  'PAYLOAD_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/** Pagination bounds. `pageSize` is clamped server-side so a caller cannot request every row. */
export const DEFAULT_PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 50;
