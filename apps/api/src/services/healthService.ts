import { ping } from '../repositories/healthRepository.js';

/**
 * Business logic stays HTTP-agnostic (docs/architecture/01 §5) — this
 * function knows nothing about Express, status codes, or the response
 * envelope. The route decides what a failed ping means for the HTTP
 * response.
 */
export async function isDatabaseReady(): Promise<boolean> {
  try {
    await ping();
    return true;
  } catch {
    return false;
  }
}
