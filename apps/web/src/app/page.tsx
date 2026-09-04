import { getApiBaseUrl } from '@/lib/config';

/**
 * Placeholder homepage. The real one is ten database-driven sections built in
 * Phase 6; this exists so Phase 1 can prove the app compiles, renders and
 * resolves the shared package.
 */
export default function HomePage() {
  return (
    <main className="container py-5">
      <h1 className="h3">Eslam Ramzy</h1>
      <p className="text-secondary">
        Portfolio platform — Phase 1 scaffolding. Content arrives in Phase 6.
      </p>
      <p className="text-secondary small">API origin: {getApiBaseUrl()}</p>
    </main>
  );
}
