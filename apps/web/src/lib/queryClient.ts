import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api/ApiError';

/**
 * docs/architecture/07 §5: "Retry on network failure, but never on 4xx."
 * A 4xx (bad request, forbidden, not found, validation error) will not
 * succeed on retry — only a genuine network failure or a 5xx might. The
 * one 4xx `adminClient.ts` already retries on its own terms is 401
 * TOKEN_EXPIRED (its single-flight refresh + one retry, doc 04 §6); by the
 * time an error reaches react-query here, that path has already run its
 * course, so react-query itself never needs to special-case 401.
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return false;
  }
  return failureCount < 2;
}

/**
 * A factory, not a module-level singleton — `QueryProvider.tsx` calls this
 * inside `useState(() => makeQueryClient())` so each browser tab/session
 * gets its own instance rather than one shared across a React Strict Mode
 * double-render or (in principle) across requests if this code ever ran
 * server-side. There is no server-side use today (every consumer is a
 * Client Component), but the factory pattern costs nothing and avoids a
 * cache silently shared across users if that ever changed.
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetry,
      },
      mutations: {
        // A mutation (login, logout, publish, delete, …) retried
        // automatically could double-submit — every mutation call site
        // decides its own retry/error handling explicitly instead.
        retry: false,
      },
    },
  });
}
