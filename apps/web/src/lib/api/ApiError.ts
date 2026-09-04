/**
 * Thrown by `serverClient.ts` for any non-2xx or `success: false` API
 * response (docs/architecture/06 §4). A Server Component that lets this
 * propagate gets Next's own `error.tsx` boundary; a 404 is the one status a
 * caller is expected to catch itself and turn into `notFound()` instead.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}
