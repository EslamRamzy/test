import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from '@/features/admin-auth/components/LoginForm';

export const metadata: Metadata = { title: 'Sign in' };

/**
 * `LoginForm` reads `useSearchParams()` (`?reason=expired`, `?from=...`),
 * which requires a `Suspense` boundary in the App Router — without one, any
 * static shell Next tries to prerender for this route would bail entirely
 * rather than stream the dynamic part.
 */
export default function AdminLoginPage(): React.JSX.Element {
  return (
    <main className="admin-auth">
      <div className="admin-auth__card">
        <div className="admin-auth__brand">
          <span className="admin-auth__brand-dot" aria-hidden="true" />
          Eslam Ramzy — Admin
        </div>
        <h1 className="admin-auth__title">Sign in</h1>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
